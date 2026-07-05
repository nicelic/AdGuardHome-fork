package home

import (
	"context"
	"crypto"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"log/slog"
	"net/http"
	"net/netip"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/nicelic/AdGuardHome-fork/internal/agh"
	"github.com/nicelic/AdGuardHome-fork/internal/aghalg"
	"github.com/nicelic/AdGuardHome-fork/internal/aghhttp"
	"github.com/nicelic/AdGuardHome-fork/internal/aghnet"
	"github.com/nicelic/AdGuardHome-fork/internal/aghtls"
	"github.com/AdguardTeam/golibs/errors"
	"github.com/AdguardTeam/golibs/logutil/slogutil"
	"github.com/c2h5oh/datasize"
)

// tlsManager contains the current configuration and state of AdGuard Home TLS
// encryption.
type tlsManager struct {
	// logger is used for logging the operation of the TLS Manager.
	logger *slog.Logger

	// mu protects status, extTLSConf, and servePlainDNS.
	mu *sync.Mutex

	// status is the current status of the configuration.  It is never nil.
	status *tlsConfigStatus

	// panelStatus is the current validation status of the panel HTTPS
	// certificate configuration.  It is never nil.
	panelStatus *tlsConfigStatus

	// rootCerts is a pool of root CAs for TLSv1.2.
	rootCerts *x509.CertPool

	// web is the web UI and API server.  It must not be nil.
	//
	// TODO(s.chzhen):  Temporary cyclic dependency due to ongoing refactoring.
	// Resolve it.
	web *webAPI

	// extTLSConf contains extended TLS configuration settings.  It must not be
	// nil.
	// TODO(m.kazantsev):  Add a field of a type of [*tls.Config] which will
	// represent the TLS settings. This is why these settings are called
	// 'extended'.
	extTLSConf *tlsConfigSettings

	// confModifier is used to update the global configuration.
	confModifier agh.ConfigModifier

	// httpReg registers HTTP handlers.  It must not be nil.
	httpReg aghhttp.Registrar

	// manager is used to manage the TLS certificate and key files.  It must not
	// be nil.
	manager aghtls.Manager

	// certDir is the certificate center directory used to resolve managed
	// certificate IDs into actual runtime certificate/key paths.
	certDir string

	// customCipherIDs are the IDs of the cipher suites that AdGuard Home must
	// use.
	customCipherIDs []uint16

	// servePlainDNS defines if plain DNS is allowed for incoming requests.
	servePlainDNS bool
}

// tlsManagerConfig contains the settings for initializing the TLS manager.
type tlsManagerConfig struct {
	// logger is used for logging the operation of the TLS Manager.  It must not
	// be nil.
	logger *slog.Logger

	// confModifier is used to update the global configuration.  It must not be
	// nil.
	confModifier agh.ConfigModifier

	// manager is used to manage the TLS certificate and key files.  It must not
	// be nil.
	manager aghtls.Manager

	httpReg aghhttp.Registrar

	// certDir is the certificate center directory used to resolve managed
	// certificate IDs into actual runtime certificate/key paths.
	certDir string

	// tlsSettings contains the TLS configuration settings.
	tlsSettings tlsConfigSettings

	// servePlainDNS defines if plain DNS is allowed for incoming requests.
	servePlainDNS bool
}

type tlsConfigFieldAccess struct {
	name string

	certificateChain    *string
	privateKey          *string
	certificatePath     *string
	privateKeyPath      *string
	certificateKeyPairs *[]tlsCertificateKeyPair
	assignedIDs         *[]uint64

	certificateChainData *[]byte
	privateKeyData       *[]byte
	certificates         *[]tls.Certificate
}

func dnsTLSAccess(conf *tlsConfigSettings) (access tlsConfigFieldAccess) {
	return tlsConfigFieldAccess{
		name:                 "dns",
		certificateChain:     &conf.CertificateChain,
		privateKey:           &conf.PrivateKey,
		certificatePath:      &conf.CertificatePath,
		privateKeyPath:       &conf.PrivateKeyPath,
		certificateKeyPairs:  &conf.CertificateKeyPairs,
		assignedIDs:          &conf.DNSAssignedCertificateIDs,
		certificateChainData: &conf.CertificateChainData,
		privateKeyData:       &conf.PrivateKeyData,
		certificates:         &conf.Certificates,
	}
}

func panelTLSAccess(conf *tlsConfigSettings) (access tlsConfigFieldAccess) {
	return tlsConfigFieldAccess{
		name:                 "panel",
		certificateChain:     &conf.PanelCertificateChain,
		privateKey:           &conf.PanelPrivateKey,
		certificatePath:      &conf.PanelCertificatePath,
		privateKeyPath:       &conf.PanelPrivateKeyPath,
		certificateKeyPairs:  &conf.PanelCertificateKeyPairs,
		assignedIDs:          &conf.PanelAssignedCertificateIDs,
		certificateChainData: &conf.PanelCertificateChainData,
		privateKeyData:       &conf.PanelPrivateKeyData,
		certificates:         &conf.PanelCertificates,
	}
}

func normalizeManagedCertificateIDs(ids []uint64) (normalized []uint64) {
	if len(ids) == 0 {
		return nil
	}

	seen := make(map[uint64]struct{}, len(ids))
	for _, id := range ids {
		if id == 0 {
			continue
		}

		if _, ok := seen[id]; ok {
			continue
		}

		seen[id] = struct{}{}
		normalized = append(normalized, id)
	}

	return normalized
}

func managedCertificatePairsForIDs(certDir string, ids []uint64) (pairs []tlsCertificateKeyPair) {
	if certDir == "" {
		return nil
	}

	for _, id := range normalizeManagedCertificateIDs(ids) {
		dir := filepath.Join(certDir, certManagerManagedFilesDirName, strconv.FormatUint(id, 10))
		pairs = append(pairs, tlsCertificateKeyPair{
			CertificatePath: filepath.Join(dir, "fullchain.pem"),
			PrivateKeyPath:  filepath.Join(dir, "key.pem"),
		})
	}

	return pairs
}

func manualCertificateKeyPairs(access tlsConfigFieldAccess) (pairs []tlsCertificateKeyPair) {
	if len(*access.certificateKeyPairs) > 0 {
		return slices.Clone(*access.certificateKeyPairs)
	}

	if *access.certificatePath == "" || *access.privateKeyPath == "" {
		return nil
	}

	return []tlsCertificateKeyPair{{
		CertificatePath: *access.certificatePath,
		PrivateKeyPath:  *access.privateKeyPath,
	}}
}

func manualCertificateWatchPairs(access tlsConfigFieldAccess) (pairs []tlsCertificateKeyPair) {
	if len(*access.certificateKeyPairs) > 0 {
		return slices.Clone(*access.certificateKeyPairs)
	}

	if *access.certificatePath == "" && *access.privateKeyPath == "" {
		return nil
	}

	return []tlsCertificateKeyPair{{
		CertificatePath: *access.certificatePath,
		PrivateKeyPath:  *access.privateKeyPath,
	}}
}

func setManualCertificateKeyPairs(access tlsConfigFieldAccess, pairs []tlsCertificateKeyPair) {
	if len(pairs) == 0 {
		*access.certificatePath = ""
		*access.privateKeyPath = ""
		*access.certificateKeyPairs = nil

		return
	}

	*access.certificatePath = pairs[0].CertificatePath
	*access.privateKeyPath = pairs[0].PrivateKeyPath

	if len(pairs) > 1 {
		*access.certificateKeyPairs = slices.Clone(pairs)
	} else {
		*access.certificateKeyPairs = nil
	}
}

func hasManualCertificateInput(access tlsConfigFieldAccess) (ok bool) {
	if strings.TrimSpace(*access.certificateChain) != "" ||
		strings.TrimSpace(*access.privateKey) != "" ||
		strings.TrimSpace(*access.certificatePath) != "" ||
		strings.TrimSpace(*access.privateKeyPath) != "" {
		return true
	}

	for _, pair := range *access.certificateKeyPairs {
		if strings.TrimSpace(pair.CertificatePath) != "" || strings.TrimSpace(pair.PrivateKeyPath) != "" {
			return true
		}
	}

	return false
}

// inheritManagedCertificateAssignments keeps the current certificate manager
// assignments when the client omits those fields from the request.  An explicit
// empty slice still clears the assignments.
func inheritManagedCertificateAssignments(current *tlsConfigSettings, next *tlsConfigSettings) {
	if current == nil || next == nil {
		return
	}

	if next.DNSAssignedCertificateIDs == nil {
		next.DNSAssignedCertificateIDs = slices.Clone(current.DNSAssignedCertificateIDs)
	}

	if next.PanelAssignedCertificateIDs == nil {
		next.PanelAssignedCertificateIDs = slices.Clone(current.PanelAssignedCertificateIDs)
	}
}

// inheritLegacySharedPanelTLS mirrors the legacy shared-listener DNS
// certificate configuration to the panel TLS fields when panel HTTPS still uses
// the old shared port mode.  This keeps pre-split configurations working at
// runtime while the frontend and validation layer prohibit creating new shared
// setups.
func inheritLegacySharedPanelTLS(conf *tlsConfigSettings) {
	if conf == nil || conf.PanelServerPort != 0 {
		return
	}

	if len(conf.PanelAssignedCertificateIDs) == 0 && len(conf.DNSAssignedCertificateIDs) > 0 {
		conf.PanelAssignedCertificateIDs = slices.Clone(conf.DNSAssignedCertificateIDs)
	}

	if len(conf.PanelAssignedCertificateIDs) > 0 {
		return
	}

	panelAccess := panelTLSAccess(conf)
	if hasManualCertificateInput(panelAccess) {
		return
	}

	dnsAccess := dnsTLSAccess(conf)
	if !hasManualCertificateInput(dnsAccess) {
		return
	}

	*panelAccess.certificateChain = *dnsAccess.certificateChain
	*panelAccess.privateKey = *dnsAccess.privateKey
	*panelAccess.certificatePath = *dnsAccess.certificatePath
	*panelAccess.privateKeyPath = *dnsAccess.privateKeyPath
	*panelAccess.certificateKeyPairs = slices.Clone(*dnsAccess.certificateKeyPairs)
}

func resetTLSStatus(status *tlsConfigStatus) {
	*status = tlsConfigStatus{}
}

// newTLSManager initializes the manager of TLS configuration.  m is always
// non-nil while any returned error indicates that the TLS configuration isn't
// valid.  Thus TLS may be initialized later, e.g. via the web UI.  conf must
// not be nil.  Note that [tlsManager.web] must be initialized later on by using
// [tlsManager.setWebAPI].
func newTLSManager(ctx context.Context, conf *tlsManagerConfig) (m *tlsManager, err error) {
	m = &tlsManager{
		logger:        conf.logger,
		mu:            &sync.Mutex{},
		confModifier:  conf.confModifier,
		httpReg:       conf.httpReg,
		manager:       conf.manager,
		status:        &tlsConfigStatus{},
		panelStatus:   &tlsConfigStatus{},
		extTLSConf:    &conf.tlsSettings,
		certDir:       conf.certDir,
		servePlainDNS: conf.servePlainDNS,
	}

	err = normalizeTLSSettings(m.extTLSConf)
	if err != nil {
		return m, err
	}

	m.rootCerts = aghtls.SystemRootCAs(ctx, conf.logger)

	if len(conf.tlsSettings.OverrideTLSCiphers) > 0 {
		m.customCipherIDs, err = aghtls.ParseCiphers(config.TLS.OverrideTLSCiphers)
		if err != nil {
			// Should not happen because upstreams are already validated.  See
			// [validateTLSCipherIDs].
			panic(err)
		}

		m.logger.InfoContext(ctx, "overriding ciphers", "ciphers", config.TLS.OverrideTLSCiphers)
	} else {
		m.logger.InfoContext(ctx, "using default ciphers")
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if !m.extTLSConf.Enabled {
		return m, nil
	}

	err = m.manager.Set(ctx, tlsCertPairsForWatch(allCertificateWatchPairs(m.extTLSConf, m.certDir)))
	if err != nil {
		m.logger.ErrorContext(ctx, "setting tls files", slogutil.KeyError, err)
	}

	err = m.loadTLSConfig(ctx, m.extTLSConf, m.status, m.panelStatus)
	if err != nil {
		m.extTLSConf.Enabled = false

		return m, err
	}

	return m, nil
}

// setWebAPI stores the provided web API.  It must be called before
// [tlsManager.start], [tlsManager.reload], [tlsManager.handleTLSConfigure], or
// [tlsManager.validateTLSSettings].
//
// TODO(s.chzhen):  Remove it once cyclic dependency is resolved.
func (m *tlsManager) setWebAPI(webAPI *webAPI) {
	m.web = webAPI
}

// extendedTLSConfig returns a deep copy of the stored TLS configuration.
func (m *tlsManager) extendedTLSConfig() (extTLSConf *tlsConfigSettings) {
	m.mu.Lock()
	defer m.mu.Unlock()

	return m.extTLSConf.clone()
}

// start updates the configuration of t and starts it.
//
// TODO(s.chzhen):  Use context.
func (m *tlsManager) start(ctx context.Context) {
	m.registerWebHandlers()

	m.mu.Lock()
	defer m.mu.Unlock()

	// The background context is used because the TLSConfigChanged wraps context
	// with timeout on its own and shuts down the server, which handles current
	// request.
	m.web.tlsConfigChanged(context.Background(), m.extTLSConf)

	go m.handleCertFileChange(ctx)
}

// handleCertFileChange handles changes in the certificate file.  It's intended
// to be run as a goroutine.
func (m *tlsManager) handleCertFileChange(ctx context.Context) {
	defer slogutil.RecoverAndLog(ctx, m.logger)

	updates := m.manager.Updates(ctx)
	if updates == nil {
		m.logger.ErrorContext(ctx, "no updates channel")

		return
	}

	for range updates {
		m.logger.DebugContext(ctx, "reloading")

		m.reload(ctx)
	}
}

// reload updates the configuration and restarts the TLS manager.  It logs any
// encountered errors.
//
// TODO(s.chzhen):  Consider returning an error.
func (m *tlsManager) reload(ctx context.Context) {
	m.mu.Lock()
	defer m.mu.Unlock()

	tlsConfPtr := m.extTLSConf

	if !tlsConfPtr.Enabled || len(allCertificateWatchPairs(tlsConfPtr, m.certDir)) == 0 {
		return
	}

	tlsConf := *tlsConfPtr
	status := &tlsConfigStatus{}
	panelStatus := &tlsConfigStatus{}

	err := m.loadTLSConfig(ctx, &tlsConf, status, panelStatus)
	if err != nil {
		m.logger.WarnContext(ctx, "reloading interrupted", slogutil.KeyError, err)

		return
	}

	m.extTLSConf = &tlsConf
	m.status = status
	m.panelStatus = panelStatus

	err = m.reconfigureDNSServer(ctx)
	if err != nil {
		m.logger.ErrorContext(ctx, "reconfiguring dns server", slogutil.KeyError, err)
	}

	// The background context is used because the TLSConfigChanged wraps context
	// with timeout on its own and shuts down the server, which handles current
	// request.
	m.web.tlsConfigChanged(context.Background(), m.extTLSConf)
}

// reconfigureDNSServer updates the DNS server configuration using the stored
// TLS settings.  m.mu is expected to be locked.
func (m *tlsManager) reconfigureDNSServer(ctx context.Context) (err error) {
	newConf, err := newServerConfig(
		&config.DNS,
		config.Clients.Sources,
		m.extTLSConf,
		config.HTTPConfig.DoH,
		m,
		m.httpReg,
		globalContext.clients.storage,
		m.confModifier,
	)
	if err != nil {
		return fmt.Errorf("generating forwarding dns server config: %w", err)
	}

	err = globalContext.dnsServer.Reconfigure(ctx, newConf)
	if err != nil {
		return fmt.Errorf("starting forwarding dns server: %w", err)
	}

	registerDoHHandlers(dnsOverHTTPSRoutes(m.extTLSConf))

	return nil
}

// tlsCertPairsForWatch converts certificate path pairs to watcher pairs.
func tlsCertPairsForWatch(pairs []tlsCertificateKeyPair) (watchPairs []aghtls.TLSPair) {
	for _, pair := range pairs {
		watchPairs = append(watchPairs, aghtls.TLSPair{
			CertPath: pair.CertificatePath,
			KeyPath:  pair.PrivateKeyPath,
		})
	}

	return watchPairs
}

func allCertificateWatchPairs(conf *tlsConfigSettings, certDir string) (pairs []tlsCertificateKeyPair) {
	if conf == nil {
		return nil
	}

	appendPairs := func(next []tlsCertificateKeyPair) {
		for _, pair := range next {
			if strings.TrimSpace(pair.CertificatePath) == "" && strings.TrimSpace(pair.PrivateKeyPath) == "" {
				continue
			}

			pairs = append(pairs, pair)
		}
	}

	dnsAccess := dnsTLSAccess(conf)
	panelAccess := panelTLSAccess(conf)

	dnsManaged := managedCertificatePairsForIDs(certDir, conf.DNSAssignedCertificateIDs)
	if len(dnsManaged) > 0 {
		appendPairs(dnsManaged)
	} else {
		appendPairs(manualCertificateWatchPairs(dnsAccess))
	}

	panelManaged := managedCertificatePairsForIDs(certDir, conf.PanelAssignedCertificateIDs)
	if len(panelManaged) > 0 {
		appendPairs(panelManaged)
	} else {
		appendPairs(manualCertificateWatchPairs(panelAccess))
	}

	return pairs
}

// loadTLSConfig loads and validates the DNS and panel TLS configuration.  It
// also sets the runtime certificate data properties for both targets.
func (m *tlsManager) loadTLSConfig(
	ctx context.Context,
	extTLSConf *tlsConfigSettings,
	status *tlsConfigStatus,
	panelStatus *tlsConfigStatus,
) (err error) {
	inheritLegacySharedPanelTLS(extTLSConf)

	dnsErr := m.loadTLSConfigForAccess(
		ctx,
		extTLSConf,
		status,
		dnsTLSAccess(extTLSConf),
		dnsCertificateValidationNames(extTLSConf),
		extTLSConf.Enabled && hasEncryptedDNSProtocol(extTLSConf) && requiresDNSX509Certificates(extTLSConf),
	)
	panelErr := m.loadTLSConfigForAccess(
		ctx,
		extTLSConf,
		panelStatus,
		panelTLSAccess(extTLSConf),
		panelCertificateValidationNames(extTLSConf),
		extTLSConf.Enabled && effectivePanelServerPort(extTLSConf) != 0,
	)

	return errors.Join(dnsErr, panelErr)
}

func requiresDNSX509Certificates(conf *tlsConfigSettings) (ok bool) {
	if conf == nil {
		return false
	}

	return conf.PortHTTPS != 0 || conf.PortDNSOverTLS != 0 || conf.PortDNSOverQUIC != 0
}

func (m *tlsManager) loadTLSConfigForAccess(
	ctx context.Context,
	extTLSConf *tlsConfigSettings,
	status *tlsConfigStatus,
	access tlsConfigFieldAccess,
	validationNames []string,
	required bool,
) (err error) {
	*access.certificates = nil
	*access.certificateChainData = nil
	*access.privateKeyData = nil
	resetTLSStatus(status)

	assignedIDs := normalizeManagedCertificateIDs(*access.assignedIDs)
	*access.assignedIDs = assignedIDs

	pathPairs := managedCertificatePairsForIDs(m.certDir, assignedIDs)
	if len(pathPairs) == 0 {
		pathPairs, err = normalizedCertificateKeyPairsForAccess(access)
		if err != nil {
			status.CanApply = false

			return err
		}

		if len(*access.certificateKeyPairs) > 0 || len(pathPairs) > 0 {
			setManualCertificateKeyPairs(access, pathPairs)
		}
	}

	if len(pathPairs) > 0 {
		err = m.loadTLSConfigFromPairsForAccess(ctx, status, access, pathPairs, validationNames)
		status.CanApply = err == nil
	} else {
		err = m.loadTLSConfigSingleForAccess(ctx, status, access, validationNames)
		status.CanApply = err == nil
	}

	if required && len(*access.certificates) == 0 {
		status.CanApply = false
		appendTLSWarning(status, "缺少可用的证书或私钥")
		if err == nil {
			err = errors.Error("missing tls certificate or private key")
		}
	}

	return err
}

// normalizedCertificateKeyPairsForAccess validates certificate and private key
// path pairs and drops fully empty pairs.
func normalizedCertificateKeyPairsForAccess(
	access tlsConfigFieldAccess,
) (pairs []tlsCertificateKeyPair, err error) {
	for i, pair := range manualCertificateKeyPairs(access) {
		if pair.CertificatePath == "" && pair.PrivateKeyPath == "" {
			continue
		}

		if pair.CertificatePath == "" || pair.PrivateKeyPath == "" {
			return nil, fmt.Errorf(
				"certificate and private key paths must be set together for pair %d",
				i+1,
			)
		}

		pairs = append(pairs, pair)
	}

	return pairs, nil
}

// loadTLSConfigSingleForAccess loads and validates a single certificate and
// private key pair configured either as file paths or inline PEM content.
func (m *tlsManager) loadTLSConfigSingleForAccess(
	ctx context.Context,
	status *tlsConfigStatus,
	access tlsConfigFieldAccess,
	serverNames []string,
) (err error) {
	err = loadCertificateChainDataForAccess(access)
	if err != nil {
		return err
	}

	err = loadPrivateKeyDataForAccess(access)
	if err != nil {
		return err
	}

	singleStatus, cert, err := m.loadTLSCertificatePair(
		ctx,
		*access.certificateChainData,
		*access.privateKeyData,
		serverNames,
	)
	*status = singleStatus
	if cert != nil {
		*access.certificates = []tls.Certificate{*cert}
	}

	err = ensureCertificateCoverage(*access.certificates, serverNames)
	if err != nil {
		appendTLSWarning(status, err.Error())
	}

	return err
}

// loadTLSConfigFromPairsForAccess loads and validates multiple certificate and
// private key path pairs.
func (m *tlsManager) loadTLSConfigFromPairsForAccess(
	ctx context.Context,
	status *tlsConfigStatus,
	access tlsConfigFieldAccess,
	pathPairs []tlsCertificateKeyPair,
	serverNames []string,
) (err error) {
	if strings.TrimSpace(*access.certificateChain) != "" {
		return errors.Error("certificate data and file can't be set together")
	}

	if strings.TrimSpace(*access.privateKey) != "" {
		return errors.Error("private key data and file can't be set together")
	}

	var (
		firstErr error
		statuses []tlsConfigPairStatus
	)

	for i, pair := range pathPairs {
		pairStatus := tlsConfigPairStatus{
			CertificatePath: pair.CertificatePath,
			PrivateKeyPath:  pair.PrivateKeyPath,
		}

		var certData []byte
		certData, err = os.ReadFile(pair.CertificatePath)
		if err != nil {
			pairStatus.WarningValidation = fmt.Sprintf("reading cert file: %s", err)
			if firstErr == nil {
				firstErr = fmt.Errorf("pair %d: reading cert file: %w", i+1, err)
			}

			statuses = append(statuses, pairStatus)

			continue
		}

		var keyData []byte
		keyData, err = os.ReadFile(pair.PrivateKeyPath)
		if err != nil {
			pairStatus.WarningValidation = fmt.Sprintf("reading key file: %s", err)
			if firstErr == nil {
				firstErr = fmt.Errorf("pair %d: reading key file: %w", i+1, err)
			}

			statuses = append(statuses, pairStatus)

			continue
		}

		var cert *tls.Certificate
		pairStatus.tlsConfigStatus, cert, err = m.loadTLSCertificatePair(
			ctx,
			certData,
			keyData,
			serverNames,
		)
		if err != nil && firstErr == nil {
			firstErr = fmt.Errorf("pair %d: %w", i+1, err)
		}

		if cert != nil {
			*access.certificates = append(*access.certificates, *cert)
		}

		if len(statuses) == 0 {
			*access.certificateChainData = certData
			*access.privateKeyData = keyData
		}

		statuses = append(statuses, pairStatus)
	}

	*status = aggregateTLSPairStatuses(statuses)
	err = ensureCertificateCoverage(*access.certificates, serverNames)
	if err != nil {
		appendTLSWarning(status, err.Error())
	}
	if firstErr == nil {
		firstErr = err
	}

	return firstErr
}

// loadTLSCertificatePair validates a certificate and private key pair and
// returns a parsed certificate when the pair is usable.
func (m *tlsManager) loadTLSCertificatePair(
	ctx context.Context,
	certData []byte,
	keyData []byte,
	serverNames []string,
) (status tlsConfigStatus, cert *tls.Certificate, err error) {
	err = m.validateCertificates(ctx, &status, certData, keyData, serverNames)
	if err != nil {
		status.WarningValidation = err.Error()
		if !(status.ValidCert && status.ValidKey && status.ValidPair) {
			return status, nil, errors.Annotate(err, "validating certificate pair: %w")
		}

		err = nil
	}

	if len(certData) == 0 || len(keyData) == 0 {
		return status, nil, err
	}

	var parsed tls.Certificate
	parsed, err = tlsCertificateFromData(certData, keyData)
	if err != nil {
		status.WarningValidation = err.Error()

		return status, nil, err
	}

	return status, &parsed, err
}

// tlsCertificateFromData parses a TLS certificate and ensures its leaf is set.
func tlsCertificateFromData(certData []byte, keyData []byte) (cert tls.Certificate, err error) {
	cert, err = tls.X509KeyPair(certData, keyData)
	if err != nil {
		return cert, fmt.Errorf("certificate-key pair: %w", err)
	}

	if cert.Leaf == nil && len(cert.Certificate) > 0 {
		cert.Leaf, err = x509.ParseCertificate(cert.Certificate[0])
		if err != nil {
			return cert, fmt.Errorf("parsing leaf certificate: %w", err)
		}
	}

	return cert, nil
}

// aggregateTLSPairStatuses aggregates multiple pair statuses into a single
// top-level TLS status while preserving the per-pair results.
func aggregateTLSPairStatuses(statuses []tlsConfigPairStatus) (status tlsConfigStatus) {
	if len(statuses) == 0 {
		return status
	}

	status = statuses[0].tlsConfigStatus
	status.ValidCert = true
	status.ValidChain = true
	status.ValidKey = true
	status.ValidPair = true
	status.CertificateKeyPairStatuses = slices.Clone(statuses)

	var warnings []string
	for i, pairStatus := range statuses {
		status.ValidCert = status.ValidCert && pairStatus.ValidCert
		status.ValidChain = status.ValidChain && pairStatus.ValidChain
		status.ValidKey = status.ValidKey && pairStatus.ValidKey
		status.ValidPair = status.ValidPair && pairStatus.ValidPair

		if pairStatus.WarningValidation != "" {
			warnings = append(warnings, fmt.Sprintf("pair %d: %s", i+1, pairStatus.WarningValidation))
		}
	}

	status.WarningValidation = strings.Join(warnings, "; ")

	return status
}

// ensureCertificateCoverage verifies that every configured service name is
// covered by at least one of the loaded certificates.
func ensureCertificateCoverage(certs []tls.Certificate, names []string) (err error) {
	if len(certs) == 0 || len(names) == 0 {
		return nil
	}

	var missing []string
	for _, name := range names {
		if aghtls.FindTLSCertificate(certs, name) == nil {
			missing = append(missing, name)
		}
	}

	if len(missing) == 0 {
		return nil
	}

	return fmt.Errorf(
		"configured server names are not covered by the TLS certificates: %s",
		strings.Join(missing, ", "),
	)
}

// appendTLSWarning appends warning to the TLS status preserving existing
// validation messages.
func appendTLSWarning(status *tlsConfigStatus, warning string) {
	if warning == "" {
		return
	}

	if status.WarningValidation == "" {
		status.WarningValidation = warning

		return
	}

	status.WarningValidation += "; " + warning
}

// loadCertificateChainDataForAccess loads PEM-encoded certificate chain data
// for the selected TLS target.
func loadCertificateChainDataForAccess(access tlsConfigFieldAccess) (err error) {
	*access.certificateChainData = []byte(*access.certificateChain)
	if *access.certificatePath != "" {
		if *access.certificateChain != "" {
			return errors.Error("certificate data and file can't be set together")
		}

		*access.certificateChainData, err = os.ReadFile(*access.certificatePath)
		if err != nil {
			return fmt.Errorf("reading cert file: %w", err)
		}
	}

	return nil
}

// loadPrivateKeyDataForAccess loads PEM-encoded private key data for the
// selected TLS target.
func loadPrivateKeyDataForAccess(access tlsConfigFieldAccess) (err error) {
	*access.privateKeyData = []byte(*access.privateKey)
	if *access.privateKeyPath != "" {
		if *access.privateKey != "" {
			return errors.Error("private key data and file can't be set together")
		}

		*access.privateKeyData, err = os.ReadFile(*access.privateKeyPath)
		if err != nil {
			return fmt.Errorf("reading key file: %w", err)
		}
	}

	return nil
}

// tlsConfigStatus contains the status of a certificate chain and key pair.
type tlsConfigStatus struct {
	// CanApply is true when the current TLS configuration can be saved without
	// the configure API rejecting it.
	CanApply bool `json:"can_apply"`

	// Subject is the subject of the first certificate in the chain.
	Subject string `json:"subject,omitempty"`

	// Issuer is the issuer of the first certificate in the chain.
	Issuer string `json:"issuer,omitempty"`

	// KeyType is the type of the private key.
	KeyType string `json:"key_type,omitempty"`

	// NotBefore is the NotBefore field of the first certificate in the chain.
	NotBefore time.Time `json:"not_before"`

	// NotAfter is the NotAfter field of the first certificate in the chain.
	NotAfter time.Time `json:"not_after"`

	// WarningValidation is a validation warning message with the issue
	// description.
	WarningValidation string `json:"warning_validation,omitempty"`

	// CertificateKeyPairStatuses contains validation results for each
	// certificate and private key path pair.
	CertificateKeyPairStatuses []tlsConfigPairStatus `json:"certificate_key_pair_statuses,omitempty"`

	// DNSNames is the value of SubjectAltNames field of the first certificate
	// in the chain.
	DNSNames []string `json:"dns_names"`

	// ValidCert is true if the specified certificate chain is a valid chain of
	// X509 certificates.
	ValidCert bool `json:"valid_cert"`

	// ValidChain is true if the specified certificate chain is verified and
	// issued by a known CA.
	ValidChain bool `json:"valid_chain"`

	// ValidKey is true if the key is a valid private key.
	ValidKey bool `json:"valid_key"`

	// ValidPair is true if both certificate and private key are correct for
	// each other.
	ValidPair bool `json:"valid_pair"`
}

// tlsConfigPairStatus contains validation results for a single certificate and
// private key path pair.
type tlsConfigPairStatus struct {
	tlsConfigStatus `json:",inline"`

	// CertificatePath is the certificate file path for this pair.
	CertificatePath string `json:"certificate_path,omitempty"`

	// PrivateKeyPath is the private key file path for this pair.
	PrivateKeyPath string `json:"private_key_path,omitempty"`
}

// panelTLSConfigStatus contains validation results for the panel HTTPS
// certificate configuration using panel-prefixed JSON fields.
type panelTLSConfigStatus struct {
	PanelCanApply bool `json:"panel_can_apply"`

	PanelSubject string `json:"panel_subject,omitempty"`

	PanelIssuer string `json:"panel_issuer,omitempty"`

	PanelKeyType string `json:"panel_key_type,omitempty"`

	PanelNotBefore time.Time `json:"panel_not_before"`

	PanelNotAfter time.Time `json:"panel_not_after"`

	PanelWarningValidation string `json:"panel_warning_validation,omitempty"`

	PanelCertificateKeyPairStatuses []tlsConfigPairStatus `json:"panel_certificate_key_pair_statuses,omitempty"`

	PanelDNSNames []string `json:"panel_dns_names"`

	PanelValidCert bool `json:"panel_valid_cert"`

	PanelValidChain bool `json:"panel_valid_chain"`

	PanelValidKey bool `json:"panel_valid_key"`

	PanelValidPair bool `json:"panel_valid_pair"`
}

func newPanelTLSConfigStatus(status *tlsConfigStatus) (panel panelTLSConfigStatus) {
	if status == nil {
		return panel
	}

	panel.PanelCanApply = status.CanApply
	panel.PanelSubject = status.Subject
	panel.PanelIssuer = status.Issuer
	panel.PanelKeyType = status.KeyType
	panel.PanelNotBefore = status.NotBefore
	panel.PanelNotAfter = status.NotAfter
	panel.PanelWarningValidation = status.WarningValidation
	panel.PanelCertificateKeyPairStatuses = slices.Clone(status.CertificateKeyPairStatuses)
	panel.PanelDNSNames = slices.Clone(status.DNSNames)
	panel.PanelValidCert = status.ValidCert
	panel.PanelValidChain = status.ValidChain
	panel.PanelValidKey = status.ValidKey
	panel.PanelValidPair = status.ValidPair

	return panel
}

// tlsConfig is the TLS configuration and status response.
type tlsConfig struct {
	*tlsConfigStatus     `json:",inline"`
	panelTLSConfigStatus `json:",inline"`
	tlsConfigSettingsExt `json:",inline"`
}

// tlsConfigSettingsExt is used to (un)marshal PrivateKeySaved field and
// ServePlainDNS field.
type tlsConfigSettingsExt struct {
	tlsConfigSettings `json:",inline"`

	// PrivateKeySaved is true if the private key is saved as a string and omit
	// key from answer.  It is used to ensure that clients don't send and
	// receive previously saved private keys.
	PrivateKeySaved bool `yaml:"-" json:"private_key_saved"`

	// PanelPrivateKeySaved is true if the panel private key is saved as a
	// string and omitted from responses.
	PanelPrivateKeySaved bool `yaml:"-" json:"panel_private_key_saved"`

	// ServePlainDNS defines if plain DNS is allowed for incoming requests.  It
	// is an [aghalg.NullBool] to be able to tell when it's set without using
	// pointers.
	ServePlainDNS aghalg.NullBool `yaml:"-" json:"serve_plain_dns"`
}

// handleTLSStatus is the handler for the GET /control/tls/status HTTP API.
func (m *tlsManager) handleTLSStatus(w http.ResponseWriter, r *http.Request) {
	var tlsConf *tlsConfigSettings
	var servePlainDNS bool
	var panelStatus *tlsConfigStatus
	func() {
		m.mu.Lock()
		defer m.mu.Unlock()

		tlsConf = m.extTLSConf.clone()
		panelStatus = m.panelStatus
		servePlainDNS = m.servePlainDNS
	}()

	data := &tlsConfig{
		panelTLSConfigStatus: newPanelTLSConfigStatus(panelStatus),
		tlsConfigSettingsExt: tlsConfigSettingsExt{
			tlsConfigSettings: *tlsConf,
			ServePlainDNS:     aghalg.BoolToNullBool(servePlainDNS),
		},
		tlsConfigStatus: m.status,
	}

	m.marshalTLS(r.Context(), w, r, data)
}

// handleTLSValidate is the handler for the POST /control/tls/validate HTTP API.
func (m *tlsManager) handleTLSValidate(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	setts, err := unmarshalTLS(r)
	if err != nil {
		// errFmt does not follow error message guidelines because it is sent
		// directly to the frontend.
		const errFmt = "Failed to unmarshal TLS config: %s"

		aghhttp.ErrorAndLog(ctx, m.logger, r, w, http.StatusBadRequest, errFmt, err)

		return
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if setts.PrivateKeySaved {
		setts.PrivateKey = m.extTLSConf.PrivateKey
	}
	if setts.PanelPrivateKeySaved {
		setts.PanelPrivateKey = m.extTLSConf.PanelPrivateKey
	}
	inheritManagedCertificateAssignments(m.extTLSConf, &setts.tlsConfigSettings)

	if err = m.validateTLSSettings(setts); err != nil {
		m.logger.InfoContext(ctx, "validating tls settings", slogutil.KeyError, err)

		aghhttp.ErrorAndLog(ctx, m.logger, r, w, http.StatusBadRequest, "%s", err)

		return
	}

	// Skip the error check, since we are only interested in the value of
	// status.WarningValidation.
	status := &tlsConfigStatus{}
	panelStatus := &tlsConfigStatus{}
	_ = m.loadTLSConfig(ctx, &setts.tlsConfigSettings, status, panelStatus)
	resp := &tlsConfig{
		panelTLSConfigStatus: newPanelTLSConfigStatus(panelStatus),
		tlsConfigSettingsExt: setts,
		tlsConfigStatus:      status,
	}

	m.marshalTLS(ctx, w, r, resp)
}

// setConfig updates manager TLS configuration with the given one.  m.mu is
// expected to be locked.
func (m *tlsManager) setConfig(
	ctx context.Context,
	newConf tlsConfigSettings,
	status *tlsConfigStatus,
	panelStatus *tlsConfigStatus,
	servePlain aghalg.NullBool,
) (restartHTTPS bool) {
	if !m.extTLSConf.setPrivateFieldsAndCompare(&newConf) {
		m.logger.InfoContext(ctx, "config has changed, restarting https server")
		restartHTTPS = true
	} else {
		m.logger.InfoContext(ctx, "config has not changed")
	}

	m.extTLSConf = &newConf

	m.status = status
	m.panelStatus = panelStatus

	if servePlain != aghalg.NBNull {
		m.servePlainDNS = servePlain == aghalg.NBTrue
	}

	var pairs []tlsCertificateKeyPair
	if newConf.Enabled {
		pairs = allCertificateWatchPairs(&newConf, m.certDir)
	}

	err := m.manager.Set(ctx, tlsCertPairsForWatch(pairs))
	if err != nil {
		m.logger.ErrorContext(ctx, "setting tls files", slogutil.KeyError, err)
	}

	return restartHTTPS
}

// applySettings validates, loads, and applies the provided TLS configuration
// directly to the runtime.  It is intended for internal callers such as the
// certificate manager.
func (m *tlsManager) applySettings(
	ctx context.Context,
	newConf tlsConfigSettings,
	servePlain aghalg.NullBool,
) (err error) {
	var restartHTTPS bool

	m.mu.Lock()
	defer func() {
		m.mu.Unlock()

		if restartHTTPS {
			go m.web.tlsConfigChanged(context.Background(), &newConf)
		}
	}()

	newConf.StrictSNICheck = m.extTLSConf.StrictSNICheck

	if err = m.validateTLSSettings(tlsConfigSettingsExt{
		tlsConfigSettings: newConf,
		ServePlainDNS:     servePlain,
	}); err != nil {
		return err
	}

	status := &tlsConfigStatus{}
	panelStatus := &tlsConfigStatus{}
	err = m.loadTLSConfig(ctx, &newConf, status, panelStatus)
	if err != nil {
		return err
	}

	restartHTTPS = m.setConfig(ctx, newConf, status, panelStatus, servePlain)

	if servePlain != aghalg.NBNull {
		config.Lock()
		config.DNS.ServePlainDNS = servePlain == aghalg.NBTrue
		config.Unlock()
	}

	return m.reconfigureDNSServer(ctx)
}

// handleTLSConfigure is the handler for the POST /control/tls/configure HTTP
// API.
func (m *tlsManager) handleTLSConfigure(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	req, err := unmarshalTLS(r)
	if err != nil {
		aghhttp.ErrorAndLog(
			ctx,
			m.logger,
			r,
			w,
			http.StatusBadRequest,
			"Failed to unmarshal TLS config: %s",
			err,
		)

		return
	}

	var restartHTTPS bool
	defer func() {
		if restartHTTPS {
			m.confModifier.Apply(ctx)
		}
	}()

	m.mu.Lock()
	defer m.mu.Unlock()

	if req.PrivateKeySaved {
		req.PrivateKey = m.extTLSConf.PrivateKey
	}
	if req.PanelPrivateKeySaved {
		req.PanelPrivateKey = m.extTLSConf.PanelPrivateKey
	}

	req.StrictSNICheck = m.extTLSConf.StrictSNICheck
	inheritManagedCertificateAssignments(m.extTLSConf, &req.tlsConfigSettings)

	if err = m.validateTLSSettings(req); err != nil {
		aghhttp.ErrorAndLog(ctx, m.logger, r, w, http.StatusBadRequest, "%s", err)

		return
	}

	status := &tlsConfigStatus{}
	panelStatus := &tlsConfigStatus{}
	err = m.loadTLSConfig(ctx, &req.tlsConfigSettings, status, panelStatus)
	if err != nil {
		aghhttp.ErrorAndLog(ctx, m.logger, r, w, http.StatusBadRequest, "%s", err)

		return
	}

	restartHTTPS = m.setConfig(ctx, req.tlsConfigSettings, status, panelStatus, req.ServePlainDNS)

	if req.ServePlainDNS != aghalg.NBNull {
		func() {
			config.Lock()
			defer config.Unlock()

			config.DNS.ServePlainDNS = req.ServePlainDNS == aghalg.NBTrue
		}()
	}

	err = m.reconfigureDNSServer(ctx)
	if err != nil {
		m.logger.ErrorContext(ctx, "reconfiguring dns server", slogutil.KeyError, err)

		aghhttp.ErrorAndLog(ctx, m.logger, r, w, http.StatusInternalServerError, "%s", err)

		return
	}

	respConf := m.extTLSConf.clone()
	resp := &tlsConfig{
		panelTLSConfigStatus: newPanelTLSConfigStatus(m.panelStatus),
		tlsConfigSettingsExt: tlsConfigSettingsExt{
			tlsConfigSettings: *respConf,
			ServePlainDNS:     aghalg.BoolToNullBool(m.servePlainDNS),
		},
		tlsConfigStatus: m.status,
	}

	m.marshalTLS(ctx, w, r, resp)
	rc := http.NewResponseController(w)
	err = rc.Flush()
	if err != nil {
		m.logger.ErrorContext(ctx, "flushing response", slogutil.KeyError, err)
	}

	// The background context is used because the TLSConfigChanged wraps context
	// with timeout on its own and shuts down the server, which handles current
	// request.  It is also should be done in a separate goroutine due to the
	// same reason.
	if restartHTTPS {
		go m.web.tlsConfigChanged(context.Background(), &req.tlsConfigSettings)
	}
}

// validateTLSSettings returns error if the setts are not valid.
func (m *tlsManager) validateTLSSettings(setts tlsConfigSettingsExt) (err error) {
	err = normalizeTLSSettings(&setts.tlsConfigSettings)
	if err != nil {
		return err
	}

	if !setts.Enabled {
		if setts.ServePlainDNS == aghalg.NBFalse {
			// TODO(a.garipov): Support full disabling of all DNS.
			return errors.Error("plain DNS is required in case encryption protocols are disabled")
		}

		return nil
	}

	if setts.ServePlainDNS == aghalg.NBFalse && !hasEncryptedDNSProtocol(&setts.tlsConfigSettings) {
		return errors.Error("at least one encrypted DNS protocol must be enabled when plain DNS is disabled")
	}

	if setts.PanelServerPort == 0 {
		return errors.Error("面板 HTTPS 端口必须单独设置，不能与 DNS 加密共用端口")
	}

	var (
		tlsConf      tlsConfigSettings
		webAPIAddr   netip.Addr
		webAPIPort   uint16
		plainDNSPort uint16
	)

	func() {
		config.Lock()
		defer config.Unlock()

		tlsConf = config.TLS
		webAPIAddr = config.HTTPConfig.Address.Addr()
		webAPIPort = config.HTTPConfig.Address.Port()
		plainDNSPort = config.DNS.Port
	}()

	err = validatePorts(
		tcpPort(webAPIPort),
		tcpPort(setts.PanelServerPort),
		tcpPort(setts.PortHTTPS),
		tcpPort(setts.PortDNSOverTLS),
		tcpPort(setts.PortDNSCrypt),
		udpPort(plainDNSPort),
		udpPort(setts.PortDNSOverQUIC),
	)
	if err != nil {
		// Don't wrap the error because it's informative enough as is.
		return err
	}

	// Don't wrap the error because it's informative enough as is.
	return m.checkPortAvailability(tlsConf, setts.tlsConfigSettings, webAPIAddr)
}

// validatePorts validates the uniqueness of TCP and UDP ports for AdGuard Home
// DNS protocols.
func validatePorts(
	bindPort, panelPort, dohPort, dotPort, dnscryptTCPPort tcpPort,
	dnsPort, doqPort udpPort,
) (err error) {
	tcpPorts := aghalg.UniqChecker[tcpPort]{}
	addPorts(tcpPorts, bindPort, dotPort, dnscryptTCPPort, tcpPort(dnsPort))
	if panelPort != 0 {
		addPorts(tcpPorts, panelPort, dohPort)
	} else {
		addPorts(tcpPorts, dohPort)
	}

	err = tcpPorts.Validate()
	if err != nil {
		return fmt.Errorf("validating tcp ports: %w", err)
	}

	udpPorts := aghalg.UniqChecker[udpPort]{}
	addPorts(udpPorts, dnsPort, doqPort)

	err = udpPorts.Validate()
	if err != nil {
		return fmt.Errorf("validating udp ports: %w", err)
	}

	return nil
}

// validateCertChain verifies certs using the first as the main one and others
// as intermediate.  srvName stands for the expected DNS name.  certs must not
// be empty.
//
// TODO(e.burkov):  Pass logger and rootCerts through arguments and remove
// dependency on tlsManager.
func (m *tlsManager) validateCertChain(
	ctx context.Context,
	certs []*x509.Certificate,
	serverNames []string,
) (err error) {
	main, others := certs[0], certs[1:]

	pool := x509.NewCertPool()
	for _, cert := range others {
		pool.AddCert(cert)
	}

	othersLen := len(others)
	if othersLen > 0 {
		m.logger.InfoContext(
			ctx,
			"verifying certificate chain: got an intermediate cert",
			"num", othersLen,
		)
	}

	baseOpts := x509.VerifyOptions{
		Roots:         m.rootCerts,
		Intermediates: pool,
	}

	if len(serverNames) == 0 {
		_, err = main.Verify(baseOpts)
		if err != nil {
			return fmt.Errorf("certificate does not verify: %w", err)
		}

		return nil
	}

	var verifyErrs []error
	for _, serverName := range serverNames {
		opts := baseOpts
		opts.DNSName = serverName

		_, err = main.Verify(opts)
		if err == nil {
			return nil
		}

		verifyErrs = append(verifyErrs, err)
	}

	for _, ip := range main.IPAddresses {
		opts := baseOpts
		opts.DNSName = ip.String()

		_, err = main.Verify(opts)
		if err == nil {
			return nil
		}

		verifyErrs = append(verifyErrs, err)
	}

	return fmt.Errorf("certificate does not verify: %w", errors.Join(verifyErrs...))
}

// checkPortAvailability checks panel HTTPS, DoH, DoT, and DoQ ports
// are available for use.  It checks the current configuration and, if needed,
// attempts to bind to the port.  The function returns human-readable error
// messages for the frontend.  This is best-effort check to prevent an "address
// already in use" error.
//
// TODO(a.garipov): Adapt for HTTP/3.
func (m *tlsManager) checkPortAvailability(
	currConf tlsConfigSettings,
	newConf tlsConfigSettings,
	addr netip.Addr,
) (err error) {
	const (
		networkTCP = "tcp"
		networkUDP = "udp"

		protoPanelHTTPS = "Panel HTTPS"
		protoDoH        = "DNS-over-HTTPS"
		protoDoT        = "DNS-over-TLS"
		protoDoQ        = "DNS-over-QUIC"
	)

	needBindingCheck := []struct {
		network  string
		proto    string
		currPort uint16
		newPort  uint16
	}{}

	currPanelPort := effectivePanelServerPort(&currConf)
	newPanelPort := effectivePanelServerPort(&newConf)
	needBindingCheck = append(needBindingCheck, struct {
		network  string
		proto    string
		currPort uint16
		newPort  uint16
	}{
		network:  networkTCP,
		proto:    protoPanelHTTPS,
		currPort: currPanelPort,
		newPort:  newPanelPort,
	})

	if newConf.PanelServerPort != 0 || currConf.PanelServerPort != 0 {
		needBindingCheck = append(needBindingCheck, struct {
			network  string
			proto    string
			currPort uint16
			newPort  uint16
		}{
			network:  networkTCP,
			proto:    protoDoH,
			currPort: currConf.PortHTTPS,
			newPort:  newConf.PortHTTPS,
		})
	}

	needBindingCheck = append(needBindingCheck,
		struct {
			network  string
			proto    string
			currPort uint16
			newPort  uint16
		}{
			network:  networkTCP,
			proto:    protoDoT,
			currPort: currConf.PortDNSOverTLS,
			newPort:  newConf.PortDNSOverTLS,
		},
		struct {
			network  string
			proto    string
			currPort uint16
			newPort  uint16
		}{
			network:  networkUDP,
			proto:    protoDoQ,
			currPort: currConf.PortDNSOverQUIC,
			newPort:  newConf.PortDNSOverQUIC,
		},
	)

	var errs []error
	for _, v := range needBindingCheck {
		port := v.newPort
		if v.currPort == port {
			continue
		}

		addrPort := netip.AddrPortFrom(addr, port)
		err = aghnet.CheckPort(v.network, addrPort)
		if err != nil {
			errs = append(errs, fmt.Errorf("port %d for %s is not available", port, v.proto))
		}
	}

	return errors.Join(errs...)
}

// errNoIPInCert is the error that is returned from [tlsManager.parseCertChain]
// if the leaf certificate doesn't contain IPs.
const errNoIPInCert errors.Error = `certificates has no IP addresses; ` +
	`DNS-over-TLS won't be advertised via DDR`

// parseCertChain parses the certificate chain from raw data, and returns it.
// If ok is true, the returned error, if any, is not critical.
//
// TODO(e.burkov):  Pass logger through arguments and remove dependency on
// tlsManager.
func (m *tlsManager) parseCertChain(
	ctx context.Context,
	chain []byte,
) (parsedCerts []*x509.Certificate, ok bool, err error) {
	m.logger.DebugContext(ctx, "parsing certificate chain", "size", datasize.ByteSize(len(chain)))

	var certs []*pem.Block
	for decoded, pemblock := pem.Decode(chain); decoded != nil; {
		if decoded.Type == "CERTIFICATE" {
			certs = append(certs, decoded)
		}

		decoded, pemblock = pem.Decode(pemblock)
	}

	parsedCerts, err = parsePEMCerts(certs)
	if err != nil {
		return nil, false, err
	}

	m.logger.InfoContext(ctx, "parsing multiple pem certificates", "num", len(parsedCerts))

	if !aghtls.CertificateHasIP(parsedCerts[0]) {
		err = errNoIPInCert
	}

	return parsedCerts, true, err
}

// parsePEMCerts parses multiple PEM-encoded certificates.
func parsePEMCerts(certs []*pem.Block) (parsedCerts []*x509.Certificate, err error) {
	for i, cert := range certs {
		var parsed *x509.Certificate
		parsed, err = x509.ParseCertificate(cert.Bytes)
		if err != nil {
			return nil, fmt.Errorf("parsing certificate at index %d: %w", i, err)
		}

		parsedCerts = append(parsedCerts, parsed)
	}

	if len(parsedCerts) == 0 {
		return nil, errors.Error("empty certificate")
	}

	return parsedCerts, nil
}

// validatePKey validates the private key, returning its type.  It returns an
// empty string if error occurs.
func validatePKey(pkey []byte) (keyType string, err error) {
	var key *pem.Block

	// Go through all pem blocks, but take first valid pem block and drop the
	// rest.
	for decoded, pemblock := pem.Decode([]byte(pkey)); decoded != nil; {
		if decoded.Type == "PRIVATE KEY" || strings.HasSuffix(decoded.Type, " PRIVATE KEY") {
			key = decoded

			break
		}

		decoded, pemblock = pem.Decode(pemblock)
	}

	if key == nil {
		return "", errors.Error("no valid keys were found")
	}

	_, keyType, err = parsePrivateKey(key.Bytes)
	if err != nil {
		return "", fmt.Errorf("parsing private key: %w", err)
	}

	if keyType == keyTypeED25519 {
		return "", errors.Error(
			"ED25519 keys are not supported by browsers; " +
				"did you mean to use X25519 for key exchange?",
		)
	}

	return keyType, nil
}

// validateCertificates processes certificate data and its private key.  status
// must not be nil, since it's used to accumulate the validation results.  Other
// parameters are optional.
func (m *tlsManager) validateCertificates(
	ctx context.Context,
	status *tlsConfigStatus,
	certChain []byte,
	pkey []byte,
	serverNames []string,
) (err error) {
	// Check only the public certificate separately from the key.
	if len(certChain) > 0 {
		var ok bool
		ok, err = m.validateCertificate(ctx, status, certChain, serverNames)
		if !ok {
			// Don't wrap the error, since it's informative enough as is.
			return err
		}
	}

	// Validate the private key by parsing it.
	if len(pkey) > 0 {
		var keyErr error
		status.KeyType, keyErr = validatePKey(pkey)
		if keyErr != nil {
			// Don't wrap the error, since it's informative enough as is.
			return keyErr
		}

		// Set status.ValidKey to true to signal the frontend that the
		// key is valid.
		status.ValidKey = true
	}

	// If both are set, validate together.
	if len(certChain) > 0 && len(pkey) > 0 {
		_, pairErr := tls.X509KeyPair(certChain, pkey)
		if pairErr != nil {
			return fmt.Errorf("certificate-key pair: %w", pairErr)
		}

		status.ValidPair = true
	}

	return err
}

// validateCertificate processes certificate data.  status must not be nil, as
// it is used to accumulate the validation results.  Other parameters are
// optional.  If ok is true, the returned error, if any, is not critical.
func (m *tlsManager) validateCertificate(
	ctx context.Context,
	status *tlsConfigStatus,
	certChain []byte,
	serverNames []string,
) (ok bool, err error) {
	// parseErr is a non-critical parse warning.
	var parseErr error
	var certs []*x509.Certificate

	// Set status.ValidCert to true to signal the frontend that the
	// certificate opens successfully and certificate chain is valid.
	certs, status.ValidCert, parseErr = m.parseCertChain(ctx, certChain)
	if !status.ValidCert {
		// Don't wrap the error, since it's informative enough as is.
		return false, parseErr
	}

	mainCert := certs[0]
	status.Subject = mainCert.Subject.String()
	status.Issuer = mainCert.Issuer.String()
	status.NotAfter = mainCert.NotAfter
	status.NotBefore = mainCert.NotBefore
	status.DNSNames = mainCert.DNSNames

	err = m.validateCertChain(ctx, certs, serverNames)
	if err != nil {
		// Let self-signed certs through and don't return this error to set
		// its message into the status.WarningValidation afterwards.
		return true, err
	}

	status.ValidChain = true

	// Propagate the non-critical parse warning.
	return true, parseErr
}

// Key types.
const (
	keyTypeECDSA   = "ECDSA"
	keyTypeED25519 = "ED25519"
	keyTypeRSA     = "RSA"
)

// Attempt to parse the given private key DER block.  OpenSSL 0.9.8 generates
// PKCS#1 private keys by default, while OpenSSL 1.0.0 generates PKCS#8 keys.
// OpenSSL ecparam generates SEC1 EC private keys for ECDSA.  We try all three.
//
// TODO(a.garipov): Find out if this version of parsePrivateKey from the stdlib
// is actually necessary.
func parsePrivateKey(der []byte) (key crypto.PrivateKey, typ string, err error) {
	if key, err = x509.ParsePKCS1PrivateKey(der); err == nil {
		return key, keyTypeRSA, nil
	}

	if key, err = x509.ParsePKCS8PrivateKey(der); err == nil {
		switch key := key.(type) {
		case *rsa.PrivateKey:
			return key, keyTypeRSA, nil
		case *ecdsa.PrivateKey:
			return key, keyTypeECDSA, nil
		case ed25519.PrivateKey:
			return key, keyTypeED25519, nil
		default:
			return nil, "", fmt.Errorf(
				"tls: found unknown private key type %T in PKCS#8 wrapping",
				key,
			)
		}
	}

	if key, err = x509.ParseECPrivateKey(der); err == nil {
		return key, keyTypeECDSA, nil
	}

	return nil, "", errors.Error("tls: failed to parse private key")
}

// unmarshalTLS handles base64-encoded certificates transparently
func unmarshalTLS(r *http.Request) (data tlsConfigSettingsExt, err error) {
	data = tlsConfigSettingsExt{}
	err = json.NewDecoder(r.Body).Decode(&data)
	if err != nil {
		return data, fmt.Errorf("failed to parse new TLS config json: %w", err)
	}

	if data.CertificateChain != "" {
		var cert []byte
		cert, err = base64.StdEncoding.DecodeString(data.CertificateChain)
		if err != nil {
			return data, fmt.Errorf("failed to base64-decode certificate chain: %w", err)
		}

		data.CertificateChain = string(cert)
	}

	if data.PrivateKey != "" {
		var key []byte
		key, err = base64.StdEncoding.DecodeString(data.PrivateKey)
		if err != nil {
			return data, fmt.Errorf("failed to base64-decode private key: %w", err)
		}

		data.PrivateKey = string(key)
	}

	if data.PanelCertificateChain != "" {
		var cert []byte
		cert, err = base64.StdEncoding.DecodeString(data.PanelCertificateChain)
		if err != nil {
			return data, fmt.Errorf("failed to base64-decode panel certificate chain: %w", err)
		}

		data.PanelCertificateChain = string(cert)
	}

	if data.PanelPrivateKey != "" {
		var key []byte
		key, err = base64.StdEncoding.DecodeString(data.PanelPrivateKey)
		if err != nil {
			return data, fmt.Errorf("failed to base64-decode panel private key: %w", err)
		}

		data.PanelPrivateKey = string(key)
	}

	dnsAccess := dnsTLSAccess(&data.tlsConfigSettings)
	panelAccess := panelTLSAccess(&data.tlsConfigSettings)

	dnsPathPairs, err := normalizedCertificateKeyPairsForAccess(dnsAccess)
	if err != nil {
		return data, err
	}

	panelPathPairs, err := normalizedCertificateKeyPairsForAccess(panelAccess)
	if err != nil {
		return data, err
	}

	if data.CertificateChain != "" && len(dnsPathPairs) > 0 {
		return data, fmt.Errorf("certificate data and file can't be set together")
	}

	if data.PrivateKey != "" && len(dnsPathPairs) > 0 {
		return data, fmt.Errorf("private key data and file can't be set together")
	}

	if data.PanelCertificateChain != "" && len(panelPathPairs) > 0 {
		return data, fmt.Errorf("panel certificate data and file can't be set together")
	}

	if data.PanelPrivateKey != "" && len(panelPathPairs) > 0 {
		return data, fmt.Errorf("panel private key data and file can't be set together")
	}

	setManualCertificateKeyPairs(dnsAccess, dnsPathPairs)
	setManualCertificateKeyPairs(panelAccess, panelPathPairs)
	err = normalizeTLSSettings(&data.tlsConfigSettings)
	if err != nil {
		return data, err
	}

	return data, nil
}

// marshalTLS encodes sensitive fields and writes data as JSON.  All arguments
// must not be nil.
func (m *tlsManager) marshalTLS(
	ctx context.Context,
	w http.ResponseWriter,
	r *http.Request,
	data *tlsConfig,
) {
	if data.CertificateChain != "" {
		encoded := base64.StdEncoding.EncodeToString([]byte(data.CertificateChain))
		data.CertificateChain = encoded
	}

	if data.PanelCertificateChain != "" {
		encoded := base64.StdEncoding.EncodeToString([]byte(data.PanelCertificateChain))
		data.PanelCertificateChain = encoded
	}

	if data.PrivateKey != "" {
		data.PrivateKeySaved = true
		data.PrivateKey = ""
	}

	if data.PanelPrivateKey != "" {
		data.PanelPrivateKeySaved = true
		data.PanelPrivateKey = ""
	}

	aghhttp.WriteJSONResponseOK(ctx, m.logger, w, r, *data)
}

// registerWebHandlers registers HTTP handlers for TLS configuration.
func (m *tlsManager) registerWebHandlers() {
	m.httpReg.Register(http.MethodGet, "/control/tls/status", m.handleTLSStatus)
	m.httpReg.Register(http.MethodPost, "/control/tls/configure", m.handleTLSConfigure)
	m.httpReg.Register(http.MethodPost, "/control/tls/validate", m.handleTLSValidate)
}

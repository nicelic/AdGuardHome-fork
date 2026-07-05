package home

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"math/big"
	"net"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/nicelic/AdGuardHome-fork/internal/agh"
	"github.com/nicelic/AdGuardHome-fork/internal/aghalg"
	"github.com/nicelic/AdGuardHome-fork/internal/aghtls"
	"github.com/nicelic/AdGuardHome-fork/internal/client"
	"github.com/nicelic/AdGuardHome-fork/internal/dnsforward"
	"github.com/AdguardTeam/golibs/netutil"
	"github.com/AdguardTeam/golibs/testutil"
	"github.com/AdguardTeam/golibs/timeutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Paths to the test TLS-related data.
const (
	testCertificatePath = "./testdata/cert.pem"
	testPrivateKeyPath  = "./testdata/key.pem"
)

func TestValidateCertificates(t *testing.T) {
	ctx := testutil.ContextWithTimeout(t, testTimeout)

	m, err := newTLSManager(ctx, &tlsManagerConfig{
		logger:        testLogger,
		confModifier:  agh.EmptyConfigModifier{},
		manager:       aghtls.EmptyManager{},
		servePlainDNS: false,
	})
	require.NoError(t, err)

	t.Run("bad_certificate", func(t *testing.T) {
		status := &tlsConfigStatus{}
		err = m.validateCertificates(ctx, status, []byte("bad cert"), nil, nil)
		testutil.AssertErrorMsg(t, "empty certificate", err)
		assert.False(t, status.ValidCert)
		assert.False(t, status.ValidChain)
	})

	t.Run("bad_private_key", func(t *testing.T) {
		status := &tlsConfigStatus{}
		err = m.validateCertificates(ctx, status, nil, []byte("bad priv key"), nil)
		testutil.AssertErrorMsg(t, "no valid keys were found", err)
		assert.False(t, status.ValidKey)
	})

	t.Run("valid", func(t *testing.T) {
		status := &tlsConfigStatus{}

		testCertChainData := requireReadFile(t, testCertificatePath)
		testPrivateKeyData := requireReadFile(t, testPrivateKeyPath)

		err = m.validateCertificates(ctx, status, testCertChainData, testPrivateKeyData, nil)
		assert.Error(t, err)

		notBefore := time.Date(2019, 2, 27, 9, 24, 23, 0, time.UTC)
		notAfter := time.Date(2046, 7, 14, 9, 24, 23, 0, time.UTC)

		assert.True(t, status.ValidCert)
		assert.False(t, status.ValidChain)
		assert.True(t, status.ValidKey)
		assert.Equal(t, "RSA", status.KeyType)
		assert.Equal(t, "CN=AdGuard Home,O=AdGuard Ltd", status.Subject)
		assert.Equal(t, "CN=AdGuard Home,O=AdGuard Ltd", status.Issuer)
		assert.Equal(t, notBefore, status.NotBefore)
		assert.Equal(t, notAfter, status.NotAfter)
		assert.True(t, status.ValidPair)
	})

	t.Run("no_ip_in_cert", func(t *testing.T) {
		caCert, chainPEM, leafKeyPEM := newCertWithoutIP(t)

		m.rootCerts = x509.NewCertPool()
		m.rootCerts.AddCert(caCert)

		status := &tlsConfigStatus{}
		var ok bool
		ok, err = m.validateCertificate(ctx, status, chainPEM, nil)
		assert.True(t, ok)
		assert.ErrorIs(t, err, errNoIPInCert)
		assert.True(t, status.ValidCert)
		assert.True(t, status.ValidChain)

		status = &tlsConfigStatus{}
		err = m.validateCertificates(ctx, status, chainPEM, leafKeyPEM, nil)
		assert.ErrorIs(t, err, errNoIPInCert)
		assert.True(t, status.ValidCert)
		assert.True(t, status.ValidChain)
		assert.True(t, status.ValidKey)
		assert.True(t, status.ValidPair)
	})
}

// newCertWithoutIP generates a CA certificate, a leaf certificate without an IP
// address, and the PEM-encoded leaf private key.
func newCertWithoutIP(tb testing.TB) (
	caCert *x509.Certificate,
	chainPEM []byte,
	leafKeyPEM []byte,
) {
	tb.Helper()

	caKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(tb, err)

	now := time.Now()
	caTmpl := &x509.Certificate{
		SerialNumber:          big.NewInt(1),
		NotBefore:             now.Add(-time.Hour),
		NotAfter:              now.Add(time.Hour),
		IsCA:                  true,
		BasicConstraintsValid: true,
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageCRLSign,
	}

	caDER, err := x509.CreateCertificate(rand.Reader, caTmpl, caTmpl, &caKey.PublicKey, caKey)
	require.NoError(tb, err)

	caCert, err = x509.ParseCertificate(caDER)
	require.NoError(tb, err)

	leafKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(tb, err)

	leafTmpl := &x509.Certificate{
		SerialNumber: big.NewInt(2),
		NotBefore:    now.Add(-time.Hour),
		NotAfter:     now.Add(time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature,
	}

	leafDER, err := x509.CreateCertificate(
		rand.Reader,
		leafTmpl,
		caTmpl,
		&leafKey.PublicKey,
		caKey,
	)
	require.NoError(tb, err)

	buf := bytes.Buffer{}
	err = pem.Encode(&buf, &pem.Block{Type: "CERTIFICATE", Bytes: leafDER})
	require.NoError(tb, err)

	err = pem.Encode(&buf, &pem.Block{Type: "CERTIFICATE", Bytes: caDER})
	require.NoError(tb, err)

	leafKeyPEM = pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(leafKey),
	})

	return caCert, buf.Bytes(), leafKeyPEM
}

// newCertAndKey is a helper function that generates certificate and key.
func newCertAndKey(tb testing.TB, n int64) (certDER []byte, key *rsa.PrivateKey) {
	tb.Helper()

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(tb, err)

	certTmpl := &x509.Certificate{
		SerialNumber: big.NewInt(n),
	}

	certDER, err = x509.CreateCertificate(rand.Reader, certTmpl, certTmpl, &key.PublicKey, key)
	require.NoError(tb, err)

	return certDER, key
}

// writeCertAndKey is a helper function that writes certificate and key to
// specified paths.  key must not be nil.
func writeCertAndKey(
	tb testing.TB,
	certDER []byte,
	certPath string,
	key *rsa.PrivateKey,
	keyPath string,
) {
	tb.Helper()

	certFile, err := os.OpenFile(certPath, os.O_WRONLY|os.O_CREATE, 0o600)
	require.NoError(tb, err)

	defer func() {
		err = certFile.Close()
		require.NoError(tb, err)
	}()

	err = pem.Encode(certFile, &pem.Block{Type: "CERTIFICATE", Bytes: certDER})
	require.NoError(tb, err)

	keyFile, err := os.OpenFile(keyPath, os.O_WRONLY|os.O_CREATE, 0o600)
	require.NoError(tb, err)

	defer func() {
		err = keyFile.Close()
		require.NoError(tb, err)
	}()

	err = pem.Encode(keyFile, &pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(key),
	})
	require.NoError(tb, err)
}

// writeTLSCertificatePair writes a TLS certificate chain and RSA private key to
// PEM files.
func writeTLSCertificatePair(tb testing.TB, cert tls.Certificate, certPath string, keyPath string) {
	tb.Helper()

	certFile, err := os.OpenFile(certPath, os.O_WRONLY|os.O_CREATE, 0o600)
	require.NoError(tb, err)

	defer func() {
		err = certFile.Close()
		require.NoError(tb, err)
	}()

	for _, der := range cert.Certificate {
		err = pem.Encode(certFile, &pem.Block{Type: "CERTIFICATE", Bytes: der})
		require.NoError(tb, err)
	}

	privateKey := testutil.RequireTypeAssert[*rsa.PrivateKey](tb, cert.PrivateKey)

	keyFile, err := os.OpenFile(keyPath, os.O_WRONLY|os.O_CREATE, 0o600)
	require.NoError(tb, err)

	defer func() {
		err = keyFile.Close()
		require.NoError(tb, err)
	}()

	err = pem.Encode(keyFile, &pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(privateKey),
	})
	require.NoError(tb, err)
}

// assertCertSerialNumber is a helper function that checks serial number of the
// TLS certificate.
func assertCertSerialNumber(tb testing.TB, conf *tlsConfigSettings, wantSN int64) {
	tb.Helper()

	cert, err := tls.X509KeyPair(conf.CertificateChainData, conf.PrivateKeyData)
	require.NoError(tb, err)

	assert.Equal(tb, wantSN, cert.Leaf.SerialNumber.Int64())
}

func TestTLSManager_Reload(t *testing.T) {
	storeGlobals(t)

	config.DNS.Port = 0

	var (
		ctx = testutil.ContextWithTimeout(t, testTimeout)
		err error
	)

	globalContext.dnsServer, err = dnsforward.NewServer(dnsforward.DNSCreateParams{
		Logger: testLogger,
	})
	require.NoError(t, err)

	globalContext.clients.storage, err = client.NewStorage(ctx, &client.StorageConfig{
		BaseLogger: testLogger,
		Logger:     testLogger,
		Clock:      timeutil.SystemClock{},
	})
	require.NoError(t, err)

	const (
		snBefore int64 = 1
		snAfter  int64 = 2
	)

	tmpDir := t.TempDir()
	certPath := filepath.Join(tmpDir, "cert.pem")
	keyPath := filepath.Join(tmpDir, "key.pem")

	certDER, key := newCertAndKey(t, snBefore)
	writeCertAndKey(t, certDER, certPath, key, keyPath)

	m, err := newTLSManager(ctx, &tlsManagerConfig{
		logger:       testLogger,
		confModifier: agh.EmptyConfigModifier{},
		manager:      aghtls.EmptyManager{},
		tlsSettings: tlsConfigSettings{
			Enabled:         true,
			CertificatePath: certPath,
			PrivateKeyPath:  keyPath,
		},
		servePlainDNS: false,
	})
	require.NoError(t, err)

	web := newTestWeb(t, &webConfig{})
	m.setWebAPI(web)

	extTLSConf := m.extendedTLSConfig()
	assertCertSerialNumber(t, extTLSConf, snBefore)

	certDER, key = newCertAndKey(t, snAfter)
	writeCertAndKey(t, certDER, certPath, key, keyPath)

	m.reload(ctx)

	// The [tlsManager.reload] method will start the DNS server and it should be
	// stopped after the test ends.
	testutil.CleanupAndRequireSuccess(t, func() (err error) {
		return globalContext.dnsServer.Stop(testutil.ContextWithTimeout(t, testTimeout))
	})

	extTLSConf = m.extendedTLSConfig()
	assertCertSerialNumber(t, extTLSConf, snAfter)
}

func TestTLSManager_LoadTLSConfig_LegacySharedModeMirrorsDNSCertificatesToPanel(t *testing.T) {
	ctx := testutil.ContextWithTimeout(t, testTimeout)

	m, err := newTLSManager(ctx, &tlsManagerConfig{
		logger:       testLogger,
		confModifier: agh.EmptyConfigModifier{},
		manager:      aghtls.EmptyManager{},
		tlsSettings: tlsConfigSettings{
			Enabled:         true,
			PortHTTPS:       4433,
			CertificatePath: testCertificatePath,
			PrivateKeyPath:  testPrivateKeyPath,
		},
		servePlainDNS: true,
	})
	require.NoError(t, err)

	extTLSConf := m.extendedTLSConfig()
	assert.Equal(t, testCertificatePath, extTLSConf.PanelCertificatePath)
	assert.Equal(t, testPrivateKeyPath, extTLSConf.PanelPrivateKeyPath)
	require.Len(t, extTLSConf.Certificates, 1)
	require.Len(t, extTLSConf.PanelCertificates, 1)
}

func TestTLSManager_HandleTLSStatus(t *testing.T) {
	var (
		ctx = testutil.ContextWithTimeout(t, testTimeout)
		err error
	)

	testCertChain := requireReadFile(t, testCertificatePath)
	testPrivateKeyData := requireReadFile(t, testPrivateKeyPath)

	m, err := newTLSManager(ctx, &tlsManagerConfig{
		logger:       testLogger,
		confModifier: agh.EmptyConfigModifier{},
		manager:      aghtls.EmptyManager{},
		tlsSettings: tlsConfigSettings{
			Enabled:          true,
			CertificateChain: string(testCertChain),
			PrivateKey:       string(testPrivateKeyData),
		},
		servePlainDNS: false,
	})
	require.NoError(t, err)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/control/tls/status", nil)
	m.handleTLSStatus(w, r)

	res := &tlsConfigSettingsExt{}
	err = json.NewDecoder(w.Body).Decode(res)
	require.NoError(t, err)

	wantCertificateChain := base64.StdEncoding.EncodeToString(testCertChain)
	assert.True(t, res.Enabled)
	assert.Equal(t, wantCertificateChain, res.CertificateChain)
	assert.True(t, res.PrivateKeySaved)
}

func TestValidateTLSSettings(t *testing.T) {
	storeGlobals(t)

	var (
		ctx = testutil.ContextWithTimeout(t, testTimeout)
		err error
	)

	m, err := newTLSManager(ctx, &tlsManagerConfig{
		logger:        testLogger,
		confModifier:  agh.EmptyConfigModifier{},
		manager:       aghtls.EmptyManager{},
		servePlainDNS: false,
	})
	require.NoError(t, err)

	web := newTestWeb(t, &webConfig{})
	m.setWebAPI(web)

	tcpLn, err := net.Listen("tcp", ":0")
	require.NoError(t, err)

	testutil.CleanupAndRequireSuccess(t, tcpLn.Close)

	tcpAddr := testutil.RequireTypeAssert[*net.TCPAddr](t, tcpLn.Addr())
	busyTCPPort := tcpAddr.Port

	udpLn, err := net.ListenPacket("udp", ":0")
	require.NoError(t, err)

	testutil.CleanupAndRequireSuccess(t, udpLn.Close)

	udpAddr := testutil.RequireTypeAssert[*net.UDPAddr](t, udpLn.LocalAddr())
	busyUDPPort := udpAddr.Port

	testCases := []struct {
		name    string
		wantErr string
		setts   tlsConfigSettingsExt
	}{{
		name:    "basic",
		wantErr: "",
		setts:   tlsConfigSettingsExt{},
	}, {
		name:    "disabled_all",
		wantErr: "plain DNS is required in case encryption protocols are disabled",
		setts: tlsConfigSettingsExt{
			ServePlainDNS: aghalg.NBFalse,
		},
	}, {
		name:    "plain_dns_disabled_without_encrypted_dns",
		wantErr: "at least one encrypted DNS protocol must be enabled when plain DNS is disabled",
		setts: tlsConfigSettingsExt{
			tlsConfigSettings: tlsConfigSettings{
				Enabled: true,
			},
			ServePlainDNS: aghalg.NBFalse,
		},
	}, {
		name:    "missing_panel_port",
		wantErr: "面板 HTTPS 端口必须单独设置，不能与 DNS 加密共用端口",
		setts: tlsConfigSettingsExt{
			tlsConfigSettings: tlsConfigSettings{
				Enabled:   true,
				PortHTTPS: 4433,
			},
		},
	}, {
		name:    "busy_panel_https_port",
		wantErr: fmt.Sprintf("port %d for Panel HTTPS is not available", busyTCPPort),
		setts: tlsConfigSettingsExt{
			tlsConfigSettings: tlsConfigSettings{
				Enabled:         true,
				PanelServerPort: uint16(busyTCPPort),
			},
		},
	}, {
		name:    "busy_dot_port",
		wantErr: fmt.Sprintf("port %d for DNS-over-TLS is not available", busyTCPPort),
		setts: tlsConfigSettingsExt{
			tlsConfigSettings: tlsConfigSettings{
				Enabled:         true,
				PanelServerPort: 8443,
				PortDNSOverTLS:  uint16(busyTCPPort),
			},
		},
	}, {
		name:    "busy_doq_port",
		wantErr: fmt.Sprintf("port %d for DNS-over-QUIC is not available", busyUDPPort),
		setts: tlsConfigSettingsExt{
			tlsConfigSettings: tlsConfigSettings{
				Enabled:         true,
				PanelServerPort: 8443,
				PortDNSOverQUIC: uint16(busyUDPPort),
			},
		},
	}, {
		name:    "duplicate_port",
		wantErr: "validating tcp ports: duplicated values: [4433]",
		setts: tlsConfigSettingsExt{
			tlsConfigSettings: tlsConfigSettings{
				Enabled:         true,
				PanelServerPort: 8443,
				PortHTTPS:       4433,
				PortDNSOverTLS:  4433,
			},
		},
	}}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err = m.validateTLSSettings(tc.setts)
			testutil.AssertErrorMsg(t, tc.wantErr, err)
		})
	}
}

func TestNormalizeTLSSettings(t *testing.T) {
	conf := &tlsConfigSettings{
		ServerName:          " *.dns.example.org ",
		PanelServerName:     " panel.example.org ",
		PanelServerURLPath:  "myui/",
		DNSOverHTTPSURLPath: "dns-query/custom/",
		PortHTTPS:           defaultPortHTTPS,
		PortDNSOverTLS:      defaultPortTLS,
		PortDNSOverQUIC:     defaultPortQUIC,
	}

	err := normalizeTLSSettings(conf)
	require.NoError(t, err)

	assert.Equal(t, "*.dns.example.org", conf.ServerName)
	assert.Equal(t, "panel.example.org", conf.PanelServerName)
	assert.Equal(t, "/myui", conf.PanelServerURLPath)
	assert.Equal(t, "/dns-query/custom", conf.DNSOverHTTPSURLPath)
}

func TestTLSManager_HandleTLSValidate(t *testing.T) {
	storeGlobals(t)

	var (
		ctx = testutil.ContextWithTimeout(t, testTimeout)
		err error
	)

	m, err := newTLSManager(ctx, &tlsManagerConfig{
		logger:       testLogger,
		confModifier: agh.EmptyConfigModifier{},
		manager:      aghtls.EmptyManager{},
		tlsSettings: tlsConfigSettings{
			Enabled:         true,
			CertificatePath: testCertificatePath,
			PrivateKeyPath:  testPrivateKeyPath,
		},
		servePlainDNS: false,
	})
	require.NoError(t, err)

	web := newTestWeb(t, &webConfig{})
	m.setWebAPI(web)

	setts := &tlsConfigSettingsExt{
		tlsConfigSettings: tlsConfigSettings{
			Enabled:              true,
			PortHTTPS:            4433,
			PanelServerPort:      8443,
			CertificatePath:      testCertificatePath,
			PrivateKeyPath:       testPrivateKeyPath,
			PanelCertificatePath: testCertificatePath,
			PanelPrivateKeyPath:  testPrivateKeyPath,
		},
	}

	req, err := json.Marshal(setts)
	require.NoError(t, err)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPost, "/control/tls/validate", bytes.NewReader(req))
	m.handleTLSValidate(w, r)

	res := &tlsConfigStatus{}
	err = json.NewDecoder(w.Body).Decode(res)
	require.NoError(t, err)

	testCertChainData := requireReadFile(t, testCertificatePath)
	testPrivateKeyData := requireReadFile(t, testPrivateKeyPath)

	cert, err := tls.X509KeyPair(testCertChainData, testPrivateKeyData)
	require.NoError(t, err)

	wantIssuer := cert.Leaf.Issuer.String()
	assert.Equal(t, wantIssuer, res.Issuer)
}

func TestTLSManager_HandleTLSValidate_MultiPathPairs(t *testing.T) {
	storeGlobals(t)

	ctx := testutil.ContextWithTimeout(t, testTimeout)

	tmpDir := t.TempDir()
	certPath := filepath.Join(tmpDir, "cert-2.pem")
	keyPath := filepath.Join(tmpDir, "key-2.pem")

	certDER, key := newCertAndKey(t, 2)
	writeCertAndKey(t, certDER, certPath, key, keyPath)

	m, err := newTLSManager(ctx, &tlsManagerConfig{
		logger:        testLogger,
		confModifier:  agh.EmptyConfigModifier{},
		manager:       aghtls.EmptyManager{},
		servePlainDNS: false,
	})
	require.NoError(t, err)

	web := newTestWeb(t, &webConfig{})
	m.setWebAPI(web)

	setts := &tlsConfigSettingsExt{
		tlsConfigSettings: tlsConfigSettings{
			Enabled:         true,
			PortHTTPS:       4433,
			PanelServerPort: 8443,
			CertificateKeyPairs: []tlsCertificateKeyPair{{
				CertificatePath: testCertificatePath,
				PrivateKeyPath:  testPrivateKeyPath,
			}, {
				CertificatePath: certPath,
				PrivateKeyPath:  keyPath,
			}},
			PanelCertificateKeyPairs: []tlsCertificateKeyPair{{
				CertificatePath: testCertificatePath,
				PrivateKeyPath:  testPrivateKeyPath,
			}, {
				CertificatePath: certPath,
				PrivateKeyPath:  keyPath,
			}},
		},
	}

	req, err := json.Marshal(setts)
	require.NoError(t, err)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPost, "/control/tls/validate", bytes.NewReader(req))
	m.handleTLSValidate(w, r)

	res := &tlsConfig{
		tlsConfigStatus: &tlsConfigStatus{},
	}
	err = json.NewDecoder(w.Body).Decode(res)
	require.NoError(t, err)

	require.Len(t, res.CertificateKeyPairStatuses, 2)
	assert.True(t, res.CertificateKeyPairStatuses[0].ValidPair)
	assert.True(t, res.CertificateKeyPairStatuses[1].ValidPair)
	assert.Len(t, res.CertificateKeyPairs, 2)
}

func TestTLSManager_LoadTLSConfig_CertificateCoverage(t *testing.T) {
	ctx := testutil.ContextWithTimeout(t, testTimeout)

	m, err := newTLSManager(ctx, &tlsManagerConfig{
		logger:        testLogger,
		confModifier:  agh.EmptyConfigModifier{},
		manager:       aghtls.EmptyManager{},
		servePlainDNS: false,
	})
	require.NoError(t, err)

	t.Run("missing_service_name_coverage", func(t *testing.T) {
		tmpDir := t.TempDir()
		certPath := filepath.Join(tmpDir, "panel-cert.pem")
		keyPath := filepath.Join(tmpDir, "panel-key.pem")

		writeTLSCertificatePair(
			t,
			createNamedTLSCertificate(t, "panel.example.org"),
			certPath,
			keyPath,
		)

		status := &tlsConfigStatus{}
		setts := &tlsConfigSettings{
			Enabled:              true,
			PanelServerName:      "panel.example.org",
			ServerName:           "dns.example.org",
			PortHTTPS:            4433,
			PanelServerPort:      8443,
			CertificatePath:      certPath,
			PrivateKeyPath:       keyPath,
			PanelCertificatePath: certPath,
			PanelPrivateKeyPath:  keyPath,
		}

		err = m.loadTLSConfig(ctx, setts, status, &tlsConfigStatus{})
		require.Error(t, err)
		assert.ErrorContains(t, err, "dns.example.org")
		assert.False(t, status.CanApply)
		assert.True(t, status.ValidCert)
		assert.True(t, status.ValidKey)
		assert.True(t, status.ValidPair)
		assert.Contains(t, status.WarningValidation, "dns.example.org")
	})

	t.Run("separate_certificate_sets_cover_all_services", func(t *testing.T) {
		tmpDir := t.TempDir()
		panelCertPath := filepath.Join(tmpDir, "panel-cert.pem")
		panelKeyPath := filepath.Join(tmpDir, "panel-key.pem")
		dnsCertPath := filepath.Join(tmpDir, "dns-cert.pem")
		dnsKeyPath := filepath.Join(tmpDir, "dns-key.pem")

		writeTLSCertificatePair(
			t,
			createNamedTLSCertificate(t, "panel.example.org"),
			panelCertPath,
			panelKeyPath,
		)
		writeTLSCertificatePair(
			t,
			createNamedTLSCertificate(t, "dns.example.org"),
			dnsCertPath,
			dnsKeyPath,
		)

		status := &tlsConfigStatus{}
		setts := &tlsConfigSettings{
			Enabled:         true,
			PanelServerName: "panel.example.org",
			ServerName:      "dns.example.org",
			PortHTTPS:       4433,
			PanelServerPort: 8443,
			CertificateKeyPairs: []tlsCertificateKeyPair{{
				CertificatePath: dnsCertPath,
				PrivateKeyPath:  dnsKeyPath,
			}},
			PanelCertificateKeyPairs: []tlsCertificateKeyPair{{
				CertificatePath: panelCertPath,
				PrivateKeyPath:  panelKeyPath,
			}},
		}

		err = m.loadTLSConfig(ctx, setts, status, &tlsConfigStatus{})
		require.NoError(t, err)
		assert.True(t, status.CanApply)
		require.Len(t, setts.Certificates, 1)
		require.Len(t, setts.PanelCertificates, 1)
		assert.NotContains(t, status.WarningValidation, "configured server names are not covered")
	})
}

func TestTLSManager_HandleTLSConfigure_CertificateCoverageError(t *testing.T) {
	ctx := testutil.ContextWithTimeout(t, testTimeout)

	m, err := newTLSManager(ctx, &tlsManagerConfig{
		logger:        testLogger,
		confModifier:  agh.EmptyConfigModifier{},
		manager:       aghtls.EmptyManager{},
		servePlainDNS: true,
	})
	require.NoError(t, err)

	tmpDir := t.TempDir()
	certPath := filepath.Join(tmpDir, "panel-cert.pem")
	keyPath := filepath.Join(tmpDir, "panel-key.pem")

	writeTLSCertificatePair(
		t,
		createNamedTLSCertificate(t, "panel.example.org"),
		certPath,
		keyPath,
	)

	reqBody, err := json.Marshal(&tlsConfigSettingsExt{
		tlsConfigSettings: tlsConfigSettings{
			Enabled:              true,
			PanelServerName:      "panel.example.org",
			ServerName:           "dns.example.org",
			PortHTTPS:            4433,
			PanelServerPort:      8443,
			CertificatePath:      certPath,
			PrivateKeyPath:       keyPath,
			PanelCertificatePath: certPath,
			PanelPrivateKeyPath:  keyPath,
		},
	})
	require.NoError(t, err)

	r := httptest.NewRequest(http.MethodPost, "/control/tls/configure", bytes.NewReader(reqBody))
	w := httptest.NewRecorder()

	m.handleTLSConfigure(w, r)

	resp := w.Result()
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)

	body := w.Body.String()
	assert.Contains(t, body, "configured server names are not covered")
	assert.Contains(t, body, "dns.example.org")
}

func TestTLSManager_HandleTLSConfigure(t *testing.T) {
	// Store the global state before making any changes.
	storeGlobals(t)

	var (
		ctx = testutil.ContextWithTimeout(t, testTimeout)
		err error
	)

	globalContext.dnsServer, err = dnsforward.NewServer(dnsforward.DNSCreateParams{
		Logger: testLogger,
	})
	require.NoError(t, err)

	err = globalContext.dnsServer.Prepare(
		testutil.ContextWithTimeout(t, testTimeout),
		&dnsforward.ServerConfig{
			TLSConf: &dnsforward.TLSConfig{},
			Config: dnsforward.Config{
				UpstreamMode:     dnsforward.UpstreamModeLoadBalance,
				EDNSClientSubnet: &dnsforward.EDNSClientSubnet{Enabled: false},
				ClientsContainer: dnsforward.EmptyClientsContainer{},
			},
			ServePlainDNS: true,
		})
	require.NoError(t, err)

	globalContext.clients.storage, err = client.NewStorage(ctx, &client.StorageConfig{
		BaseLogger: testLogger,
		Logger:     testLogger,
		Clock:      timeutil.SystemClock{},
	})
	require.NoError(t, err)

	config.DNS.BindHosts = []netip.Addr{netutil.IPv4Localhost()}
	config.DNS.Port = 0

	const wantSerialNumber int64 = 1

	// Prepare the TLS manager configuration.
	tmpDir := t.TempDir()
	certPath := filepath.Join(tmpDir, "cert.pem")
	keyPath := filepath.Join(tmpDir, "key.pem")

	certDER, key := newCertAndKey(t, wantSerialNumber)
	writeCertAndKey(t, certDER, certPath, key, keyPath)

	// Initialize the TLS manager and assert its configuration.
	m, err := newTLSManager(ctx, &tlsManagerConfig{
		logger:       testLogger,
		confModifier: agh.EmptyConfigModifier{},
		manager:      aghtls.EmptyManager{},
		tlsSettings: tlsConfigSettings{
			Enabled:         true,
			CertificatePath: certPath,
			PrivateKeyPath:  keyPath,
		},
		servePlainDNS: true,
	})
	require.NoError(t, err)

	web := newTestWeb(t, &webConfig{})
	m.setWebAPI(web)

	extTLSConf := m.extendedTLSConfig()
	assertCertSerialNumber(t, extTLSConf, wantSerialNumber)

	// Prepare a request with the new TLS configuration.
	setts := &tlsConfigSettingsExt{
		tlsConfigSettings: tlsConfigSettings{
			Enabled:              true,
			PortHTTPS:            4433,
			PanelServerPort:      8443,
			CertificatePath:      testCertificatePath,
			PrivateKeyPath:       testPrivateKeyPath,
			PanelCertificatePath: testCertificatePath,
			PanelPrivateKeyPath:  testPrivateKeyPath,
		},
	}

	req, err := json.Marshal(setts)
	require.NoError(t, err)

	r := httptest.NewRequest(http.MethodPost, "/control/tls/configure", bytes.NewReader(req))
	w := httptest.NewRecorder()

	// Reconfigure the TLS manager.
	m.handleTLSConfigure(w, r)

	// The [tlsManager.handleTLSConfigure] method will start the DNS server and
	// it should be stopped after the test ends.
	testutil.CleanupAndRequireSuccess(t, func() (err error) {
		return globalContext.dnsServer.Stop(testutil.ContextWithTimeout(t, testTimeout))
	})

	res := &tlsConfig{
		tlsConfigStatus: &tlsConfigStatus{},
	}

	err = json.NewDecoder(w.Body).Decode(res)
	require.NoError(t, err)

	testCertChainData := requireReadFile(t, testCertificatePath)
	testPrivateKeyData := requireReadFile(t, testPrivateKeyPath)

	cert, err := tls.X509KeyPair(testCertChainData, testPrivateKeyData)
	require.NoError(t, err)

	wantIssuer := cert.Leaf.Issuer.String()
	assert.Equal(t, wantIssuer, res.tlsConfigStatus.Issuer)

	// Assert that the Web API's TLS configuration has been updated.
	//
	// TODO(s.chzhen):  Remove when [httpsServer.cond] is removed.
	assert.Eventually(t, func() bool {
		web.httpsServer.condLock.Lock()
		defer web.httpsServer.condLock.Unlock()

		cert = web.httpsServer.cert
		if cert.Leaf == nil {
			return false
		}

		assert.Equal(t, wantIssuer, cert.Leaf.Issuer.String())

		return true
	}, testTimeout, testTimeout/10)
}

func TestTLSConfigSettings_setPrivateFieldsAndCompare_IgnoresRuntimeTLSData(t *testing.T) {
	current := &tlsConfigSettings{
		Enabled:                   true,
		CertificatePath:           "cert.pem",
		PrivateKeyPath:            "key.pem",
		PanelCertificatePath:      "panel-cert.pem",
		PanelPrivateKeyPath:       "panel-key.pem",
		CertificateChainData:      []byte("current cert data"),
		PrivateKeyData:            []byte("current key data"),
		PanelCertificateChainData: []byte("current panel cert data"),
		PanelPrivateKeyData:       []byte("current panel key data"),
		Certificates: []tls.Certificate{{
			Certificate: [][]byte{{1}},
		}},
		PanelCertificates: []tls.Certificate{{
			Certificate: [][]byte{{3}},
		}},
	}

	conf := tlsConfigSettings{
		Enabled:                   true,
		CertificatePath:           "cert.pem",
		PrivateKeyPath:            "key.pem",
		PanelCertificatePath:      "panel-cert.pem",
		PanelPrivateKeyPath:       "panel-key.pem",
		CertificateChainData:      []byte("new cert data"),
		PrivateKeyData:            []byte("new key data"),
		PanelCertificateChainData: []byte("new panel cert data"),
		PanelPrivateKeyData:       []byte("new panel key data"),
		Certificates: []tls.Certificate{{
			Certificate: [][]byte{{2}},
		}},
		PanelCertificates: []tls.Certificate{{
			Certificate: [][]byte{{4}},
		}},
	}

	assert.True(t, current.setPrivateFieldsAndCompare(&conf))
}

func TestTLSManager_HandleTLSConfigure_InheritsManagedAssignments(t *testing.T) {
	storeGlobals(t)

	var (
		ctx = testutil.ContextWithTimeout(t, testTimeout)
		err error
	)

	globalContext.dnsServer, err = dnsforward.NewServer(dnsforward.DNSCreateParams{
		Logger: testLogger,
	})
	require.NoError(t, err)

	err = globalContext.dnsServer.Prepare(
		testutil.ContextWithTimeout(t, testTimeout),
		&dnsforward.ServerConfig{
			TLSConf: &dnsforward.TLSConfig{},
			Config: dnsforward.Config{
				UpstreamMode:     dnsforward.UpstreamModeLoadBalance,
				EDNSClientSubnet: &dnsforward.EDNSClientSubnet{Enabled: false},
				ClientsContainer: dnsforward.EmptyClientsContainer{},
			},
			ServePlainDNS: true,
		},
	)
	require.NoError(t, err)

	globalContext.clients.storage, err = client.NewStorage(ctx, &client.StorageConfig{
		BaseLogger: testLogger,
		Logger:     testLogger,
		Clock:      timeutil.SystemClock{},
	})
	require.NoError(t, err)

	config.DNS.BindHosts = []netip.Addr{netutil.IPv4Localhost()}
	config.DNS.Port = 0

	certDir := t.TempDir()
	dnsManagedDir := filepath.Join(certDir, certManagerManagedFilesDirName, "1")
	panelManagedDir := filepath.Join(certDir, certManagerManagedFilesDirName, "2")
	require.NoError(t, os.MkdirAll(dnsManagedDir, 0o755))
	require.NoError(t, os.MkdirAll(panelManagedDir, 0o755))

	writeTLSCertificatePair(
		t,
		createNamedTLSCertificate(t, "dns.example.org"),
		filepath.Join(dnsManagedDir, "fullchain.pem"),
		filepath.Join(dnsManagedDir, "key.pem"),
	)
	writeTLSCertificatePair(
		t,
		createNamedTLSCertificate(t, "panel.example.org"),
		filepath.Join(panelManagedDir, "fullchain.pem"),
		filepath.Join(panelManagedDir, "key.pem"),
	)

	m, err := newTLSManager(ctx, &tlsManagerConfig{
		logger:       testLogger,
		confModifier: agh.EmptyConfigModifier{},
		manager:      aghtls.EmptyManager{},
		certDir:      certDir,
		tlsSettings: tlsConfigSettings{
			Enabled:                     true,
			ServerName:                  "dns.example.org",
			PanelServerName:             "panel.example.org",
			PortHTTPS:                   4443,
			PanelServerPort:             8443,
			DNSAssignedCertificateIDs:   []uint64{1},
			PanelAssignedCertificateIDs: []uint64{2},
		},
		servePlainDNS: true,
	})
	require.NoError(t, err)

	web := newTestWeb(t, &webConfig{})
	m.setWebAPI(web)

	reqBody, err := json.Marshal(&tlsConfigSettingsExt{
		tlsConfigSettings: tlsConfigSettings{
			Enabled:            true,
			ServerName:         "dns.example.org",
			PanelServerName:    "panel.example.org",
			PortHTTPS:          4443,
			PanelServerPort:    8443,
			PanelServerURLPath: "/myui",
		},
	})
	require.NoError(t, err)

	r := httptest.NewRequest(http.MethodPost, "/control/tls/configure", bytes.NewReader(reqBody))
	w := httptest.NewRecorder()

	m.handleTLSConfigure(w, r)

	testutil.CleanupAndRequireSuccess(t, func() (err error) {
		return globalContext.dnsServer.Stop(testutil.ContextWithTimeout(t, testTimeout))
	})

	resp := w.Result()
	require.Equal(t, http.StatusOK, resp.StatusCode, w.Body.String())

	res := &tlsConfig{
		tlsConfigStatus: &tlsConfigStatus{},
	}
	err = json.NewDecoder(w.Body).Decode(res)
	require.NoError(t, err)

	assert.Equal(t, []uint64{1}, res.DNSAssignedCertificateIDs)
	assert.Equal(t, []uint64{2}, res.PanelAssignedCertificateIDs)
	require.Len(t, res.CertificateKeyPairStatuses, 1)
	require.Len(t, res.PanelCertificateKeyPairStatuses, 1)
	assert.True(t, res.CertificateKeyPairStatuses[0].ValidPair)
	assert.True(t, res.PanelCertificateKeyPairStatuses[0].ValidPair)
}

func TestTLSManager_HandleTLSConfigure_MultiPathPairs(t *testing.T) {
	storeGlobals(t)

	var (
		ctx = testutil.ContextWithTimeout(t, testTimeout)
		err error
	)

	globalContext.dnsServer, err = dnsforward.NewServer(dnsforward.DNSCreateParams{
		Logger: testLogger,
	})
	require.NoError(t, err)

	err = globalContext.dnsServer.Prepare(
		testutil.ContextWithTimeout(t, testTimeout),
		&dnsforward.ServerConfig{
			TLSConf: &dnsforward.TLSConfig{},
			Config: dnsforward.Config{
				UpstreamMode:     dnsforward.UpstreamModeLoadBalance,
				EDNSClientSubnet: &dnsforward.EDNSClientSubnet{Enabled: false},
				ClientsContainer: dnsforward.EmptyClientsContainer{},
			},
			ServePlainDNS: true,
		},
	)
	require.NoError(t, err)

	globalContext.clients.storage, err = client.NewStorage(ctx, &client.StorageConfig{
		BaseLogger: testLogger,
		Logger:     testLogger,
		Clock:      timeutil.SystemClock{},
	})
	require.NoError(t, err)

	config.DNS.BindHosts = []netip.Addr{netutil.IPv4Localhost()}
	config.DNS.Port = 0

	tmpDir := t.TempDir()
	certPathOne := filepath.Join(tmpDir, "cert-1.pem")
	keyPathOne := filepath.Join(tmpDir, "key-1.pem")
	certPathTwo := filepath.Join(tmpDir, "cert-2.pem")
	keyPathTwo := filepath.Join(tmpDir, "key-2.pem")

	certDER, key := newCertAndKey(t, 1)
	writeCertAndKey(t, certDER, certPathOne, key, keyPathOne)

	certDER, key = newCertAndKey(t, 2)
	writeCertAndKey(t, certDER, certPathTwo, key, keyPathTwo)

	m, err := newTLSManager(ctx, &tlsManagerConfig{
		logger:        testLogger,
		confModifier:  agh.EmptyConfigModifier{},
		manager:       aghtls.EmptyManager{},
		servePlainDNS: true,
	})
	require.NoError(t, err)

	web := newTestWeb(t, &webConfig{})
	m.setWebAPI(web)

	setts := &tlsConfigSettingsExt{
		tlsConfigSettings: tlsConfigSettings{
			Enabled:         true,
			PortHTTPS:       4433,
			PanelServerPort: 8443,
			CertificateKeyPairs: []tlsCertificateKeyPair{{
				CertificatePath: certPathOne,
				PrivateKeyPath:  keyPathOne,
			}, {
				CertificatePath: certPathTwo,
				PrivateKeyPath:  keyPathTwo,
			}},
			PanelCertificateKeyPairs: []tlsCertificateKeyPair{{
				CertificatePath: certPathOne,
				PrivateKeyPath:  keyPathOne,
			}, {
				CertificatePath: certPathTwo,
				PrivateKeyPath:  keyPathTwo,
			}},
		},
	}

	req, err := json.Marshal(setts)
	require.NoError(t, err)

	r := httptest.NewRequest(http.MethodPost, "/control/tls/configure", bytes.NewReader(req))
	w := httptest.NewRecorder()

	m.handleTLSConfigure(w, r)

	testutil.CleanupAndRequireSuccess(t, func() (err error) {
		return globalContext.dnsServer.Stop(testutil.ContextWithTimeout(t, testTimeout))
	})

	res := &tlsConfig{
		tlsConfigStatus: &tlsConfigStatus{},
	}

	err = json.NewDecoder(w.Body).Decode(res)
	require.NoError(t, err)

	require.Len(t, res.CertificateKeyPairs, 2)
	require.Len(t, res.CertificateKeyPairStatuses, 2)
	assert.True(t, res.CertificateKeyPairStatuses[0].ValidPair)
	assert.True(t, res.CertificateKeyPairStatuses[1].ValidPair)

	assert.Eventually(t, func() bool {
		web.httpsServer.condLock.Lock()
		defer web.httpsServer.condLock.Unlock()

		if len(web.httpsServer.certs) != 2 {
			return false
		}

		gotFirst := web.httpsServer.certs[0].Leaf
		gotSecond := web.httpsServer.certs[1].Leaf
		if gotFirst == nil || gotSecond == nil {
			return false
		}

		assert.Equal(t, int64(1), gotFirst.SerialNumber.Int64())
		assert.Equal(t, int64(2), gotSecond.SerialNumber.Int64())

		return true
	}, testTimeout, testTimeout/10)
}

// requireReadFile reads the file at the specified path and returns its content.
//
// TODO(m.kazantsev):  Move to golibs/testutil.
func requireReadFile(tb testing.TB, path string) (data []byte) {
	tb.Helper()

	data, err := os.ReadFile(path)
	require.NoError(tb, err)

	return data
}

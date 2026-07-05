package home

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"log/slog"
	"math"
	"net/http"
	"net/netip"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/nicelic/AdGuardHome-fork/internal/aghalg"
	"github.com/nicelic/AdGuardHome-fork/internal/aghos"
	"go.etcd.io/bbolt"
)

const (
	certManagerBucketSettings     = "settings"
	certManagerBucketAcmeAccounts = "acme_accounts"
	certManagerBucketDNSAccounts  = "dns_accounts"
	certManagerBucketCertificates = "certificates"
	certManagerSettingsKey        = "settings"
	certManagerMaskedEnvValue     = "********"

	certManagerDBName              = "certificates.db"
	certManagerManagedFilesDirName = "files"
	certManagerDBOpenTimeout       = 1 * time.Second
	certManagerAutoRenewMinDays    = 1
	certManagerAutoRenewFixedDays  = 30
	certManagerAutoRenewCheckEvery = 1 * time.Hour

	certManagerDefaultPreferredCA = "letsencrypt"
	certManagerDefaultChallenge   = "standalone"
	certManagerDefaultKeyLength   = "ec-256"
	certManagerCertificateDomain  = "domain"
	certManagerCertificateIP      = "ip"
	certManagerMaxIPIdentifiers   = 100

	certManagerInstallScriptURL = "https://raw.githubusercontent.com/acmesh-official/acme.sh/master/acme.sh"
	certManagerGitHubReleases   = "https://api.github.com/repos/acmesh-official/acme.sh/releases"
	certManagerGitHubTags       = "https://api.github.com/repos/acmesh-official/acme.sh/tags"
)

var (
	certManagerCAOptions = []certificateManagerCAOption{
		{Name: "Let's Encrypt", Value: "letsencrypt"},
		{Name: "ZeroSSL", Value: "zerossl"},
	}

	certManagerDNSProviders = []certificateManagerDNSProviderMeta{
		{
			Name:         "阿里云",
			ProviderCode: "dns_ali",
			Helper:       "acme.sh 官方: dns_ali",
			Fields: []certificateManagerDNSFieldDef{
				{Key: "Ali_Key", Label: "Access Key", Required: true, Placeholder: "LTAIxxxxxxxxxxxxxxxx"},
				{Key: "Ali_Secret", Label: "Secret Key", Required: true, Placeholder: "请输入阿里云 Secret Key"},
			},
		},
		{
			Name:         "腾讯云 DNSPod",
			ProviderCode: "dns_tencent",
			Helper:       "acme.sh 官方: dns_tencent",
			Fields: []certificateManagerDNSFieldDef{
				{Key: "Tencent_SecretId", Label: "SecretId", Required: true, Placeholder: "AKIDxxxxxxxxxxxxxxxx"},
				{Key: "Tencent_SecretKey", Label: "SecretKey", Required: true, Placeholder: "请输入腾讯云 SecretKey"},
			},
		},
		{
			Name:         "Cloudflare",
			ProviderCode: "dns_cf",
			Helper:       "acme.sh 官方: dns_cf；支持 Token 模式（CF_Token + CF_Account_ID/CF_Zone_ID）或 Global Key 模式（CF_Email + CF_Key）",
			Fields: []certificateManagerDNSFieldDef{
				{Key: "CF_Token", Label: "API Token", Placeholder: "cf_xxxxxxxxxxxxxxxxxxxx"},
				{Key: "CF_Account_ID", Label: "Account ID（可选）", Placeholder: "可选，用于缩小授权范围"},
				{Key: "CF_Zone_ID", Label: "Zone ID（可选）", Placeholder: "可选，用于限制具体域名"},
				{Key: "CF_Email", Label: "Global API Email（可选）", Placeholder: "legacy@example.com"},
				{Key: "CF_Key", Label: "Global API Key（可选）", Placeholder: "请输入 Cloudflare Global API Key"},
			},
		},
		{
			Name:         "Amazon Route53",
			ProviderCode: "dns_aws",
			Helper:       "acme.sh 官方: dns_aws；支持静态 AK/SK，或留空 AK/SK 使用实例/容器 IAM Role",
			Fields: []certificateManagerDNSFieldDef{
				{Key: "AWS_ACCESS_KEY_ID", Label: "Access Key ID（可选）", Placeholder: "AKIAXXXXXXXXXXXXXXXX"},
				{Key: "AWS_SECRET_ACCESS_KEY", Label: "Secret Access Key（可选）", Placeholder: "请输入 AWS Secret Access Key"},
				{Key: "AWS_DNS_SLOWRATE", Label: "Slow Rate Seconds（可选）", Placeholder: "例如：10"},
			},
		},
		{
			Name:         "华为云",
			ProviderCode: "dns_huaweicloud",
			Helper:       "acme.sh 官方: dns_huaweicloud",
			Fields: []certificateManagerDNSFieldDef{
				{Key: "HUAWEICLOUD_Username", Label: "用户名", Required: true, Placeholder: "请输入华为云用户名"},
				{Key: "HUAWEICLOUD_Password", Label: "密码", Required: true, Placeholder: "请输入华为云密码"},
				{Key: "HUAWEICLOUD_DomainName", Label: "DomainName", Required: true, Placeholder: "例如：hw-example"},
			},
		},
		{
			Name:         "GoDaddy",
			ProviderCode: "dns_gd",
			Helper:       "acme.sh 官方: dns_gd",
			Fields: []certificateManagerDNSFieldDef{
				{Key: "GD_Key", Label: "API Key", Required: true, Placeholder: "请输入 GoDaddy API Key"},
				{Key: "GD_Secret", Label: "API Secret", Required: true, Placeholder: "请输入 GoDaddy API Secret"},
			},
		},
		{
			Name:         "Vercel",
			ProviderCode: "dns_vercel",
			Helper:       "acme.sh 官方: dns_vercel",
			Fields: []certificateManagerDNSFieldDef{
				{Key: "VERCEL_TOKEN", Label: "API Token", Required: true, Placeholder: "请输入 Vercel Token"},
			},
		},
	}
)

type certificateManagerService struct {
	logger   *slog.Logger
	workDir  string
	acmeDir  string
	certDir  string
	dbPath   string
	httpCli  *http.Client
	opMu     sync.Mutex
	autoAt   atomic.Int64
	autoBusy atomic.Bool
}

type certificateManagerRuntimeState struct {
	ScriptPath       string
	HomeDir          string
	Installed        bool
	ManagedInstalled bool
}

type certificateManagerOverview struct {
	Supported          bool                                `json:"supported"`
	Installed          bool                                `json:"installed"`
	ManagedInstalled   bool                                `json:"managedInstalled"`
	Version            string                              `json:"version"`
	ScriptPath         string                              `json:"scriptPath"`
	HomeDir            string                              `json:"homeDir"`
	ContactEmail       string                              `json:"contactEmail"`
	PreferredCA        string                              `json:"preferredCA"`
	DefaultChallenge   string                              `json:"defaultChallenge"`
	DefaultWebroot     string                              `json:"defaultWebroot"`
	DefaultDNSProvider string                              `json:"defaultDnsProvider"`
	DefaultKeyLength   string                              `json:"defaultKeyLength"`
	UpdateStatus       string                              `json:"updateStatus"`
	AutoUpgrade        bool                                `json:"autoUpgrade"`
	AutoRenewWindow    certificateManagerAutoRenewWindow   `json:"autoRenewWindow"`
	CAOptions          []certificateManagerCAOption        `json:"caOptions"`
	DNSProviders       []certificateManagerDNSProviderMeta `json:"dnsProviders"`
	AcmeAccounts       []certificateManagerAcmeAccountView `json:"acmeAccounts"`
	DNSAccounts        []certificateManagerDNSAccountView  `json:"dnsAccounts"`
	Certificates       []certificateManagerCertificateView `json:"certificates"`
}

type certificateManagerAutoRenewWindow struct {
	WindowDays          int   `json:"windowDays"`
	DynamicByValidity   bool  `json:"dynamicByValidity"`
	ThresholdDays       int   `json:"thresholdDays"`
	MinDynamicWindowDay int   `json:"minDynamicWindowDay"`
	Examples            []int `json:"examples"`
}

type certificateManagerCAOption struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type certificateManagerDNSProviderMeta struct {
	Name         string                          `json:"name"`
	ProviderCode string                          `json:"providerCode"`
	Helper       string                          `json:"helper"`
	Fields       []certificateManagerDNSFieldDef `json:"fields"`
}

type certificateManagerDNSFieldDef struct {
	Key         string `json:"key"`
	Label       string `json:"label"`
	Required    bool   `json:"required"`
	Placeholder string `json:"placeholder"`
}

type certificateManagerAcmeAccountView struct {
	ID        uint64 `json:"id"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	Server    string `json:"server"`
	KeyLength string `json:"keyLength"`
	Remark    string `json:"remark"`
	UpdatedAt int64  `json:"updatedAt"`
}

type certificateManagerDNSAccountView struct {
	ID           uint64            `json:"id"`
	Name         string            `json:"name"`
	ProviderName string            `json:"providerName"`
	ProviderCode string            `json:"providerCode"`
	Env          map[string]string `json:"env"`
	Remark       string            `json:"remark"`
	UpdatedAt    int64             `json:"updatedAt"`
}

type certificateManagerCertificateView struct {
	ID                       uint64   `json:"id"`
	DisplayID                uint64   `json:"displayId"`
	MainDomain               string   `json:"mainDomain"`
	Domains                  []string `json:"domains"`
	CertificateType          string   `json:"certificateType"`
	Challenge                string   `json:"challenge"`
	KeyLength                string   `json:"keyLength"`
	IssuedKeyAlgorithm       string   `json:"issuedKeyAlgorithm"`
	IssuedSignatureAlgorithm string   `json:"issuedSignatureAlgorithm"`
	CAServer                 string   `json:"caServer"`
	AcmeAccountID            uint64   `json:"acmeAccountId"`
	AcmeAccountName          string   `json:"acmeAccountName"`
	DNSAccountID             uint64   `json:"dnsAccountId"`
	DNSAccountName           string   `json:"dnsAccountName"`
	AutoRenew                bool     `json:"autoRenew"`
	Remark                   string   `json:"remark"`
	Webroot                  string   `json:"webroot"`
	DNSProvider              string   `json:"dnsProvider"`
	DNSEnvText               string   `json:"dnsEnvText"`
	CustomArgs               string   `json:"customArgs"`
	PushDir                  string   `json:"pushDir"`
	CertPath                 string   `json:"certPath"`
	KeyPath                  string   `json:"keyPath"`
	FullchainPath            string   `json:"fullchainPath"`
	ChainPath                string   `json:"chainPath"`
	Fingerprint              string   `json:"fingerprint"`
	NotBefore                int64    `json:"notBefore"`
	NotAfter                 int64    `json:"notAfter"`
	LastIssuedAt             int64    `json:"lastIssuedAt"`
	LastRenewedAt            int64    `json:"lastRenewedAt"`
	UpdatedAt                int64    `json:"updatedAt"`
	CreatedAt                int64    `json:"createdAt"`
	LastError                string   `json:"lastError"`
	LastOutput               string   `json:"lastOutput"`
	Status                   string   `json:"status"`
	StatusLabel              string   `json:"statusLabel"`
	StatusTone               string   `json:"statusTone"`
	ExpiresInDays            int      `json:"expiresInDays"`
	InUseByPanel             bool     `json:"inUseByPanel"`
	InUseByDNS               bool     `json:"inUseByDNS"`
	UsageLabel               string   `json:"usageLabel"`
}

type certificateManagerMaterialView struct {
	ID                       uint64 `json:"id"`
	MainDomain               string `json:"mainDomain"`
	CertPath                 string `json:"certPath"`
	KeyPath                  string `json:"keyPath"`
	FullchainPath            string `json:"fullchainPath"`
	ChainPath                string `json:"chainPath"`
	CertPEM                  string `json:"certPem"`
	KeyPEM                   string `json:"keyPem"`
	FullchainPEM             string `json:"fullchainPem"`
	ChainPEM                 string `json:"chainPem"`
	Fingerprint              string `json:"fingerprint"`
	IssuedKeyAlgorithm       string `json:"issuedKeyAlgorithm"`
	IssuedSignatureAlgorithm string `json:"issuedSignatureAlgorithm"`
}

type certificateManagerActionResult struct {
	Message string `json:"message"`
	Output  string `json:"output,omitempty"`
	ID      uint64 `json:"id,omitempty"`
}

type certificateManagerVersionItem struct {
	Version     string `json:"version"`
	DisplayName string `json:"displayName"`
	PublishedAt int64  `json:"publishedAt"`
}

type certificateManagerVersionListResult struct {
	Items   []certificateManagerVersionItem `json:"items"`
	Page    int                             `json:"page"`
	PerPage int                             `json:"perPage"`
	HasMore bool                            `json:"hasMore"`
}

type certificateManagerVersionCheckResult struct {
	Supported        bool   `json:"supported"`
	Installed        bool   `json:"installed"`
	ManagedInstalled bool   `json:"managedInstalled"`
	CurrentVersion   string `json:"currentVersion"`
	LatestVersion    string `json:"latestVersion"`
	HasUpdate        bool   `json:"hasUpdate"`
	Message          string `json:"message"`
	CheckedAt        int64  `json:"checkedAt"`
}

type certificateManagerSettings struct {
	ContactEmail       string `json:"contactEmail"`
	PreferredCA        string `json:"preferredCA"`
	DefaultChallenge   string `json:"defaultChallenge"`
	DefaultWebroot     string `json:"defaultWebroot"`
	DefaultDNSProvider string `json:"defaultDnsProvider"`
	DefaultKeyLength   string `json:"defaultKeyLength"`
	UpdateStatus       string `json:"updateStatus"`
	AutoUpgrade        bool   `json:"autoUpgrade"`
}

type certificateManagerAcmeAccount struct {
	ID        uint64 `json:"id"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	Server    string `json:"server"`
	KeyLength string `json:"keyLength"`
	Remark    string `json:"remark"`
	CreatedAt int64  `json:"createdAt"`
	UpdatedAt int64  `json:"updatedAt"`
}

type certificateManagerDNSAccount struct {
	ID           uint64            `json:"id"`
	Name         string            `json:"name"`
	ProviderName string            `json:"providerName"`
	ProviderCode string            `json:"providerCode"`
	Env          map[string]string `json:"env"`
	Remark       string            `json:"remark"`
	CreatedAt    int64             `json:"createdAt"`
	UpdatedAt    int64             `json:"updatedAt"`
}

type certificateManagerCertificate struct {
	ID                       uint64   `json:"id"`
	DisplayID                uint64   `json:"displayId"`
	MainDomain               string   `json:"mainDomain"`
	Domains                  []string `json:"domains"`
	CertificateType          string   `json:"certificateType"`
	Challenge                string   `json:"challenge"`
	KeyLength                string   `json:"keyLength"`
	IssuedKeyAlgorithm       string   `json:"issuedKeyAlgorithm"`
	IssuedSignatureAlgorithm string   `json:"issuedSignatureAlgorithm"`
	CAServer                 string   `json:"caServer"`
	AcmeAccountID            uint64   `json:"acmeAccountId"`
	AcmeAccountName          string   `json:"acmeAccountName"`
	DNSAccountID             uint64   `json:"dnsAccountId"`
	DNSAccountName           string   `json:"dnsAccountName"`
	AutoRenew                bool     `json:"autoRenew"`
	Remark                   string   `json:"remark"`
	Webroot                  string   `json:"webroot"`
	DNSProvider              string   `json:"dnsProvider"`
	DNSEnvText               string   `json:"dnsEnvText"`
	CustomArgs               string   `json:"customArgs"`
	PushDir                  string   `json:"pushDir"`
	CertPath                 string   `json:"certPath"`
	KeyPath                  string   `json:"keyPath"`
	FullchainPath            string   `json:"fullchainPath"`
	ChainPath                string   `json:"chainPath"`
	CertPEM                  string   `json:"certPem"`
	KeyPEM                   string   `json:"keyPem"`
	FullchainPEM             string   `json:"fullchainPem"`
	ChainPEM                 string   `json:"chainPem"`
	Fingerprint              string   `json:"fingerprint"`
	NotBefore                int64    `json:"notBefore"`
	NotAfter                 int64    `json:"notAfter"`
	LastIssuedAt             int64    `json:"lastIssuedAt"`
	LastRenewedAt            int64    `json:"lastRenewedAt"`
	UpdatedAt                int64    `json:"updatedAt"`
	CreatedAt                int64    `json:"createdAt"`
	LastError                string   `json:"lastError"`
	LastOutput               string   `json:"lastOutput"`
}

type certificateManagerInstallPayload struct {
	Email   string
	Version string
}

type certificateManagerIssuePayload struct {
	Domains         string
	CertificateType string
	Challenge       string
	Webroot         string
	DNSProvider     string
	DNSEnvText      string
	Server          string
	KeyLength       string
	CustomArgs      string
	AcmeAccountID   uint64
	DNSAccountID    uint64
	AutoRenew       bool
	Remark          string
	PushDir         string
}

type certificateManagerRenewPayload struct {
	ID    uint64
	Force bool
}

type certificateManagerPushPayload struct {
	ID        uint64
	TargetDir string
}

type certificateManagerManagedPaths struct {
	Dir       string
	Cert      string
	Key       string
	Fullchain string
	Chain     string
}

type certificateManagerGitHubRelease struct {
	TagName     string    `json:"tag_name"`
	PublishedAt time.Time `json:"published_at"`
}

type certificateManagerGitHubTag struct {
	Name string `json:"name"`
}

func newCertificateManagerService(
	logger *slog.Logger,
	workDir string,
	backgroundCtx context.Context,
) *certificateManagerService {
	certDir := filepath.Join(workDir, dataDir, "cert")

	svc := &certificateManagerService{
		logger:  logger,
		workDir: workDir,
		acmeDir: filepath.Join(workDir, dataDir, "acme.sh"),
		certDir: certDir,
		dbPath:  filepath.Join(certDir, certManagerDBName),
		httpCli: &http.Client{
			Timeout: 20 * time.Second,
		},
	}

	svc.startAutoRenewLoop(backgroundCtx)

	return svc
}

type certificateManagerAssignmentSnapshot struct {
	panelIDs map[uint64]struct{}
	dnsIDs   map[uint64]struct{}
}

func currentTLSAssignmentSnapshot() (snapshot certificateManagerAssignmentSnapshot) {
	var tlsConf *tlsConfigSettings
	if globalContext.web != nil && globalContext.web.tlsManager != nil {
		tlsConf = globalContext.web.tlsManager.extendedTLSConfig()
	} else {
		config.RLock()
		cloned := config.TLS.clone()
		config.RUnlock()
		tlsConf = cloned
	}

	snapshot.panelIDs = make(map[uint64]struct{}, len(tlsConf.PanelAssignedCertificateIDs))
	snapshot.dnsIDs = make(map[uint64]struct{}, len(tlsConf.DNSAssignedCertificateIDs))

	for _, id := range normalizeManagedCertificateIDs(tlsConf.PanelAssignedCertificateIDs) {
		snapshot.panelIDs[id] = struct{}{}
	}

	for _, id := range normalizeManagedCertificateIDs(tlsConf.DNSAssignedCertificateIDs) {
		snapshot.dnsIDs[id] = struct{}{}
	}

	return snapshot
}

func (s *certificateManagerService) loadCurrentTLSConfig() (tlsConf *tlsConfigSettings) {
	if globalContext.web != nil && globalContext.web.tlsManager != nil {
		return globalContext.web.tlsManager.extendedTLSConfig()
	}

	config.RLock()
	defer config.RUnlock()

	return config.TLS.clone()
}

func (s *certificateManagerService) GetOverview(ctx context.Context) (overview *certificateManagerOverview, err error) {
	err = s.ensureDataDirs()
	if err != nil {
		return nil, err
	}

	settings, acmeAccounts, dnsAccounts, certs, err := s.readAllState()
	if err != nil {
		return nil, err
	}

	runtimeState := s.runtimeState()
	version := ""
	if runtimeState.Installed {
		version, _ = s.readInstalledVersion(ctx)
	}

	overview = &certificateManagerOverview{
		Supported:          s.isRuntimeSupported(),
		Installed:          runtimeState.Installed,
		ManagedInstalled:   runtimeState.ManagedInstalled,
		Version:            version,
		ScriptPath:         runtimeState.ScriptPath,
		HomeDir:            runtimeState.HomeDir,
		ContactEmail:       settings.ContactEmail,
		PreferredCA:        settings.PreferredCA,
		DefaultChallenge:   settings.DefaultChallenge,
		DefaultWebroot:     settings.DefaultWebroot,
		DefaultDNSProvider: settings.DefaultDNSProvider,
		DefaultKeyLength:   settings.DefaultKeyLength,
		UpdateStatus:       settings.UpdateStatus,
		AutoUpgrade:        settings.AutoUpgrade,
		AutoRenewWindow: certificateManagerAutoRenewWindow{
			WindowDays:          certManagerAutoRenewFixedDays,
			DynamicByValidity:   true,
			ThresholdDays:       certManagerAutoRenewFixedDays,
			MinDynamicWindowDay: certManagerAutoRenewMinDays,
			Examples:            []int{90, 60, 30},
		},
		CAOptions:    append([]certificateManagerCAOption(nil), certManagerCAOptions...),
		DNSProviders: append([]certificateManagerDNSProviderMeta(nil), certManagerDNSProviders...),
	}

	for _, item := range acmeAccounts {
		overview.AcmeAccounts = append(overview.AcmeAccounts, certificateManagerAcmeAccountView{
			ID:        item.ID,
			Name:      item.Name,
			Email:     item.Email,
			Server:    item.Server,
			KeyLength: item.KeyLength,
			Remark:    item.Remark,
			UpdatedAt: item.UpdatedAt,
		})
	}

	for _, item := range dnsAccounts {
		overview.DNSAccounts = append(overview.DNSAccounts, certificateManagerDNSAccountView{
			ID:           item.ID,
			Name:         item.Name,
			ProviderName: item.ProviderName,
			ProviderCode: item.ProviderCode,
			Env:          sanitizeCertificateManagerEnvMap(item.Env),
			Remark:       item.Remark,
			UpdatedAt:    item.UpdatedAt,
		})
	}

	assignments := currentTLSAssignmentSnapshot()
	for _, item := range certs {
		overview.Certificates = append(overview.Certificates, convertCertificateRecord(item, assignments))
	}

	return overview, nil
}

func (s *certificateManagerService) GetCertificateMaterial(id uint64) (view *certificateManagerMaterialView, err error) {
	cert, err := s.getCertificate(id)
	if err != nil {
		return nil, err
	}

	return &certificateManagerMaterialView{
		ID:                       cert.ID,
		MainDomain:               cert.MainDomain,
		CertPath:                 cert.CertPath,
		KeyPath:                  cert.KeyPath,
		FullchainPath:            cert.FullchainPath,
		ChainPath:                cert.ChainPath,
		CertPEM:                  strings.TrimSpace(cert.CertPEM),
		KeyPEM:                   strings.TrimSpace(cert.KeyPEM),
		FullchainPEM:             strings.TrimSpace(cert.FullchainPEM),
		ChainPEM:                 strings.TrimSpace(cert.ChainPEM),
		Fingerprint:              cert.Fingerprint,
		IssuedKeyAlgorithm:       cert.IssuedKeyAlgorithm,
		IssuedSignatureAlgorithm: cert.IssuedSignatureAlgorithm,
	}, nil
}

func (s *certificateManagerService) ListCertificateViews() (views []certificateManagerCertificateView, err error) {
	certs, err := s.listCertificates()
	if err != nil {
		return nil, err
	}

	views = make([]certificateManagerCertificateView, 0, len(certs))
	assignments := currentTLSAssignmentSnapshot()
	for _, item := range certs {
		views = append(views, convertCertificateRecord(item, assignments))
	}

	return views, nil
}

func (s *certificateManagerService) GetRemoteVersionsPage(
	ctx context.Context,
	page int,
	perPage int,
) (result *certificateManagerVersionListResult, err error) {
	if page < 1 {
		page = 1
	}
	if perPage <= 0 {
		perPage = 5
	}
	if perPage > 20 {
		perPage = 20
	}

	releases, releaseHasMore, releaseErr := s.fetchVersionPage(ctx, page, perPage)
	if releaseErr == nil && len(releases) > 0 {
		return &certificateManagerVersionListResult{
			Items:   releases,
			Page:    page,
			PerPage: perPage,
			HasMore: releaseHasMore,
		}, nil
	}

	tags, tagHasMore, tagErr := s.fetchTagVersionPage(ctx, page, perPage)
	if tagErr != nil {
		if releaseErr != nil {
			return nil, fmt.Errorf("获取 acme.sh 版本列表失败: %w；tag 回退失败: %v", releaseErr, tagErr)
		}

		return nil, fmt.Errorf("获取 acme.sh tag 列表失败: %w", tagErr)
	}

	return &certificateManagerVersionListResult{
		Items:   tags,
		Page:    page,
		PerPage: perPage,
		HasMore: tagHasMore,
	}, nil
}

func (s *certificateManagerService) CheckUpdate(ctx context.Context) (result *certificateManagerVersionCheckResult, err error) {
	runtimeState := s.runtimeState()
	current := ""
	if runtimeState.Installed {
		current, _ = s.readInstalledVersion(ctx)
	}

	latest := ""
	latestErr := error(nil)
	latest, latestErr = s.fetchLatestVersion(ctx)

	result = &certificateManagerVersionCheckResult{
		Supported:        s.isRuntimeSupported(),
		Installed:        runtimeState.Installed,
		ManagedInstalled: runtimeState.ManagedInstalled,
		CurrentVersion:   current,
		LatestVersion:    latest,
		CheckedAt:        time.Now().Unix(),
	}

	message := "未检测到更新"
	if latestErr != nil {
		message = latestErr.Error()
	} else {
		hasUpdate := current != "" && latest != "" && compareVersionStrings(current, latest) < 0
		switch {
		case current == "" && latest != "":
			message = "尚未安装 acme.sh"
		case latest == "":
			message = "未获取到远程版本"
		case hasUpdate:
			message = fmt.Sprintf("发现新版本：v%s", latest)
		default:
			message = "当前已是最新版本"
		}

		result.HasUpdate = hasUpdate
	}

	if latestErr == nil && current == "" && latest != "" {
		message = "尚未安装 acme.sh"
	}

	result.Message = message

	_ = s.updateSettings(func(settings *certificateManagerSettings) {
		settings.UpdateStatus = message
	})

	return result, nil
}

func (s *certificateManagerService) InstallOrReinstall(ctx context.Context, payload certificateManagerInstallPayload) (res *certificateManagerActionResult, err error) {
	if !s.isRuntimeSupported() {
		return nil, fmt.Errorf("当前运行环境不支持 acme.sh，请在 Linux 或其他类 Unix 目标环境运行")
	}

	s.opMu.Lock()
	defer s.opMu.Unlock()

	err = s.ensureDataDirs()
	if err != nil {
		return nil, err
	}

	scriptBody, version, err := s.downloadInstallScript(ctx, payload.Version)
	if err != nil {
		return nil, err
	}

	email := normalizeEmail(payload.Email)
	if email != "" && !isLikelyEmail(email) {
		return nil, fmt.Errorf("联系邮箱格式不正确")
	}

	tmpPath := filepath.Join(s.acmeDir, fmt.Sprintf("install-%d.sh", time.Now().UnixNano()))
	err = os.WriteFile(tmpPath, scriptBody, 0o700)
	if err != nil {
		return nil, fmt.Errorf("写入安装脚本失败: %w", err)
	}

	defer func() {
		_ = os.Remove(tmpPath)
	}()

	args := []string{
		tmpPath,
		"--install",
		"--home", s.acmeDir,
		"--config-home", s.acmeDir,
		"--cert-home", filepath.Join(s.acmeDir, "certs"),
		"--nocron",
	}
	if email != "" {
		args = append(args, "--accountemail", email)
	}

	output, err := s.runCommand(ctx, "", nil, "/bin/sh", args...)
	if err != nil {
		return &certificateManagerActionResult{
			Message: "安装 acme.sh 失败",
			Output:  output,
		}, fmt.Errorf("安装 acme.sh 失败: %w", err)
	}

	_ = os.Chmod(s.scriptPath(), 0o700)

	_ = s.updateSettings(func(settings *certificateManagerSettings) {
		if email != "" {
			settings.ContactEmail = email
		}
		settings.UpdateStatus = "安装完成"
	})

	msg := "acme.sh 安装完成"
	if version != "" {
		msg = fmt.Sprintf("acme.sh 安装完成（v%s）", version)
	}

	return &certificateManagerActionResult{
		Message: msg,
		Output:  output,
	}, nil
}

func (s *certificateManagerService) Upgrade(ctx context.Context) (res *certificateManagerActionResult, err error) {
	if !s.isRuntimeSupported() {
		return nil, fmt.Errorf("当前运行环境不支持 acme.sh，请在 Linux 或其他类 Unix 目标环境运行")
	}

	s.opMu.Lock()
	defer s.opMu.Unlock()

	runtimeState, err := s.requireInstalledRuntime()
	if err != nil {
		return nil, err
	}
	if !runtimeState.ManagedInstalled {
		return nil, fmt.Errorf("当前检测到的是本地 acme.sh 脚本，如需升级请先点击“下载安装 / 接管”切换为当前项目受管运行时")
	}

	args := append(s.acmeHomeArgs(), "--upgrade", "--auto-upgrade", "0")
	output, err := s.runCommand(ctx, "", nil, runtimeState.ScriptPath, args...)
	if err != nil {
		return &certificateManagerActionResult{
			Message: "升级 acme.sh 失败",
			Output:  output,
		}, fmt.Errorf("升级 acme.sh 失败: %w", err)
	}

	_ = s.updateSettings(func(settings *certificateManagerSettings) {
		settings.UpdateStatus = "已升级"
	})

	return &certificateManagerActionResult{
		Message: "acme.sh 已升级",
		Output:  output,
	}, nil
}

func (s *certificateManagerService) RemoveManagedAcme(removeCertificates bool) (res *certificateManagerActionResult, err error) {
	if !s.isRuntimeSupported() {
		return nil, fmt.Errorf("当前运行环境不支持 acme.sh，请在 Linux 或其他类 Unix 目标环境运行")
	}

	s.opMu.Lock()
	defer s.opMu.Unlock()

	managedInstalled := s.runtimeState().ManagedInstalled
	err = os.RemoveAll(s.acmeDir)
	if err != nil {
		return nil, fmt.Errorf("删除 acme.sh 目录失败: %w", err)
	}

	if removeCertificates {
		err = s.resetCertificates()
		if err != nil {
			return nil, err
		}

		tlsConf := s.loadCurrentTLSConfig()
		tlsConf.PanelAssignedCertificateIDs = nil
		tlsConf.DNSAssignedCertificateIDs = nil
		if applyErr := s.applyTLSConfigSnapshot(context.Background(), tlsConf); applyErr != nil {
			return nil, applyErr
		}

		_ = os.RemoveAll(filepath.Join(s.certDir, certManagerManagedFilesDirName))
	}

	_ = s.updateSettings(func(settings *certificateManagerSettings) {
		settings.UpdateStatus = "已移除"
	})

	msg := "已删除 acme.sh 运行目录"
	if !managedInstalled {
		msg = "已清理当前项目 acme 运行目录；若系统已存在本地 acme.sh，则未触碰本地脚本"
	}
	if removeCertificates {
		msg = "已删除 acme.sh 与证书库存"
	}

	return &certificateManagerActionResult{
		Message: msg,
	}, nil
}

func (s *certificateManagerService) Issue(ctx context.Context, payload certificateManagerIssuePayload) (res *certificateManagerActionResult, err error) {
	if !s.isRuntimeSupported() {
		return nil, fmt.Errorf("当前运行环境不支持 acme.sh，请在 Linux 或其他类 Unix 目标环境运行")
	}

	s.opMu.Lock()
	defer s.opMu.Unlock()

	scriptPath, err := s.requireInstalledScript()
	if err != nil {
		return nil, err
	}

	settings, acmeAccounts, dnsAccounts, _, err := s.readAllState()
	if err != nil {
		return nil, err
	}

	acmeAccountMap := map[uint64]certificateManagerAcmeAccount{}
	for _, item := range acmeAccounts {
		acmeAccountMap[item.ID] = item
	}

	dnsAccountMap := map[uint64]certificateManagerDNSAccount{}
	for _, item := range dnsAccounts {
		dnsAccountMap[item.ID] = item
	}

	certificateType := normalizeCertificateType(payload.CertificateType)
	domains, err := normalizeIdentifiers(payload.Domains, certificateType)
	if err != nil {
		return nil, err
	}
	if len(domains) == 0 {
		if certificateType == certManagerCertificateIP {
			return nil, fmt.Errorf("请至少填写一个 IP")
		}

		return nil, fmt.Errorf("请至少填写一个域名")
	}
	if certificateType == certManagerCertificateIP && len(domains) > certManagerMaxIPIdentifiers {
		return nil, fmt.Errorf("IP 证书最多支持 %d 个 IP", certManagerMaxIPIdentifiers)
	}

	acmeAccountID := payload.AcmeAccountID
	if certificateType == certManagerCertificateIP {
		acmeAccountID = 0
	}

	if certificateType == certManagerCertificateDomain && acmeAccountID == 0 {
		return nil, fmt.Errorf("域名证书必须选择 ACME 账号")
	}

	challenge := normalizeChallenge(payload.Challenge)
	if challenge == "" {
		challenge = normalizeChallenge(settings.DefaultChallenge)
	}
	if challenge == "" {
		challenge = certManagerDefaultChallenge
	}

	if certificateType == certManagerCertificateIP && challenge == "dns" {
		return nil, fmt.Errorf("IP 证书不支持 DNS 验证")
	}

	webroot := strings.TrimSpace(payload.Webroot)
	if challenge == "webroot" && webroot == "" {
		webroot = strings.TrimSpace(settings.DefaultWebroot)
	}
	if challenge == "webroot" && webroot == "" {
		return nil, fmt.Errorf("HTTP Webroot 验证必须填写站点目录")
	}

	keyLength := normalizeKeyLength(payload.KeyLength)
	if keyLength == "" {
		keyLength = normalizeKeyLength(settings.DefaultKeyLength)
	}
	if keyLength == "" {
		keyLength = certManagerDefaultKeyLength
	}

	server := normalizeCAServer(payload.Server)
	if server == "" {
		server = normalizeCAServer(settings.PreferredCA)
	}
	if server == "" {
		server = certManagerDefaultPreferredCA
	}
	if certificateType == certManagerCertificateIP {
		server = certManagerDefaultPreferredCA
	}

	acmeAccountName := ""
	email := normalizeEmail(settings.ContactEmail)
	if acmeAccountID > 0 {
		account, ok := acmeAccountMap[acmeAccountID]
		if !ok {
			return nil, fmt.Errorf("所选 ACME 账号不存在")
		}

		acmeAccountName = account.Name
		if account.Email != "" {
			email = normalizeEmail(account.Email)
		}

		if normalizeCAServer(account.Server) != "" {
			server = normalizeCAServer(account.Server)
		}

		if normalizeKeyLength(account.KeyLength) != "" {
			keyLength = normalizeKeyLength(account.KeyLength)
		}
	}

	if email != "" {
		err = s.ensureAcmeAccount(ctx, scriptPath, email, server)
		if err != nil {
			return nil, err
		}
	}

	useECC := strings.HasPrefix(strings.ToLower(keyLength), "ec-")
	dnsProvider := strings.TrimSpace(payload.DNSProvider)
	dnsAccountName := ""
	envMap := map[string]string{}
	if challenge == "dns" {
		if payload.DNSAccountID > 0 {
			account, ok := dnsAccountMap[payload.DNSAccountID]
			if !ok {
				return nil, fmt.Errorf("所选 DNS 账号不存在")
			}

			dnsAccountName = account.Name
			dnsProvider = account.ProviderCode

			envMap = cloneStringMap(account.Env)
		}

		if dnsProvider == "" {
			dnsProvider = strings.TrimSpace(settings.DefaultDNSProvider)
		}
		if dnsProvider == "" {
			return nil, fmt.Errorf("DNS 验证必须选择 DNS Provider")
		}

		extraEnv, parseErr := parseEnvText(payload.DNSEnvText)
		if parseErr != nil {
			return nil, parseErr
		}
		for key, value := range extraEnv {
			envMap[key] = value
		}

		providerMeta, ok := lookupDNSProvider(dnsProvider)
		if !ok {
			return nil, fmt.Errorf("不支持的 DNS Provider: %s", dnsProvider)
		}

		err = validateProviderEnv(providerMeta, envMap)
		if err != nil {
			return nil, err
		}
	}

	certificateID, err := s.reserveCertificateID()
	if err != nil {
		return nil, err
	}

	issueArgs := append(s.acmeHomeArgs(), "--issue")
	for _, item := range domains {
		issueArgs = append(issueArgs, "--domain", item)
	}
	switch challenge {
	case "dns":
		issueArgs = append(issueArgs, "--dns", dnsProvider)
	case "webroot":
		issueArgs = append(issueArgs, "--webroot", webroot)
	case "alpn":
		issueArgs = append(issueArgs, "--alpn")
	default:
		issueArgs = append(issueArgs, "--standalone")
	}
	issueArgs = append(issueArgs, "--server", server, "--keylength", keyLength, "--force")
	issueArgs = append(issueArgs, splitShellLike(payload.CustomArgs)...)

	issueOutput, err := s.runCommand(ctx, "", envMap, scriptPath, issueArgs...)
	if err != nil {
		return &certificateManagerActionResult{
			Message: "申请证书失败",
			Output:  issueOutput,
		}, fmt.Errorf("申请证书失败: %w", err)
	}

	managedPaths := s.managedPathsForID(certificateID)
	installOutput, err := s.installIssuedCertificate(ctx, scriptPath, domains[0], useECC, managedPaths)
	if err != nil {
		return &certificateManagerActionResult{
			Message: "证书签发成功，但安装到托管目录失败",
			Output:  mergeCommandOutput(issueOutput, installOutput),
			ID:      certificateID,
		}, fmt.Errorf("安装证书到托管目录失败: %w", err)
	}

	certPEM, keyPEM, fullchainPEM, chainPEM, err := readManagedCertificateFiles(managedPaths)
	if err != nil {
		return nil, err
	}

	leafInfo, err := inspectCertificateMaterial(fullchainPEM)
	if err != nil {
		return nil, err
	}

	record := certificateManagerCertificate{
		ID:                       certificateID,
		DisplayID:                certificateID,
		MainDomain:               domains[0],
		Domains:                  append([]string(nil), domains...),
		CertificateType:          certificateType,
		Challenge:                challenge,
		KeyLength:                keyLength,
		IssuedKeyAlgorithm:       leafInfo.KeyAlgorithm,
		IssuedSignatureAlgorithm: leafInfo.SignatureAlgorithm,
		CAServer:                 server,
		AcmeAccountID:            acmeAccountID,
		AcmeAccountName:          acmeAccountName,
		DNSAccountID:             payload.DNSAccountID,
		DNSAccountName:           dnsAccountName,
		AutoRenew:                payload.AutoRenew,
		Remark:                   strings.TrimSpace(payload.Remark),
		Webroot:                  webroot,
		DNSProvider:              dnsProvider,
		DNSEnvText:               strings.TrimSpace(payload.DNSEnvText),
		CustomArgs:               strings.TrimSpace(payload.CustomArgs),
		PushDir:                  strings.TrimSpace(payload.PushDir),
		CertPath:                 managedPaths.Cert,
		KeyPath:                  managedPaths.Key,
		FullchainPath:            managedPaths.Fullchain,
		ChainPath:                managedPaths.Chain,
		CertPEM:                  string(certPEM),
		KeyPEM:                   string(keyPEM),
		FullchainPEM:             string(fullchainPEM),
		ChainPEM:                 string(chainPEM),
		Fingerprint:              leafInfo.Fingerprint,
		NotBefore:                leafInfo.NotBefore.Unix(),
		NotAfter:                 leafInfo.NotAfter.Unix(),
		LastIssuedAt:             time.Now().Unix(),
		LastRenewedAt:            time.Now().Unix(),
		CreatedAt:                time.Now().Unix(),
		UpdatedAt:                time.Now().Unix(),
		LastOutput:               mergeCommandOutput(issueOutput, installOutput),
	}

	if record.PushDir != "" {
		pushOutput, pushErr := s.pushCertificateFiles(record, record.PushDir)
		record.LastOutput = mergeCommandOutput(record.LastOutput, pushOutput)
		if pushErr != nil {
			record.LastError = pushErr.Error()
		}
	}

	err = s.saveCertificate(record)
	if err != nil {
		return nil, err
	}

	_ = s.updateSettings(func(settings *certificateManagerSettings) {
		settings.PreferredCA = server
		settings.DefaultChallenge = challenge
		settings.DefaultWebroot = webroot
		settings.DefaultDNSProvider = dnsProvider
		settings.DefaultKeyLength = keyLength
		settings.UpdateStatus = "签发成功"
	})

	return &certificateManagerActionResult{
		Message: "证书申请成功",
		Output:  record.LastOutput,
		ID:      record.ID,
	}, nil
}

func (s *certificateManagerService) Renew(ctx context.Context, payload certificateManagerRenewPayload) (res *certificateManagerActionResult, err error) {
	if !s.isRuntimeSupported() {
		return nil, fmt.Errorf("当前运行环境不支持 acme.sh，请在 Linux 或其他类 Unix 目标环境运行")
	}

	s.opMu.Lock()
	defer s.opMu.Unlock()

	record, err := s.getCertificate(payload.ID)
	if err != nil {
		return nil, err
	}

	output, err := s.renewCertificateLocked(ctx, record, payload.Force)
	if err != nil {
		return &certificateManagerActionResult{
			Message: "证书续签失败",
			Output:  output,
			ID:      payload.ID,
		}, err
	}

	return &certificateManagerActionResult{
		Message: "证书续签完成",
		Output:  output,
		ID:      payload.ID,
	}, nil
}

func (s *certificateManagerService) Push(id uint64, targetDir string) (res *certificateManagerActionResult, err error) {
	record, err := s.getCertificate(id)
	if err != nil {
		return nil, err
	}

	targetDir = strings.TrimSpace(targetDir)
	if targetDir == "" {
		return nil, fmt.Errorf("目标目录不能为空")
	}

	output, err := s.pushCertificateFiles(*record, targetDir)
	if err != nil {
		record.LastError = err.Error()
		record.LastOutput = mergeCommandOutput(record.LastOutput, output)
		record.UpdatedAt = time.Now().Unix()
		_ = s.saveCertificate(*record)

		return &certificateManagerActionResult{
			Message: "推送证书失败",
			Output:  output,
			ID:      id,
		}, err
	}

	record.PushDir = targetDir
	record.LastError = ""
	record.LastOutput = mergeCommandOutput(record.LastOutput, output)
	record.UpdatedAt = time.Now().Unix()
	err = s.saveCertificate(*record)
	if err != nil {
		return nil, err
	}

	return &certificateManagerActionResult{
		Message: "证书已推送到目录",
		Output:  output,
		ID:      id,
	}, nil
}

func (s *certificateManagerService) SetAutoRenew(id uint64, autoRenew bool) (res *certificateManagerActionResult, err error) {
	record, err := s.getCertificate(id)
	if err != nil {
		return nil, err
	}

	record.AutoRenew = autoRenew
	record.UpdatedAt = time.Now().Unix()
	err = s.saveCertificate(*record)
	if err != nil {
		return nil, err
	}

	state := "关闭"
	if autoRenew {
		state = "开启"
	}

	return &certificateManagerActionResult{
		Message: "自动续签已" + state,
		ID:      id,
	}, nil
}

const (
	certificateManagerApplyTargetPanel = "panel"
	certificateManagerApplyTargetDNS   = "dns"
)

func normalizeCertificateManagerApplyTarget(target string) (normalized string) {
	switch strings.ToLower(strings.TrimSpace(target)) {
	case certificateManagerApplyTargetPanel:
		return certificateManagerApplyTargetPanel
	case certificateManagerApplyTargetDNS:
		return certificateManagerApplyTargetDNS
	default:
		return ""
	}
}

func (s *certificateManagerService) ApplyCertificate(ctx context.Context, id uint64, target string) (res *certificateManagerActionResult, err error) {
	s.opMu.Lock()
	defer s.opMu.Unlock()

	target = normalizeCertificateManagerApplyTarget(target)
	if target == "" {
		return nil, fmt.Errorf("未知的应用目标")
	}

	if _, err = s.getCertificate(id); err != nil {
		return nil, err
	}

	tlsConf := s.loadCurrentTLSConfig()
	switch target {
	case certificateManagerApplyTargetPanel:
		if !slices.Contains(tlsConf.PanelAssignedCertificateIDs, id) {
			tlsConf.PanelAssignedCertificateIDs = append(tlsConf.PanelAssignedCertificateIDs, id)
		}
		tlsConf.PanelAssignedCertificateIDs = normalizeManagedCertificateIDs(tlsConf.PanelAssignedCertificateIDs)
	case certificateManagerApplyTargetDNS:
		if !slices.Contains(tlsConf.DNSAssignedCertificateIDs, id) {
			tlsConf.DNSAssignedCertificateIDs = append(tlsConf.DNSAssignedCertificateIDs, id)
		}
		tlsConf.DNSAssignedCertificateIDs = normalizeManagedCertificateIDs(tlsConf.DNSAssignedCertificateIDs)
	}

	err = s.applyTLSConfigSnapshot(ctx, tlsConf)
	if err != nil {
		return nil, err
	}

	targetLabel := "DNS 加密"
	if target == certificateManagerApplyTargetPanel {
		targetLabel = "面板"
	}

	return &certificateManagerActionResult{
		Message: "证书已应用到" + targetLabel,
		ID:      id,
	}, nil
}

func (s *certificateManagerService) UnapplyCertificate(ctx context.Context, id uint64, target string) (res *certificateManagerActionResult, err error) {
	s.opMu.Lock()
	defer s.opMu.Unlock()

	target = normalizeCertificateManagerApplyTarget(target)
	if target == "" {
		return nil, fmt.Errorf("未知的应用目标")
	}

	tlsConf := s.loadCurrentTLSConfig()
	switch target {
	case certificateManagerApplyTargetPanel:
		tlsConf.PanelAssignedCertificateIDs = removeManagedCertificateID(tlsConf.PanelAssignedCertificateIDs, id)
	case certificateManagerApplyTargetDNS:
		tlsConf.DNSAssignedCertificateIDs = removeManagedCertificateID(tlsConf.DNSAssignedCertificateIDs, id)
	}

	err = s.applyTLSConfigSnapshot(ctx, tlsConf)
	if err != nil {
		return nil, err
	}

	targetLabel := "DNS 加密"
	if target == certificateManagerApplyTargetPanel {
		targetLabel = "面板"
	}

	return &certificateManagerActionResult{
		Message: "证书已取消应用到" + targetLabel,
		ID:      id,
	}, nil
}

func removeManagedCertificateID(ids []uint64, id uint64) (next []uint64) {
	for _, item := range normalizeManagedCertificateIDs(ids) {
		if item == id {
			continue
		}

		next = append(next, item)
	}

	return next
}

func (s *certificateManagerService) applyTLSConfigSnapshot(ctx context.Context, tlsConf *tlsConfigSettings) (err error) {
	if tlsConf == nil {
		return nil
	}

	if globalContext.web != nil && globalContext.web.tlsManager != nil {
		err = globalContext.web.tlsManager.applySettings(ctx, *tlsConf, aghalg.NBNull)
		if err != nil {
			return err
		}
	}

	config.Lock()
	config.TLS = *tlsConf.clone()
	config.Unlock()

	if globalContext.web != nil && globalContext.web.confModifier != nil {
		globalContext.web.confModifier.Apply(ctx)
	}

	return nil
}

func (s *certificateManagerService) Delete(ctx context.Context, id uint64) (res *certificateManagerActionResult, err error) {
	s.opMu.Lock()
	defer s.opMu.Unlock()

	record, err := s.getCertificate(id)
	if err != nil {
		return nil, err
	}

	outputParts := []string{}
	if s.isRuntimeSupported() && s.isInstalled() {
		scriptPath, scriptErr := s.requireInstalledScript()
		if scriptErr == nil {
			args := append(s.acmeHomeArgs(), "--remove", "--domain", record.MainDomain)
			if strings.HasPrefix(strings.ToLower(record.KeyLength), "ec-") {
				args = append(args, "--ecc")
			}

			output, removeErr := s.runCommand(ctx, "", nil, scriptPath, args...)
			if output != "" {
				outputParts = append(outputParts, output)
			}
			if removeErr != nil {
				outputParts = append(outputParts, "acme.sh remove warning: "+removeErr.Error())
			}
		}
	}

	tlsConf := s.loadCurrentTLSConfig()
	tlsConf.PanelAssignedCertificateIDs = removeManagedCertificateID(tlsConf.PanelAssignedCertificateIDs, id)
	tlsConf.DNSAssignedCertificateIDs = removeManagedCertificateID(tlsConf.DNSAssignedCertificateIDs, id)
	err = s.applyTLSConfigSnapshot(ctx, tlsConf)
	if err != nil {
		return nil, fmt.Errorf("更新 TLS 证书分配失败: %w", err)
	}

	err = os.RemoveAll(filepath.Dir(record.CertPath))
	if err != nil {
		return nil, fmt.Errorf("删除托管证书目录失败: %w", err)
	}

	err = s.deleteCertificate(id)
	if err != nil {
		return nil, err
	}

	return &certificateManagerActionResult{
		Message: "证书已删除",
		Output:  strings.TrimSpace(strings.Join(outputParts, "\n\n")),
		ID:      id,
	}, nil
}

func (s *certificateManagerService) SaveContactEmail(email string) (res *certificateManagerActionResult, err error) {
	email = normalizeEmail(email)
	if email != "" && !isLikelyEmail(email) {
		return nil, fmt.Errorf("联系邮箱格式不正确")
	}

	err = s.updateSettings(func(settings *certificateManagerSettings) {
		settings.ContactEmail = email
	})
	if err != nil {
		return nil, err
	}

	return &certificateManagerActionResult{
		Message: "联系邮箱已保存",
	}, nil
}

func (s *certificateManagerService) SaveAcmeAccount(account certificateManagerAcmeAccount) (res *certificateManagerActionResult, err error) {
	isNew := account.ID == 0

	account.Name = strings.TrimSpace(account.Name)
	account.Email = normalizeEmail(account.Email)
	account.Server = normalizeCAServer(account.Server)
	account.KeyLength = normalizeKeyLength(account.KeyLength)
	account.Remark = strings.TrimSpace(account.Remark)

	if account.Email == "" || !isLikelyEmail(account.Email) {
		return nil, fmt.Errorf("请填写有效的 ACME 邮箱")
	}
	if account.Server == "" {
		account.Server = certManagerDefaultPreferredCA
	}
	if account.KeyLength == "" {
		account.KeyLength = certManagerDefaultKeyLength
	}
	if account.Name == "" {
		account.Name = account.Email
	}

	now := time.Now().Unix()
	if account.ID == 0 {
		account.ID, err = s.nextSequence(certManagerBucketAcmeAccounts)
		if err != nil {
			return nil, err
		}

		account.CreatedAt = now
	} else {
		current, getErr := s.getAcmeAccount(account.ID)
		if getErr != nil {
			return nil, getErr
		}

		account.CreatedAt = current.CreatedAt
	}

	account.UpdatedAt = now

	err = s.saveAcmeAccount(account)
	if err != nil {
		return nil, err
	}

	msg := "ACME 账号已保存"
	if isNew {
		msg = "ACME 账号已创建"
	}

	return &certificateManagerActionResult{
		Message: msg,
		ID:      account.ID,
	}, nil
}

func (s *certificateManagerService) DeleteAcmeAccount(id uint64) (res *certificateManagerActionResult, err error) {
	if id == 0 {
		return nil, fmt.Errorf("账号 ID 不能为空")
	}

	certs, err := s.listCertificates()
	if err != nil {
		return nil, err
	}
	for _, item := range certs {
		if item.AcmeAccountID == id {
			return nil, fmt.Errorf("该 ACME 账号仍被证书 %s 引用，请先修改证书配置", item.MainDomain)
		}
	}

	err = s.deleteRecord(certManagerBucketAcmeAccounts, id)
	if err != nil {
		return nil, err
	}

	return &certificateManagerActionResult{
		Message: "ACME 账号已删除",
		ID:      id,
	}, nil
}

func (s *certificateManagerService) SaveDNSAccount(account certificateManagerDNSAccount) (res *certificateManagerActionResult, err error) {
	isNew := account.ID == 0

	account.Name = strings.TrimSpace(account.Name)
	account.ProviderCode = strings.TrimSpace(account.ProviderCode)
	account.Remark = strings.TrimSpace(account.Remark)
	account.Env = normalizeEnvMap(account.Env)

	providerMeta, ok := lookupDNSProvider(account.ProviderCode)
	if !ok {
		return nil, fmt.Errorf("不支持的 DNS Provider")
	}

	account.ProviderCode = providerMeta.ProviderCode
	account.Env = sanitizeDNSAccountEnvForProvider(providerMeta, account.Env)

	existingEnv := map[string]string{}
	existingProviderCode := ""
	if account.Name == "" {
		account.Name = providerMeta.Name
	}
	account.ProviderName = providerMeta.Name

	now := time.Now().Unix()
	if account.ID == 0 {
		account.ID, err = s.nextSequence(certManagerBucketDNSAccounts)
		if err != nil {
			return nil, err
		}

		account.CreatedAt = now
	} else {
		current, getErr := s.getDNSAccount(account.ID)
		if getErr != nil {
			return nil, getErr
		}

		account.CreatedAt = current.CreatedAt
		existingEnv = cloneStringMap(current.Env)
		existingProviderCode = current.ProviderCode
	}

	if existingProviderCode != "" && !strings.EqualFold(existingProviderCode, account.ProviderCode) {
		existingEnv = map[string]string{}
	}

	account.Env = mergeCertificateManagerDNSAccountEnv(existingEnv, account.Env)
	err = validateProviderEnv(providerMeta, account.Env)
	if err != nil {
		return nil, err
	}

	account.UpdatedAt = now

	err = s.saveDNSAccount(account)
	if err != nil {
		return nil, err
	}

	_ = s.updateSettings(func(settings *certificateManagerSettings) {
		settings.DefaultDNSProvider = account.ProviderCode
	})

	msg := "DNS 账号已保存"
	if isNew {
		msg = "DNS 账号已创建"
	}

	return &certificateManagerActionResult{
		Message: msg,
		ID:      account.ID,
	}, nil
}

func (s *certificateManagerService) DeleteDNSAccount(id uint64) (res *certificateManagerActionResult, err error) {
	if id == 0 {
		return nil, fmt.Errorf("账号 ID 不能为空")
	}

	certs, err := s.listCertificates()
	if err != nil {
		return nil, err
	}
	for _, item := range certs {
		if item.DNSAccountID == id {
			return nil, fmt.Errorf("该 DNS 账号仍被证书 %s 引用，请先修改证书配置", item.MainDomain)
		}
	}

	err = s.deleteRecord(certManagerBucketDNSAccounts, id)
	if err != nil {
		return nil, err
	}

	return &certificateManagerActionResult{
		Message: "DNS 账号已删除",
		ID:      id,
	}, nil
}

func (s *certificateManagerService) startAutoRenewLoop(backgroundCtx context.Context) {
	if backgroundCtx == nil {
		backgroundCtx = context.Background()
	}

	go func() {
		s.runAutoRenewPass(backgroundCtx)

		ticker := time.NewTicker(certManagerAutoRenewCheckEvery)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				s.runAutoRenewPass(backgroundCtx)
			case <-backgroundCtx.Done():
				return
			}
		}
	}()
}

func (s *certificateManagerService) runAutoRenewPass(ctx context.Context) {
	if !s.isRuntimeSupported() || !s.isInstalled() {
		return
	}
	if !s.autoBusy.CompareAndSwap(false, true) {
		return
	}
	defer s.autoBusy.Store(false)

	s.autoAt.Store(time.Now().Unix())

	s.opMu.Lock()
	defer s.opMu.Unlock()

	certs, err := s.listCertificates()
	if err != nil {
		s.logger.Error("列出自动续签证书失败", "error", err)

		return
	}

	for _, item := range certs {
		if !item.AutoRenew || item.NotAfter == 0 {
			continue
		}

		threshold := autoRenewThresholdDays(item.NotBefore, item.NotAfter)
		remain := remainingCertificateDays(item.NotAfter)
		if remain > threshold {
			continue
		}

		record := item
		_, renewErr := s.renewCertificateLocked(ctx, &record, false)
		if renewErr != nil {
			s.logger.Error(
				"自动续签失败",
				"id", record.ID,
				"domain", record.MainDomain,
				"error", renewErr,
			)
		}
	}
}

func (s *certificateManagerService) renewCertificateLocked(
	ctx context.Context,
	record *certificateManagerCertificate,
	force bool,
) (output string, err error) {
	scriptPath, err := s.requireInstalledScript()
	if err != nil {
		return "", err
	}

	envMap := map[string]string{}
	if record.Challenge == "dns" {
		extraEnv, parseErr := parseEnvText(record.DNSEnvText)
		if parseErr != nil {
			return "", parseErr
		}

		envMap = extraEnv
		if record.DNSAccountID > 0 {
			account, getErr := s.getDNSAccount(record.DNSAccountID)
			if getErr == nil && account != nil {
				for key, value := range account.Env {
					if _, ok := envMap[key]; !ok {
						envMap[key] = value
					}
				}
			}
		}
	}

	args := append(s.acmeHomeArgs(), "--renew", "--domain", record.MainDomain)
	if strings.HasPrefix(strings.ToLower(record.KeyLength), "ec-") {
		args = append(args, "--ecc")
	}
	if record.CAServer != "" {
		args = append(args, "--server", record.CAServer)
	}
	if force {
		args = append(args, "--force")
	}

	renewOutput, err := s.runCommand(ctx, "", envMap, scriptPath, args...)
	output = renewOutput
	if err != nil {
		record.LastError = err.Error()
		record.LastOutput = mergeCommandOutput(record.LastOutput, renewOutput)
		record.UpdatedAt = time.Now().Unix()
		_ = s.saveCertificate(*record)

		return output, fmt.Errorf("续签失败: %w", err)
	}

	paths := certificateManagerManagedPaths{
		Dir:       filepath.Dir(record.CertPath),
		Cert:      record.CertPath,
		Key:       record.KeyPath,
		Fullchain: record.FullchainPath,
		Chain:     record.ChainPath,
	}

	installOutput, err := s.installIssuedCertificate(ctx, scriptPath, record.MainDomain, strings.HasPrefix(strings.ToLower(record.KeyLength), "ec-"), paths)
	output = mergeCommandOutput(output, installOutput)
	if err != nil {
		record.LastError = err.Error()
		record.LastOutput = mergeCommandOutput(record.LastOutput, output)
		record.UpdatedAt = time.Now().Unix()
		_ = s.saveCertificate(*record)

		return output, fmt.Errorf("续签后安装证书失败: %w", err)
	}

	certPEM, keyPEM, fullchainPEM, chainPEM, err := readManagedCertificateFiles(paths)
	if err != nil {
		return output, err
	}

	leafInfo, err := inspectCertificateMaterial(fullchainPEM)
	if err != nil {
		return output, err
	}

	record.CertPEM = string(certPEM)
	record.KeyPEM = string(keyPEM)
	record.FullchainPEM = string(fullchainPEM)
	record.ChainPEM = string(chainPEM)
	record.IssuedKeyAlgorithm = leafInfo.KeyAlgorithm
	record.IssuedSignatureAlgorithm = leafInfo.SignatureAlgorithm
	record.Fingerprint = leafInfo.Fingerprint
	record.NotBefore = leafInfo.NotBefore.Unix()
	record.NotAfter = leafInfo.NotAfter.Unix()
	record.LastRenewedAt = time.Now().Unix()
	record.UpdatedAt = time.Now().Unix()
	record.LastError = ""
	record.LastOutput = mergeCommandOutput(record.LastOutput, output)

	if record.PushDir != "" {
		pushOutput, pushErr := s.pushCertificateFiles(*record, record.PushDir)
		record.LastOutput = mergeCommandOutput(record.LastOutput, pushOutput)
		if pushErr != nil {
			record.LastError = pushErr.Error()
		}
	}

	err = s.saveCertificate(*record)
	if err != nil {
		return output, err
	}

	return record.LastOutput, nil
}

func (s *certificateManagerService) installIssuedCertificate(
	ctx context.Context,
	scriptPath string,
	mainDomain string,
	useECC bool,
	paths certificateManagerManagedPaths,
) (output string, err error) {
	err = os.MkdirAll(paths.Dir, aghos.DefaultPermDir)
	if err != nil {
		return "", fmt.Errorf("创建托管证书目录失败: %w", err)
	}

	args := append(s.acmeHomeArgs(), "--install-cert", "--domain", mainDomain)
	if useECC {
		args = append(args, "--ecc")
	}

	args = append(
		args,
		"--cert-file", paths.Cert,
		"--key-file", paths.Key,
		"--fullchain-file", paths.Fullchain,
		"--ca-file", paths.Chain,
	)

	return s.runCommand(ctx, "", nil, scriptPath, args...)
}

func (s *certificateManagerService) pushCertificateFiles(record certificateManagerCertificate, targetDir string) (output string, err error) {
	targetDir = strings.TrimSpace(targetDir)
	if targetDir == "" {
		return "", fmt.Errorf("推送目录不能为空")
	}

	err = os.MkdirAll(targetDir, 0o755)
	if err != nil {
		return "", fmt.Errorf("创建推送目录失败: %w", err)
	}

	files := []struct {
		name string
		data string
		perm os.FileMode
	}{
		{name: "cert.pem", data: record.CertPEM, perm: 0o644},
		{name: "key.pem", data: record.KeyPEM, perm: 0o600},
		{name: "fullchain.pem", data: record.FullchainPEM, perm: 0o644},
		{name: "chain.pem", data: record.ChainPEM, perm: 0o644},
	}

	written := make([]string, 0, len(files))
	for _, file := range files {
		if strings.TrimSpace(file.data) == "" && file.name == "chain.pem" {
			continue
		}

		path := filepath.Join(targetDir, file.name)
		err = os.WriteFile(path, []byte(file.data), file.perm)
		if err != nil {
			return strings.Join(written, "\n"), fmt.Errorf("写入 %s 失败: %w", file.name, err)
		}

		written = append(written, path)
	}

	return "已写入:\n" + strings.Join(written, "\n"), nil
}

func (s *certificateManagerService) ensureAcmeAccount(
	ctx context.Context,
	scriptPath string,
	email string,
	server string,
) (err error) {
	email = normalizeEmail(email)
	if email == "" {
		return nil
	}

	if !isLikelyEmail(email) {
		return fmt.Errorf("ACME 邮箱格式不正确")
	}

	args := append(s.acmeHomeArgs(), "--register-account", "--accountemail", email, "--server", server)
	output, regErr := s.runCommand(ctx, "", nil, scriptPath, args...)
	if regErr == nil {
		return nil
	}

	updateArgs := append(s.acmeHomeArgs(), "--update-account", "--accountemail", email, "--server", server)
	updateOutput, updErr := s.runCommand(ctx, "", nil, scriptPath, updateArgs...)
	if updErr == nil {
		return nil
	}

	return fmt.Errorf("同步 ACME 账号失败: %s", strings.TrimSpace(mergeCommandOutput(output, updateOutput)))
}

func (s *certificateManagerService) reserveCertificateID() (id uint64, err error) {
	return s.nextSequence(certManagerBucketCertificates)
}

func (s *certificateManagerService) managedPathsForID(id uint64) (paths certificateManagerManagedPaths) {
	dir := filepath.Join(s.certDir, certManagerManagedFilesDirName, strconv.FormatUint(id, 10))

	return certificateManagerManagedPaths{
		Dir:       dir,
		Cert:      filepath.Join(dir, "cert.pem"),
		Key:       filepath.Join(dir, "key.pem"),
		Fullchain: filepath.Join(dir, "fullchain.pem"),
		Chain:     filepath.Join(dir, "chain.pem"),
	}
}

func (s *certificateManagerService) downloadInstallScript(
	ctx context.Context,
	version string,
) (body []byte, normalizedVersion string, err error) {
	candidates := []string{strings.TrimSpace(version)}
	if version == "" {
		candidates = []string{""}
	} else if trimmed := strings.TrimPrefix(strings.TrimSpace(version), "v"); trimmed != version {
		candidates = append(candidates, trimmed)
	}

	for _, candidate := range candidates {
		url := certManagerInstallScriptURL
		normalizedVersion = normalizeVersionTag(candidate)
		if normalizedVersion != "" {
			url = fmt.Sprintf(
				"https://raw.githubusercontent.com/acmesh-official/acme.sh/%s/acme.sh",
				normalizedVersion,
			)
		}

		body, err = s.httpGetBytes(ctx, url)
		if err == nil {
			return body, normalizedVersion, nil
		}
	}

	return nil, "", fmt.Errorf("下载 acme.sh 安装脚本失败: %w", err)
}

func (s *certificateManagerService) fetchVersionPage(
	ctx context.Context,
	page int,
	perPage int,
) (items []certificateManagerVersionItem, hasMore bool, err error) {
	body, err := s.httpGetBytes(
		ctx,
		fmt.Sprintf("%s?per_page=%d&page=%d", certManagerGitHubReleases, perPage, page),
	)
	if err != nil {
		return nil, false, err
	}

	var releases []certificateManagerGitHubRelease
	err = json.Unmarshal(body, &releases)
	if err != nil {
		return nil, false, fmt.Errorf("解析版本列表失败: %w", err)
	}

	items = make([]certificateManagerVersionItem, 0, len(releases))
	for _, item := range releases {
		version := normalizeVersionTag(item.TagName)
		if version == "" {
			continue
		}

		display := version
		if !strings.HasPrefix(display, "v") {
			display = "v" + display
		}

		items = append(items, certificateManagerVersionItem{
			Version:     version,
			DisplayName: display,
			PublishedAt: item.PublishedAt.Unix(),
		})
	}

	return items, len(releases) >= perPage, nil
}

func (s *certificateManagerService) fetchTagVersionPage(
	ctx context.Context,
	page int,
	perPage int,
) (items []certificateManagerVersionItem, hasMore bool, err error) {
	body, err := s.httpGetBytes(
		ctx,
		fmt.Sprintf("%s?per_page=%d&page=%d", certManagerGitHubTags, perPage, page),
	)
	if err != nil {
		return nil, false, err
	}

	var tags []certificateManagerGitHubTag
	err = json.Unmarshal(body, &tags)
	if err != nil {
		return nil, false, fmt.Errorf("解析 tag 列表失败: %w", err)
	}

	items = make([]certificateManagerVersionItem, 0, len(tags))
	for _, tag := range tags {
		version := normalizeVersionTag(tag.Name)
		if version == "" {
			continue
		}

		items = append(items, certificateManagerVersionItem{
			Version:     version,
			DisplayName: "v" + version,
		})
	}

	return items, len(tags) >= perPage, nil
}

func (s *certificateManagerService) fetchLatestVersion(ctx context.Context) (version string, err error) {
	items, _, err := s.fetchVersionPage(ctx, 1, 1)
	if err == nil && len(items) > 0 {
		return items[0].Version, nil
	}

	tags, _, tagErr := s.fetchTagVersionPage(ctx, 1, 1)
	if tagErr == nil && len(tags) > 0 {
		return tags[0].Version, nil
	}
	if err != nil && tagErr != nil {
		return "", fmt.Errorf("获取远端最新版本失败: %w；tag 回退失败: %v", err, tagErr)
	}
	if err != nil {
		return "", err
	}

	return "", tagErr
}

func (s *certificateManagerService) httpGetBytes(ctx context.Context, url string) (body []byte, err error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("User-Agent", "AdGuardHome-CertificateManager/1.0")

	resp, err := s.httpCli.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("远程服务器返回状态码 %d", resp.StatusCode)
	}

	return io.ReadAll(resp.Body)
}

func (s *certificateManagerService) readInstalledVersion(ctx context.Context) (version string, err error) {
	scriptPath, err := s.requireInstalledScript()
	if err != nil {
		return "", err
	}

	output, err := s.runCommand(ctx, "", nil, scriptPath, "--version")
	if err != nil {
		return "", err
	}

	for _, line := range strings.Split(strings.TrimSpace(output), "\n") {
		version = normalizeVersionTag(line)
		if version != "" {
			return version, nil
		}
	}

	return "", nil
}

func (s *certificateManagerService) runCommand(
	ctx context.Context,
	dir string,
	env map[string]string,
	name string,
	args ...string,
) (output string, err error) {
	cmd := exec.CommandContext(ctx, name, args...)
	if dir != "" {
		cmd.Dir = dir
	}

	cmd.Env = os.Environ()
	if len(env) > 0 {
		keys := make([]string, 0, len(env))
		for key := range env {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		for _, key := range keys {
			cmd.Env = append(cmd.Env, key+"="+env[key])
		}
	}

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err = cmd.Run()
	output = strings.TrimSpace(strings.TrimSpace(stdout.String()) + "\n" + strings.TrimSpace(stderr.String()))
	output = strings.TrimSpace(output)
	if err != nil {
		return output, err
	}

	return output, nil
}

func (s *certificateManagerService) acmeHomeArgs() []string {
	return []string{"--home", s.acmeDir, "--config-home", s.acmeDir}
}

func (s *certificateManagerService) scriptPath() string {
	return filepath.Join(s.acmeDir, "acme.sh")
}

func (s *certificateManagerService) runtimeState() (state certificateManagerRuntimeState) {
	state.HomeDir = s.acmeDir

	managedScriptPath := s.scriptPath()
	if isExistingRegularFile(managedScriptPath) {
		state.ScriptPath = managedScriptPath
		state.Installed = true
		state.ManagedInstalled = true

		return state
	}

	candidates := make([]string, 0, 6)
	if envHome := strings.TrimSpace(os.Getenv("HOME")); envHome != "" {
		candidates = append(candidates, filepath.Join(envHome, ".acme.sh", "acme.sh"))
	}
	if home, homeErr := os.UserHomeDir(); homeErr == nil && strings.TrimSpace(home) != "" {
		candidates = append(candidates, filepath.Join(home, ".acme.sh", "acme.sh"))
	}

	candidates = append(candidates,
		"/root/.acme.sh/acme.sh",
		"/.acme.sh/acme.sh",
	)

	if lookPath, lookErr := exec.LookPath("acme.sh"); lookErr == nil {
		candidates = append(candidates, lookPath)
	}

	seen := map[string]struct{}{}
	for _, candidate := range candidates {
		cleaned := filepath.Clean(strings.TrimSpace(candidate))
		if cleaned == "" || cleaned == "." {
			continue
		}
		if _, ok := seen[cleaned]; ok {
			continue
		}
		seen[cleaned] = struct{}{}
		if !isExistingRegularFile(cleaned) {
			continue
		}

		state.ScriptPath = cleaned
		state.Installed = true

		return state
	}

	return state
}

func isExistingRegularFile(path string) (ok bool) {
	info, err := os.Stat(path)

	return err == nil && !info.IsDir()
}

func (s *certificateManagerService) isInstalled() (ok bool) {
	return s.runtimeState().Installed
}

func (s *certificateManagerService) isManagedInstalled() (ok bool) {
	return s.runtimeState().ManagedInstalled
}

func (s *certificateManagerService) requireInstalledRuntime() (state certificateManagerRuntimeState, err error) {
	state = s.runtimeState()
	if !state.Installed {
		return certificateManagerRuntimeState{}, fmt.Errorf("acme.sh 尚未安装")
	}

	return state, nil
}

func (s *certificateManagerService) requireInstalledScript() (scriptPath string, err error) {
	runtimeState, err := s.requireInstalledRuntime()
	if err != nil {
		return "", err
	}

	return runtimeState.ScriptPath, nil
}

func (s *certificateManagerService) isRuntimeSupported() (ok bool) {
	return runtime.GOOS != "windows"
}

func (s *certificateManagerService) ensureDataDirs() (err error) {
	err = os.MkdirAll(s.acmeDir, aghos.DefaultPermDir)
	if err != nil {
		return fmt.Errorf("创建 acme.sh 目录失败: %w", err)
	}

	err = os.MkdirAll(s.certDir, aghos.DefaultPermDir)
	if err != nil {
		return fmt.Errorf("创建证书数据库目录失败: %w", err)
	}

	err = os.MkdirAll(filepath.Join(s.certDir, certManagerManagedFilesDirName), aghos.DefaultPermDir)
	if err != nil {
		return fmt.Errorf("创建证书托管目录失败: %w", err)
	}

	return nil
}

func (s *certificateManagerService) readAllState() (
	settings certificateManagerSettings,
	acmeAccounts []certificateManagerAcmeAccount,
	dnsAccounts []certificateManagerDNSAccount,
	certs []certificateManagerCertificate,
	err error,
) {
	err = s.withDB(func(db *bbolt.DB) error {
		return db.View(func(tx *bbolt.Tx) error {
			settings, err = loadSettingsTx(tx)
			if err != nil {
				return err
			}

			acmeAccounts, err = listRecordsTx[certificateManagerAcmeAccount](tx, certManagerBucketAcmeAccounts)
			if err != nil {
				return err
			}

			dnsAccounts, err = listRecordsTx[certificateManagerDNSAccount](tx, certManagerBucketDNSAccounts)
			if err != nil {
				return err
			}

			certs, err = listRecordsTx[certificateManagerCertificate](tx, certManagerBucketCertificates)
			if err != nil {
				return err
			}

			return nil
		})
	})
	if err != nil {
		return settings, nil, nil, nil, err
	}

	sort.Slice(acmeAccounts, func(i, j int) bool {
		if acmeAccounts[i].UpdatedAt == acmeAccounts[j].UpdatedAt {
			return acmeAccounts[i].ID > acmeAccounts[j].ID
		}

		return acmeAccounts[i].UpdatedAt > acmeAccounts[j].UpdatedAt
	})
	sort.Slice(dnsAccounts, func(i, j int) bool {
		if dnsAccounts[i].UpdatedAt == dnsAccounts[j].UpdatedAt {
			return dnsAccounts[i].ID > dnsAccounts[j].ID
		}

		return dnsAccounts[i].UpdatedAt > dnsAccounts[j].UpdatedAt
	})
	sort.Slice(certs, func(i, j int) bool {
		if certs[i].UpdatedAt == certs[j].UpdatedAt {
			return certs[i].ID > certs[j].ID
		}

		return certs[i].UpdatedAt > certs[j].UpdatedAt
	})

	return settings, acmeAccounts, dnsAccounts, certs, nil
}

func (s *certificateManagerService) updateSettings(apply func(settings *certificateManagerSettings)) (err error) {
	err = s.withDB(func(db *bbolt.DB) error {
		return db.Update(func(tx *bbolt.Tx) error {
			err = ensureBuckets(tx)
			if err != nil {
				return err
			}

			settings, loadErr := loadSettingsTx(tx)
			if loadErr != nil {
				return loadErr
			}

			apply(&settings)

			return saveSettingsTx(tx, settings)
		})
	})

	return err
}

func (s *certificateManagerService) resetCertificates() (err error) {
	return s.withDB(func(db *bbolt.DB) error {
		return db.Update(func(tx *bbolt.Tx) error {
			err = tx.DeleteBucket([]byte(certManagerBucketCertificates))
			if err != nil && err != bbolt.ErrBucketNotFound {
				return err
			}

			_, err = tx.CreateBucketIfNotExists([]byte(certManagerBucketCertificates))

			return err
		})
	})
}

func (s *certificateManagerService) saveAcmeAccount(record certificateManagerAcmeAccount) (err error) {
	return s.saveRecord(certManagerBucketAcmeAccounts, record.ID, record)
}

func (s *certificateManagerService) getAcmeAccount(id uint64) (record *certificateManagerAcmeAccount, err error) {
	return getRecord[certificateManagerAcmeAccount](s, certManagerBucketAcmeAccounts, id)
}

func (s *certificateManagerService) saveDNSAccount(record certificateManagerDNSAccount) (err error) {
	return s.saveRecord(certManagerBucketDNSAccounts, record.ID, record)
}

func (s *certificateManagerService) getDNSAccount(id uint64) (record *certificateManagerDNSAccount, err error) {
	return getRecord[certificateManagerDNSAccount](s, certManagerBucketDNSAccounts, id)
}

func (s *certificateManagerService) saveCertificate(record certificateManagerCertificate) (err error) {
	return s.saveRecord(certManagerBucketCertificates, record.ID, record)
}

func (s *certificateManagerService) getCertificate(id uint64) (record *certificateManagerCertificate, err error) {
	return getRecord[certificateManagerCertificate](s, certManagerBucketCertificates, id)
}

func (s *certificateManagerService) listCertificates() (records []certificateManagerCertificate, err error) {
	err = s.withDB(func(db *bbolt.DB) error {
		return db.View(func(tx *bbolt.Tx) error {
			records, err = listRecordsTx[certificateManagerCertificate](tx, certManagerBucketCertificates)

			return err
		})
	})
	if err != nil {
		return nil, err
	}

	sort.Slice(records, func(i, j int) bool {
		if records[i].UpdatedAt == records[j].UpdatedAt {
			return records[i].ID > records[j].ID
		}

		return records[i].UpdatedAt > records[j].UpdatedAt
	})

	return records, nil
}

func (s *certificateManagerService) deleteCertificate(id uint64) (err error) {
	return s.deleteRecord(certManagerBucketCertificates, id)
}

func (s *certificateManagerService) saveRecord(bucket string, id uint64, value any) (err error) {
	if id == 0 {
		return fmt.Errorf("记录 ID 不能为空")
	}

	return s.withDB(func(db *bbolt.DB) error {
		return db.Update(func(tx *bbolt.Tx) error {
			err = ensureBuckets(tx)
			if err != nil {
				return err
			}

			return putRecordTx(tx, bucket, id, value)
		})
	})
}

func (s *certificateManagerService) deleteRecord(bucket string, id uint64) (err error) {
	return s.withDB(func(db *bbolt.DB) error {
		return db.Update(func(tx *bbolt.Tx) error {
			bkt := tx.Bucket([]byte(bucket))
			if bkt == nil {
				return nil
			}

			return bkt.Delete(uint64ToBytes(id))
		})
	})
}

func (s *certificateManagerService) nextSequence(bucket string) (id uint64, err error) {
	err = s.withDB(func(db *bbolt.DB) error {
		return db.Update(func(tx *bbolt.Tx) error {
			err = ensureBuckets(tx)
			if err != nil {
				return err
			}

			bkt := tx.Bucket([]byte(bucket))
			id, err = bkt.NextSequence()

			return err
		})
	})

	return id, err
}

func (s *certificateManagerService) withDB(fn func(db *bbolt.DB) error) (err error) {
	err = s.ensureDataDirs()
	if err != nil {
		return err
	}

	db, err := bbolt.Open(s.dbPath, aghos.DefaultPermFile, &bbolt.Options{
		Timeout: certManagerDBOpenTimeout,
	})
	if err != nil {
		return fmt.Errorf("打开证书数据库失败: %w", err)
	}
	defer func() {
		_ = db.Close()
	}()

	return fn(db)
}

func getRecord[T any](s *certificateManagerService, bucket string, id uint64) (record *T, err error) {
	err = s.withDB(func(db *bbolt.DB) error {
		return db.View(func(tx *bbolt.Tx) error {
			record, err = getRecordTx[T](tx, bucket, id)

			return err
		})
	})

	return record, err
}

func ensureBuckets(tx *bbolt.Tx) (err error) {
	for _, bucket := range []string{
		certManagerBucketSettings,
		certManagerBucketAcmeAccounts,
		certManagerBucketDNSAccounts,
		certManagerBucketCertificates,
	} {
		_, err = tx.CreateBucketIfNotExists([]byte(bucket))
		if err != nil {
			return err
		}
	}

	return nil
}

func loadSettingsTx(tx *bbolt.Tx) (settings certificateManagerSettings, err error) {
	settings = certificateManagerSettings{
		PreferredCA:      certManagerDefaultPreferredCA,
		DefaultChallenge: certManagerDefaultChallenge,
		DefaultKeyLength: certManagerDefaultKeyLength,
		UpdateStatus:     "未检测更新",
	}

	bkt := tx.Bucket([]byte(certManagerBucketSettings))
	if bkt == nil {
		return settings, nil
	}

	raw := bkt.Get([]byte(certManagerSettingsKey))
	if len(raw) == 0 {
		return settings, nil
	}

	err = json.Unmarshal(raw, &settings)
	if err != nil {
		return settings, fmt.Errorf("解析证书管理设置失败: %w", err)
	}

	if settings.PreferredCA == "" {
		settings.PreferredCA = certManagerDefaultPreferredCA
	}
	if settings.DefaultChallenge == "" {
		settings.DefaultChallenge = certManagerDefaultChallenge
	}
	if settings.DefaultKeyLength == "" {
		settings.DefaultKeyLength = certManagerDefaultKeyLength
	}
	if settings.UpdateStatus == "" {
		settings.UpdateStatus = "未检测更新"
	}

	return settings, nil
}

func saveSettingsTx(tx *bbolt.Tx, settings certificateManagerSettings) (err error) {
	bkt := tx.Bucket([]byte(certManagerBucketSettings))
	if bkt == nil {
		return fmt.Errorf("settings bucket 不存在")
	}

	data, err := json.Marshal(settings)
	if err != nil {
		return err
	}

	return bkt.Put([]byte(certManagerSettingsKey), data)
}

func listRecordsTx[T any](tx *bbolt.Tx, bucket string) (records []T, err error) {
	bkt := tx.Bucket([]byte(bucket))
	if bkt == nil {
		return []T{}, nil
	}

	records = []T{}
	err = bkt.ForEach(func(_, value []byte) error {
		var record T
		unmarshalErr := json.Unmarshal(value, &record)
		if unmarshalErr != nil {
			return unmarshalErr
		}

		records = append(records, record)

		return nil
	})
	if err != nil {
		return nil, err
	}

	return records, nil
}

func getRecordTx[T any](tx *bbolt.Tx, bucket string, id uint64) (record *T, err error) {
	bkt := tx.Bucket([]byte(bucket))
	if bkt == nil {
		return nil, fmt.Errorf("记录不存在")
	}

	raw := bkt.Get(uint64ToBytes(id))
	if len(raw) == 0 {
		return nil, fmt.Errorf("记录不存在")
	}

	var value T
	record = &value
	err = json.Unmarshal(raw, record)
	if err != nil {
		return nil, err
	}

	return record, nil
}

func putRecordTx(tx *bbolt.Tx, bucket string, id uint64, value any) (err error) {
	bkt := tx.Bucket([]byte(bucket))
	if bkt == nil {
		return fmt.Errorf("bucket 不存在")
	}

	data, err := json.Marshal(value)
	if err != nil {
		return err
	}

	return bkt.Put(uint64ToBytes(id), data)
}

func uint64ToBytes(id uint64) (data []byte) {
	buf := make([]byte, 8)
	binary.BigEndian.PutUint64(buf, id)

	return buf
}

func convertCertificateRecord(
	record certificateManagerCertificate,
	assignments certificateManagerAssignmentSnapshot,
) (view certificateManagerCertificateView) {
	status, statusLabel, tone, days := certificateStatus(record)
	_, inUseByPanel := assignments.panelIDs[record.ID]
	_, inUseByDNS := assignments.dnsIDs[record.ID]

	markers := make([]string, 0, 3)
	if strings.TrimSpace(record.PushDir) != "" {
		markers = append(markers, "已推送到目录")
	}
	if inUseByPanel {
		markers = append(markers, "面板使用中")
	}
	if inUseByDNS {
		markers = append(markers, "DNS 加密使用中")
	}
	usageLabel := "未使用"
	if len(markers) > 0 {
		usageLabel = strings.Join(markers, " / ")
	}

	return certificateManagerCertificateView{
		ID:                       record.ID,
		DisplayID:                record.DisplayID,
		MainDomain:               record.MainDomain,
		Domains:                  append([]string(nil), record.Domains...),
		CertificateType:          record.CertificateType,
		Challenge:                record.Challenge,
		KeyLength:                record.KeyLength,
		IssuedKeyAlgorithm:       record.IssuedKeyAlgorithm,
		IssuedSignatureAlgorithm: record.IssuedSignatureAlgorithm,
		CAServer:                 record.CAServer,
		AcmeAccountID:            record.AcmeAccountID,
		AcmeAccountName:          record.AcmeAccountName,
		DNSAccountID:             record.DNSAccountID,
		DNSAccountName:           record.DNSAccountName,
		AutoRenew:                record.AutoRenew,
		Remark:                   record.Remark,
		Webroot:                  record.Webroot,
		DNSProvider:              record.DNSProvider,
		DNSEnvText:               record.DNSEnvText,
		CustomArgs:               record.CustomArgs,
		PushDir:                  record.PushDir,
		CertPath:                 record.CertPath,
		KeyPath:                  record.KeyPath,
		FullchainPath:            record.FullchainPath,
		ChainPath:                record.ChainPath,
		Fingerprint:              record.Fingerprint,
		NotBefore:                record.NotBefore,
		NotAfter:                 record.NotAfter,
		LastIssuedAt:             record.LastIssuedAt,
		LastRenewedAt:            record.LastRenewedAt,
		UpdatedAt:                record.UpdatedAt,
		CreatedAt:                record.CreatedAt,
		LastError:                record.LastError,
		LastOutput:               record.LastOutput,
		Status:                   status,
		StatusLabel:              statusLabel,
		StatusTone:               tone,
		ExpiresInDays:            days,
		InUseByPanel:             inUseByPanel,
		InUseByDNS:               inUseByDNS,
		UsageLabel:               usageLabel,
	}
}

func certificateStatus(record certificateManagerCertificate) (status string, label string, tone string, days int) {
	now := time.Now().Unix()
	if record.NotAfter <= 0 {
		if record.LastError != "" {
			return "error", "异常", "danger", 0
		}

		return "pending", "待签发", "info", 0
	}

	days = remainingCertificateDays(record.NotAfter)
	switch {
	case record.LastError != "":
		return "error", "异常", "danger", days
	case record.NotAfter <= now:
		return "expired", "已过期", "danger", days
	case days <= 7:
		return "expiring", "即将到期", "warning", days
	default:
		return "valid", "有效", "success", days
	}
}

func remainingCertificateDays(notAfter int64) (days int) {
	diff := time.Until(time.Unix(notAfter, 0)).Hours() / 24

	return int(math.Ceil(diff))
}

func autoRenewThresholdDays(notBefore int64, notAfter int64) (days int) {
	validityDays := int(math.Ceil(time.Unix(notAfter, 0).Sub(time.Unix(notBefore, 0)).Hours() / 24))
	if validityDays > 40 {
		return certManagerAutoRenewFixedDays
	}

	days = validityDays / 3
	if days < certManagerAutoRenewMinDays {
		return certManagerAutoRenewMinDays
	}

	return days
}

type certificateLeafInfo struct {
	NotBefore          time.Time
	NotAfter           time.Time
	Fingerprint        string
	KeyAlgorithm       string
	SignatureAlgorithm string
}

func inspectCertificateMaterial(fullchainPEM []byte) (info certificateLeafInfo, err error) {
	rest := fullchainPEM
	for len(rest) > 0 {
		var block *pem.Block
		block, rest = pem.Decode(rest)
		if block == nil {
			break
		}
		if block.Type != "CERTIFICATE" {
			continue
		}

		var cert *x509.Certificate
		cert, err = x509.ParseCertificate(block.Bytes)
		if err != nil {
			return info, fmt.Errorf("解析证书失败: %w", err)
		}

		sum := sha256.Sum256(cert.Raw)
		info.NotBefore = cert.NotBefore
		info.NotAfter = cert.NotAfter
		info.Fingerprint = strings.ToLower(hex.EncodeToString(sum[:]))
		info.KeyAlgorithm = publicKeyAlgorithmLabel(cert.PublicKeyAlgorithm, cert.PublicKey)
		info.SignatureAlgorithm = signatureAlgorithmLabel(cert.SignatureAlgorithm)

		return info, nil
	}

	return info, fmt.Errorf("未找到可解析的证书内容")
}

func publicKeyAlgorithmLabel(alg x509.PublicKeyAlgorithm, publicKey any) (label string) {
	switch key := publicKey.(type) {
	case *rsa.PublicKey:
		return fmt.Sprintf("RSA %d", key.N.BitLen())
	case *ecdsa.PublicKey:
		return "EC " + strconv.Itoa(key.Params().BitSize)
	case ed25519.PublicKey:
		return "Ed25519"
	}

	switch alg {
	case x509.ECDSA:
		return "EC"
	case x509.RSA:
		return "RSA"
	case x509.Ed25519:
		return "Ed25519"
	default:
		return alg.String()
	}
}

func signatureAlgorithmLabel(alg x509.SignatureAlgorithm) (label string) {
	value := strings.TrimSpace(alg.String())
	if value == "" || value == "0" {
		return "-"
	}

	return value
}

func readManagedCertificateFiles(paths certificateManagerManagedPaths) (
	certPEM []byte,
	keyPEM []byte,
	fullchainPEM []byte,
	chainPEM []byte,
	err error,
) {
	certPEM, err = os.ReadFile(paths.Cert)
	if err != nil {
		return nil, nil, nil, nil, fmt.Errorf("读取 cert.pem 失败: %w", err)
	}

	keyPEM, err = os.ReadFile(paths.Key)
	if err != nil {
		return nil, nil, nil, nil, fmt.Errorf("读取 key.pem 失败: %w", err)
	}

	fullchainPEM, err = os.ReadFile(paths.Fullchain)
	if err != nil {
		return nil, nil, nil, nil, fmt.Errorf("读取 fullchain.pem 失败: %w", err)
	}

	chainPEM, _ = os.ReadFile(paths.Chain)

	return certPEM, keyPEM, fullchainPEM, chainPEM, nil
}

func normalizeCertificateType(value string) (typ string) {
	switch strings.TrimSpace(strings.ToLower(value)) {
	case certManagerCertificateIP, "ip_address", "ip-address":
		return certManagerCertificateIP
	default:
		return certManagerCertificateDomain
	}
}

func normalizeChallenge(value string) (challenge string) {
	switch strings.TrimSpace(strings.ToLower(value)) {
	case "dns", "dns-01":
		return "dns"
	case "webroot", "http-webroot":
		return "webroot"
	case "alpn", "tls-alpn", "tls_alpn":
		return "alpn"
	case "standalone", "http-standalone", "http_standalone":
		return "standalone"
	default:
		return ""
	}
}

func normalizeKeyLength(value string) (keyLength string) {
	switch strings.TrimSpace(strings.ToLower(value)) {
	case "ec-256", "ec256":
		return "ec-256"
	case "ec-384", "ec384":
		return "ec-384"
	case "2048", "rsa-2048", "rsa2048":
		return "2048"
	case "4096", "rsa-4096", "rsa4096":
		return "4096"
	case "8192", "rsa-8192", "rsa8192":
		return "8192"
	default:
		return ""
	}
}

func normalizeCAServer(value string) (server string) {
	switch strings.TrimSpace(strings.ToLower(value)) {
	case "", "letsencrypt", "let's encrypt":
		return certManagerDefaultPreferredCA
	case "zerossl", "zero ssl":
		return "zerossl"
	default:
		trimmed := strings.TrimSpace(value)
		if strings.HasPrefix(trimmed, "http://") || strings.HasPrefix(trimmed, "https://") {
			return trimmed
		}

		return ""
	}
}

func normalizeIdentifiers(raw string, certificateType string) (items []string, err error) {
	seen := map[string]struct{}{}
	for _, token := range strings.Fields(strings.NewReplacer(",", " ", "\r", " ", "\n", " ", "\t", " ").Replace(raw)) {
		value := strings.TrimSpace(token)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		if certificateType == certManagerCertificateIP {
			addr, parseErr := netip.ParseAddr(value)
			if parseErr != nil {
				return nil, fmt.Errorf("无效的 IP 地址: %s", value)
			}

			value = addr.String()
		}

		seen[value] = struct{}{}
		items = append(items, value)
	}

	return items, nil
}

func normalizeEmail(value string) (email string) {
	return strings.ToLower(strings.TrimSpace(value))
}

func isLikelyEmail(value string) (ok bool) {
	value = strings.TrimSpace(value)

	return value != "" && strings.Contains(value, "@") && strings.Contains(value, ".")
}

func parseEnvText(raw string) (env map[string]string, err error) {
	env = map[string]string{}
	lines := strings.Split(strings.ReplaceAll(strings.ReplaceAll(raw, "\r\n", "\n"), "\r", "\n"), "\n")
	for _, item := range lines {
		line := strings.TrimSpace(item)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		index := strings.Index(line, "=")
		if index <= 0 {
			return nil, fmt.Errorf("扩展环境变量格式错误: %s", line)
		}

		key := strings.TrimSpace(line[:index])
		value := strings.TrimSpace(line[index+1:])
		if key == "" || value == "" {
			return nil, fmt.Errorf("扩展环境变量格式错误: %s", line)
		}

		env[key] = value
	}

	return env, nil
}

func normalizeEnvMap(src map[string]string) (env map[string]string) {
	env = map[string]string{}
	for key, value := range src {
		trimKey := strings.TrimSpace(key)
		trimValue := strings.TrimSpace(value)
		if trimKey == "" || trimValue == "" {
			continue
		}

		env[trimKey] = trimValue
	}

	return env
}

func mergeCertificateManagerDNSAccountEnv(
	existing map[string]string,
	incoming map[string]string,
) (env map[string]string) {
	env = map[string]string{}
	for key, value := range incoming {
		trimKey := strings.TrimSpace(key)
		trimValue := strings.TrimSpace(value)
		if trimKey == "" || trimValue == "" {
			continue
		}

		if trimValue == certManagerMaskedEnvValue {
			if oldValue := strings.TrimSpace(existing[trimKey]); oldValue != "" {
				env[trimKey] = oldValue
			}

			continue
		}

		env[trimKey] = trimValue
	}

	return env
}

func cloneStringMap(src map[string]string) (out map[string]string) {
	out = map[string]string{}
	for key, value := range src {
		out[key] = value
	}

	return out
}

func lookupDNSProvider(code string) (provider certificateManagerDNSProviderMeta, ok bool) {
	code = strings.TrimSpace(code)
	for _, item := range certManagerDNSProviders {
		if strings.EqualFold(item.ProviderCode, code) {
			return item, true
		}
	}

	return certificateManagerDNSProviderMeta{}, false
}

func sanitizeDNSAccountEnvForProvider(
	provider certificateManagerDNSProviderMeta,
	env map[string]string,
) (sanitized map[string]string) {
	sanitized = map[string]string{}
	if len(env) == 0 {
		return sanitized
	}

	providerKeys := map[string]struct{}{}
	for _, field := range provider.Fields {
		key := strings.TrimSpace(field.Key)
		if key != "" {
			providerKeys[key] = struct{}{}
		}
	}

	knownProviderKeys := map[string]struct{}{}
	for _, item := range certManagerDNSProviders {
		for _, field := range item.Fields {
			key := strings.TrimSpace(field.Key)
			if key != "" {
				knownProviderKeys[key] = struct{}{}
			}
		}
	}

	for key, value := range env {
		trimKey := strings.TrimSpace(key)
		trimValue := strings.TrimSpace(value)
		if trimKey == "" || trimValue == "" {
			continue
		}

		if _, exists := providerKeys[trimKey]; exists {
			sanitized[trimKey] = trimValue

			continue
		}

		if _, exists := knownProviderKeys[trimKey]; exists {
			continue
		}

		sanitized[trimKey] = trimValue
	}

	return sanitized
}

func sanitizeCertificateManagerEnvMap(env map[string]string) (sanitized map[string]string) {
	sanitized = map[string]string{}
	for key, value := range env {
		trimKey := strings.TrimSpace(key)
		trimValue := strings.TrimSpace(value)
		if trimKey == "" || trimValue == "" {
			continue
		}

		if isCertificateManagerSecretEnvKey(trimKey) {
			sanitized[trimKey] = certManagerMaskedEnvValue
		} else {
			sanitized[trimKey] = trimValue
		}
	}

	return sanitized
}

func isCertificateManagerSecretEnvKey(key string) (ok bool) {
	key = strings.ToLower(strings.TrimSpace(key))
	if key == "" {
		return false
	}

	return strings.Contains(key, "token") ||
		strings.Contains(key, "secret") ||
		strings.Contains(key, "password") ||
		strings.Contains(key, "private_key") ||
		strings.Contains(key, "access_key") ||
		strings.Contains(key, "api_key") ||
		strings.HasSuffix(key, "_key") ||
		strings.HasSuffix(key, "_key_id") ||
		strings.HasSuffix(key, "_secret")
}

func validateProviderEnv(provider certificateManagerDNSProviderMeta, env map[string]string) (err error) {
	for _, field := range provider.Fields {
		if field.Required && strings.TrimSpace(env[field.Key]) == "" {
			return fmt.Errorf("%s 缺少必填环境变量 %s", provider.Name, field.Key)
		}
	}

	switch provider.ProviderCode {
	case "dns_cf":
		tokenMode := strings.TrimSpace(env["CF_Token"]) != ""
		globalMode := strings.TrimSpace(env["CF_Email"]) != "" && strings.TrimSpace(env["CF_Key"]) != ""
		if !tokenMode && !globalMode {
			return fmt.Errorf("Cloudflare 至少需要配置 Token 模式或 Global Key 模式")
		}
	case "dns_aws":
		ak := strings.TrimSpace(env["AWS_ACCESS_KEY_ID"])
		sk := strings.TrimSpace(env["AWS_SECRET_ACCESS_KEY"])
		if (ak == "") != (sk == "") {
			return fmt.Errorf("AWS 静态凭据需要同时填写 Access Key ID 和 Secret Access Key")
		}
	}

	return nil
}

func splitShellLike(raw string) (args []string) {
	for _, item := range strings.Fields(strings.TrimSpace(raw)) {
		if item != "" {
			args = append(args, item)
		}
	}

	return args
}

func mergeCommandOutput(items ...string) (output string) {
	parts := []string{}
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}

		parts = append(parts, item)
	}

	return strings.TrimSpace(strings.Join(parts, "\n\n"))
}

func normalizeVersionTag(value string) (version string) {
	value = strings.TrimSpace(value)
	for _, field := range strings.Fields(value) {
		field = strings.TrimSpace(strings.TrimPrefix(field, "v"))
		if field == "" {
			continue
		}

		parts := strings.Split(field, ".")
		valid := len(parts) >= 2
		for _, part := range parts {
			if part == "" {
				valid = false
				break
			}

			if _, err := strconv.Atoi(part); err != nil {
				valid = false
				break
			}
		}
		if valid {
			return field
		}
	}

	return ""
}

func compareVersionStrings(left string, right string) (cmp int) {
	leftParts := strings.Split(normalizeVersionTag(left), ".")
	rightParts := strings.Split(normalizeVersionTag(right), ".")
	size := max(len(leftParts), len(rightParts))
	for i := range size {
		lv := 0
		rv := 0
		if i < len(leftParts) {
			lv, _ = strconv.Atoi(strings.TrimSpace(leftParts[i]))
		}
		if i < len(rightParts) {
			rv, _ = strconv.Atoi(strings.TrimSpace(rightParts[i]))
		}
		if lv < rv {
			return -1
		}
		if lv > rv {
			return 1
		}
	}

	return 0
}

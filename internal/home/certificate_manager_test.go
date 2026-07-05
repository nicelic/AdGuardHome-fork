package home

import (
	"context"
	"log/slog"
	"net/http"
	"path/filepath"
	"testing"
)

func newTestCertificateManagerService(t *testing.T) (svc *certificateManagerService) {
	t.Helper()

	workDir := t.TempDir()

	return &certificateManagerService{
		logger:  slog.Default(),
		workDir: workDir,
		acmeDir: filepath.Join(workDir, dataDir, "acme.sh"),
		certDir: filepath.Join(workDir, dataDir, "cert"),
		dbPath:  filepath.Join(workDir, dataDir, "cert", certManagerDBName),
		httpCli: &http.Client{},
	}
}

func TestCertificateManagerOverviewMasksDNSSecrets(t *testing.T) {
	svc := newTestCertificateManagerService(t)

	result, err := svc.SaveDNSAccount(certificateManagerDNSAccount{
		Name:         "cloudflare-main",
		ProviderCode: "dns_cf",
		Env: map[string]string{
			"CF_Token":      "cf-real-token",
			"CF_Account_ID": "account-id",
			"CUSTOM_ENV":    "custom-value",
		},
	})
	if err != nil {
		t.Fatalf("save dns account failed: %v", err)
	}

	stored, err := svc.getDNSAccount(result.ID)
	if err != nil {
		t.Fatalf("get stored dns account failed: %v", err)
	}
	if got := stored.Env["CF_Token"]; got != "cf-real-token" {
		t.Fatalf("stored dns token mismatch: got=%q want=%q", got, "cf-real-token")
	}

	overview, err := svc.GetOverview(context.Background())
	if err != nil {
		t.Fatalf("get overview failed: %v", err)
	}
	if len(overview.DNSAccounts) != 1 {
		t.Fatalf("unexpected dns account count: got=%d want=1", len(overview.DNSAccounts))
	}

	env := overview.DNSAccounts[0].Env
	if got := env["CF_Token"]; got != certManagerMaskedEnvValue {
		t.Fatalf("expected masked CF_Token in overview, got=%q", got)
	}
	if got := env["CF_Account_ID"]; got != "account-id" {
		t.Fatalf("expected CF_Account_ID preserved, got=%q", got)
	}
	if got := env["CUSTOM_ENV"]; got != "custom-value" {
		t.Fatalf("expected CUSTOM_ENV preserved, got=%q", got)
	}
}

func TestCertificateManagerSaveDNSAccountPreservesMaskedSecretsOnUpdate(t *testing.T) {
	svc := newTestCertificateManagerService(t)

	created, err := svc.SaveDNSAccount(certificateManagerDNSAccount{
		Name:         "dns-account",
		ProviderCode: "dns_cf",
		Env: map[string]string{
			"CF_Token":      "cf-old-token",
			"CF_Account_ID": "cf-old-account",
		},
	})
	if err != nil {
		t.Fatalf("create dns account failed: %v", err)
	}

	_, err = svc.SaveDNSAccount(certificateManagerDNSAccount{
		ID:           created.ID,
		Name:         "dns-account",
		ProviderCode: "dns_cf",
		Env: map[string]string{
			"CF_Token":      certManagerMaskedEnvValue,
			"CF_Account_ID": "cf-new-account",
			"Ali_Key":       "stale-key",
			"Ali_Secret":    "stale-secret",
			"CUSTOM_ENV":    "keep",
		},
	})
	if err != nil {
		t.Fatalf("update dns account failed: %v", err)
	}

	stored, err := svc.getDNSAccount(created.ID)
	if err != nil {
		t.Fatalf("reload dns account failed: %v", err)
	}

	if got := stored.Env["CF_Token"]; got != "cf-old-token" {
		t.Fatalf("expected masked token to keep old value, got=%q", got)
	}
	if got := stored.Env["CF_Account_ID"]; got != "cf-new-account" {
		t.Fatalf("expected account id updated, got=%q", got)
	}
	if got := stored.Env["CUSTOM_ENV"]; got != "keep" {
		t.Fatalf("expected custom env preserved, got=%q", got)
	}
	if _, ok := stored.Env["Ali_Key"]; ok {
		t.Fatalf("expected stale Ali_Key dropped: %#v", stored.Env)
	}
	if _, ok := stored.Env["Ali_Secret"]; ok {
		t.Fatalf("expected stale Ali_Secret dropped: %#v", stored.Env)
	}
}

func TestCertificateManagerSaveDNSAccountProviderChangeDropsForeignKeysAndUpdatesDefault(t *testing.T) {
	svc := newTestCertificateManagerService(t)

	created, err := svc.SaveDNSAccount(certificateManagerDNSAccount{
		Name:         "provider-switch",
		ProviderCode: "dns_ali",
		Env: map[string]string{
			"Ali_Key":    "ali-key",
			"Ali_Secret": "ali-secret",
			"CUSTOM_ENV": "keep-me",
		},
	})
	if err != nil {
		t.Fatalf("create ali dns account failed: %v", err)
	}

	_, err = svc.SaveDNSAccount(certificateManagerDNSAccount{
		ID:           created.ID,
		Name:         "provider-switch",
		ProviderCode: "dns_cf",
		Env: map[string]string{
			"CF_Token":      "cf-token",
			"CF_Account_ID": "cf-account",
			"Ali_Key":       "stale-key",
			"Ali_Secret":    "stale-secret",
			"CUSTOM_ENV":    "keep-me",
		},
	})
	if err != nil {
		t.Fatalf("switch dns provider failed: %v", err)
	}

	stored, err := svc.getDNSAccount(created.ID)
	if err != nil {
		t.Fatalf("reload switched dns account failed: %v", err)
	}

	if got := stored.ProviderCode; got != "dns_cf" {
		t.Fatalf("unexpected provider code: got=%q want=%q", got, "dns_cf")
	}
	if got := stored.Env["CF_Token"]; got != "cf-token" {
		t.Fatalf("expected CF_Token stored, got=%q", got)
	}
	if got := stored.Env["CUSTOM_ENV"]; got != "keep-me" {
		t.Fatalf("expected custom env preserved, got=%q", got)
	}
	if _, ok := stored.Env["Ali_Key"]; ok {
		t.Fatalf("expected ali key removed after provider change: %#v", stored.Env)
	}
	if _, ok := stored.Env["Ali_Secret"]; ok {
		t.Fatalf("expected ali secret removed after provider change: %#v", stored.Env)
	}

	overview, err := svc.GetOverview(context.Background())
	if err != nil {
		t.Fatalf("reload overview failed: %v", err)
	}
	if got := overview.DefaultDNSProvider; got != "dns_cf" {
		t.Fatalf("unexpected default dns provider: got=%q want=%q", got, "dns_cf")
	}
}

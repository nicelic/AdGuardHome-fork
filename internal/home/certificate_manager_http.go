package home

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/nicelic/AdGuardHome-fork/internal/aghhttp"
)

type certificateManagerInstallRequest struct {
	Email   string `json:"email"`
	Version string `json:"version"`
}

type certificateManagerRemoveRequest struct {
	RemoveCertificates bool `json:"removeCertificates"`
}

type certificateManagerIssueRequest struct {
	Domains         string `json:"domains"`
	CertificateType string `json:"certificateType"`
	Challenge       string `json:"challenge"`
	Webroot         string `json:"webroot"`
	DNSProvider     string `json:"dnsProvider"`
	DNSEnvText      string `json:"dnsEnv"`
	Server          string `json:"server"`
	KeyLength       string `json:"keyLength"`
	CustomArgs      string `json:"customArgs"`
	AcmeAccountID   uint64 `json:"acmeAccountId"`
	DNSAccountID    uint64 `json:"dnsAccountId"`
	AutoRenew       *bool  `json:"autoRenew"`
	Remark          string `json:"remark"`
	PushDir         string `json:"pushDir"`
}

type certificateManagerRenewRequest struct {
	ID    uint64 `json:"id"`
	Force bool   `json:"force"`
}

type certificateManagerPushRequest struct {
	ID        uint64 `json:"id"`
	TargetDir string `json:"targetDir"`
}

type certificateManagerAutoRenewRequest struct {
	ID        uint64 `json:"id"`
	AutoRenew *bool  `json:"autoRenew"`
}

type certificateManagerDeleteRequest struct {
	ID uint64 `json:"id"`
}

type certificateManagerApplyRequest struct {
	ID     uint64 `json:"id"`
	Target string `json:"target"`
}

type certificateManagerContactEmailRequest struct {
	Email string `json:"email"`
}

type certificateManagerAcmeAccountSaveRequest struct {
	ID        uint64 `json:"id"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	Server    string `json:"server"`
	KeyLength string `json:"keyLength"`
	Remark    string `json:"remark"`
}

type certificateManagerDNSAccountSaveRequest struct {
	ID           uint64            `json:"id"`
	Name         string            `json:"name"`
	ProviderCode string            `json:"providerCode"`
	Env          map[string]string `json:"env"`
	Remark       string            `json:"remark"`
}

func (web *webAPI) registerCertificateManagerHandlers() {
	web.httpReg.Register(http.MethodGet, "/control/certificate_manager/acme-overview", web.handleCertificateManagerOverview)
	web.httpReg.Register(http.MethodGet, "/control/certificate_manager/acme-versions", web.handleCertificateManagerVersions)
	web.httpReg.Register(http.MethodGet, "/control/certificate_manager/acme-update-info", web.handleCertificateManagerUpdateInfo)
	web.httpReg.Register(http.MethodGet, "/control/certificate_manager/ip-options", web.handleCertificateManagerIPOptions)
	web.httpReg.Register(http.MethodGet, "/control/certificate_manager/certificate-list", web.handleCertificateManagerCertificateList)
	web.httpReg.Register(http.MethodGet, "/control/certificate_manager/certificate-material", web.handleCertificateManagerCertificateMaterial)

	web.httpReg.Register(http.MethodPost, "/control/certificate_manager/acme-install", web.handleCertificateManagerInstall)
	web.httpReg.Register(http.MethodPost, "/control/certificate_manager/acme-remove", web.handleCertificateManagerRemove)
	web.httpReg.Register(http.MethodPost, "/control/certificate_manager/acme-upgrade", web.handleCertificateManagerUpgrade)
	web.httpReg.Register(http.MethodPost, "/control/certificate_manager/acme-issue", web.handleCertificateManagerIssue)
	web.httpReg.Register(http.MethodPost, "/control/certificate_manager/acme-renew", web.handleCertificateManagerRenew)
	web.httpReg.Register(http.MethodPost, "/control/certificate_manager/acme-push", web.handleCertificateManagerPush)
	web.httpReg.Register(http.MethodPost, "/control/certificate_manager/acme-set-auto-renew", web.handleCertificateManagerSetAutoRenew)
	web.httpReg.Register(http.MethodPost, "/control/certificate_manager/acme-apply", web.handleCertificateManagerApply)
	web.httpReg.Register(http.MethodPost, "/control/certificate_manager/acme-unapply", web.handleCertificateManagerUnapply)
	web.httpReg.Register(http.MethodPost, "/control/certificate_manager/acme-delete", web.handleCertificateManagerDelete)
	web.httpReg.Register(http.MethodPost, "/control/certificate_manager/acme-contact-email-save", web.handleCertificateManagerSaveContactEmail)
	web.httpReg.Register(http.MethodPost, "/control/certificate_manager/acme-account-save", web.handleCertificateManagerSaveAcmeAccount)
	web.httpReg.Register(http.MethodPost, "/control/certificate_manager/acme-account-delete", web.handleCertificateManagerDeleteAcmeAccount)
	web.httpReg.Register(http.MethodPost, "/control/certificate_manager/acme-dns-account-save", web.handleCertificateManagerSaveDNSAccount)
	web.httpReg.Register(http.MethodPost, "/control/certificate_manager/acme-dns-account-delete", web.handleCertificateManagerDeleteDNSAccount)
}

func (web *webAPI) handleCertificateManagerOverview(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	overview, err := web.certManager.GetOverview(ctx)
	if err != nil {
		aghhttp.ErrorAndLog(ctx, web.logger, r, w, http.StatusInternalServerError, "%s", err)

		return
	}

	aghhttp.WriteJSONResponseOK(ctx, web.logger, w, r, overview)
}

func (web *webAPI) handleCertificateManagerVersions(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	page := 1
	if raw := r.URL.Query().Get("page"); raw != "" {
		parsed, parseErr := strconv.Atoi(raw)
		if parseErr != nil || parsed <= 0 {
			aghhttp.ErrorAndLog(ctx, web.logger, r, w, http.StatusBadRequest, "invalid page: %q", raw)

			return
		}

		page = parsed
	}

	perPage := 5
	if raw := r.URL.Query().Get("per_page"); raw != "" {
		parsed, parseErr := strconv.Atoi(raw)
		if parseErr != nil || parsed <= 0 {
			aghhttp.ErrorAndLog(ctx, web.logger, r, w, http.StatusBadRequest, "invalid per_page: %q", raw)

			return
		}

		perPage = parsed
	}

	result, err := web.certManager.GetRemoteVersionsPage(ctx, page, perPage)
	if err != nil {
		aghhttp.ErrorAndLog(ctx, web.logger, r, w, http.StatusBadGateway, "%s", err)

		return
	}

	aghhttp.WriteJSONResponseOK(ctx, web.logger, w, r, result)
}

func (web *webAPI) handleCertificateManagerUpdateInfo(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	result, err := web.certManager.CheckUpdate(ctx)
	if err != nil {
		aghhttp.ErrorAndLog(ctx, web.logger, r, w, http.StatusBadGateway, "%s", err)

		return
	}

	aghhttp.WriteJSONResponseOK(ctx, web.logger, w, r, result)
}

func (web *webAPI) handleCertificateManagerIPOptions(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	result, err := web.certManager.GetIPOptions(ctx)
	if err != nil {
		aghhttp.ErrorAndLog(ctx, web.logger, r, w, http.StatusBadGateway, "%s", err)

		return
	}

	aghhttp.WriteJSONResponseOK(ctx, web.logger, w, r, result)
}

func (web *webAPI) handleCertificateManagerCertificateList(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	views, err := web.certManager.ListCertificateViews()
	if err != nil {
		aghhttp.ErrorAndLog(ctx, web.logger, r, w, http.StatusInternalServerError, "%s", err)

		return
	}

	aghhttp.WriteJSONResponseOK(ctx, web.logger, w, r, views)
}

func (web *webAPI) handleCertificateManagerCertificateMaterial(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	id, err := readUintQuery(r, "id")
	if err != nil {
		aghhttp.ErrorAndLog(ctx, web.logger, r, w, http.StatusBadRequest, "%s", err)

		return
	}

	view, err := web.certManager.GetCertificateMaterial(id)
	if err != nil {
		aghhttp.ErrorAndLog(ctx, web.logger, r, w, http.StatusBadRequest, "%s", err)

		return
	}

	aghhttp.WriteJSONResponseOK(ctx, web.logger, w, r, view)
}

func (web *webAPI) handleCertificateManagerInstall(w http.ResponseWriter, r *http.Request) {
	req := certificateManagerInstallRequest{}
	web.handleCertificateManagerJSONAction(w, r, &req, func() (any, error) {
		return web.certManager.InstallOrReinstall(r.Context(), certificateManagerInstallPayload{
			Email:   req.Email,
			Version: req.Version,
		})
	})
}

func (web *webAPI) handleCertificateManagerRemove(w http.ResponseWriter, r *http.Request) {
	req := certificateManagerRemoveRequest{}
	web.handleCertificateManagerJSONAction(w, r, &req, func() (any, error) {
		return web.certManager.RemoveManagedAcme(req.RemoveCertificates)
	})
}

func (web *webAPI) handleCertificateManagerUpgrade(w http.ResponseWriter, r *http.Request) {
	web.handleCertificateManagerJSONAction(w, r, nil, func() (any, error) {
		return web.certManager.Upgrade(r.Context())
	})
}

func (web *webAPI) handleCertificateManagerIssue(w http.ResponseWriter, r *http.Request) {
	req := certificateManagerIssueRequest{}
	web.handleCertificateManagerJSONAction(w, r, &req, func() (any, error) {
		autoRenew := true
		if req.AutoRenew != nil {
			autoRenew = *req.AutoRenew
		}

		return web.certManager.Issue(r.Context(), certificateManagerIssuePayload{
			Domains:         req.Domains,
			CertificateType: req.CertificateType,
			Challenge:       req.Challenge,
			Webroot:         req.Webroot,
			DNSProvider:     req.DNSProvider,
			DNSEnvText:      req.DNSEnvText,
			Server:          req.Server,
			KeyLength:       req.KeyLength,
			CustomArgs:      req.CustomArgs,
			AcmeAccountID:   req.AcmeAccountID,
			DNSAccountID:    req.DNSAccountID,
			AutoRenew:       autoRenew,
			Remark:          req.Remark,
			PushDir:         req.PushDir,
		})
	})
}

func (web *webAPI) handleCertificateManagerRenew(w http.ResponseWriter, r *http.Request) {
	req := certificateManagerRenewRequest{}
	web.handleCertificateManagerJSONAction(w, r, &req, func() (any, error) {
		return web.certManager.Renew(r.Context(), certificateManagerRenewPayload{
			ID:    req.ID,
			Force: req.Force,
		})
	})
}

func (web *webAPI) handleCertificateManagerPush(w http.ResponseWriter, r *http.Request) {
	req := certificateManagerPushRequest{}
	web.handleCertificateManagerJSONAction(w, r, &req, func() (any, error) {
		return web.certManager.Push(req.ID, req.TargetDir)
	})
}

func (web *webAPI) handleCertificateManagerSetAutoRenew(w http.ResponseWriter, r *http.Request) {
	req := certificateManagerAutoRenewRequest{}
	web.handleCertificateManagerJSONAction(w, r, &req, func() (any, error) {
		if req.AutoRenew == nil {
			return nil, fmt.Errorf("autoRenew is required")
		}

		return web.certManager.SetAutoRenew(req.ID, *req.AutoRenew)
	})
}

func (web *webAPI) handleCertificateManagerDelete(w http.ResponseWriter, r *http.Request) {
	req := certificateManagerDeleteRequest{}
	web.handleCertificateManagerJSONAction(w, r, &req, func() (any, error) {
		return web.certManager.Delete(r.Context(), req.ID)
	})
}

func (web *webAPI) handleCertificateManagerApply(w http.ResponseWriter, r *http.Request) {
	req := certificateManagerApplyRequest{}
	web.handleCertificateManagerJSONAction(w, r, &req, func() (any, error) {
		return web.certManager.ApplyCertificate(r.Context(), req.ID, req.Target)
	})
}

func (web *webAPI) handleCertificateManagerUnapply(w http.ResponseWriter, r *http.Request) {
	req := certificateManagerApplyRequest{}
	web.handleCertificateManagerJSONAction(w, r, &req, func() (any, error) {
		return web.certManager.UnapplyCertificate(r.Context(), req.ID, req.Target)
	})
}

func (web *webAPI) handleCertificateManagerSaveContactEmail(w http.ResponseWriter, r *http.Request) {
	req := certificateManagerContactEmailRequest{}
	web.handleCertificateManagerJSONAction(w, r, &req, func() (any, error) {
		return web.certManager.SaveContactEmail(req.Email)
	})
}

func (web *webAPI) handleCertificateManagerSaveAcmeAccount(w http.ResponseWriter, r *http.Request) {
	req := certificateManagerAcmeAccountSaveRequest{}
	web.handleCertificateManagerJSONAction(w, r, &req, func() (any, error) {
		return web.certManager.SaveAcmeAccount(certificateManagerAcmeAccount{
			ID:        req.ID,
			Name:      req.Name,
			Email:     req.Email,
			Server:    req.Server,
			KeyLength: req.KeyLength,
			Remark:    req.Remark,
		})
	})
}

func (web *webAPI) handleCertificateManagerDeleteAcmeAccount(w http.ResponseWriter, r *http.Request) {
	req := certificateManagerDeleteRequest{}
	web.handleCertificateManagerJSONAction(w, r, &req, func() (any, error) {
		return web.certManager.DeleteAcmeAccount(req.ID)
	})
}

func (web *webAPI) handleCertificateManagerSaveDNSAccount(w http.ResponseWriter, r *http.Request) {
	req := certificateManagerDNSAccountSaveRequest{}
	web.handleCertificateManagerJSONAction(w, r, &req, func() (any, error) {
		return web.certManager.SaveDNSAccount(certificateManagerDNSAccount{
			ID:           req.ID,
			Name:         req.Name,
			ProviderCode: req.ProviderCode,
			Env:          req.Env,
			Remark:       req.Remark,
		})
	})
}

func (web *webAPI) handleCertificateManagerDeleteDNSAccount(w http.ResponseWriter, r *http.Request) {
	req := certificateManagerDeleteRequest{}
	web.handleCertificateManagerJSONAction(w, r, &req, func() (any, error) {
		return web.certManager.DeleteDNSAccount(req.ID)
	})
}

func (web *webAPI) handleCertificateManagerJSONAction(
	w http.ResponseWriter,
	r *http.Request,
	dst any,
	action func() (any, error),
) {
	ctx := r.Context()

	if dst != nil {
		err := decodeJSONBody(r, dst)
		if err != nil {
			aghhttp.ErrorAndLog(ctx, web.logger, r, w, http.StatusBadRequest, "json decode: %s", err)

			return
		}
	}

	resp, err := action()
	if err != nil {
		aghhttp.ErrorAndLog(ctx, web.logger, r, w, http.StatusBadRequest, "%s", err)

		return
	}

	aghhttp.WriteJSONResponseOK(ctx, web.logger, w, r, resp)
}

func decodeJSONBody(r *http.Request, dst any) (err error) {
	if r.ContentLength == 0 {
		return nil
	}

	return json.NewDecoder(r.Body).Decode(dst)
}

func readUintQuery(r *http.Request, key string) (id uint64, err error) {
	value := r.URL.Query().Get(key)
	if value == "" {
		return 0, strconv.ErrSyntax
	}

	return strconv.ParseUint(value, 10, 64)
}

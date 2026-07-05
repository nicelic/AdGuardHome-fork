package filtering

import (
	"encoding/json"
	"net/http"

	"github.com/nicelic/AdGuardHome-fork/internal/aghhttp"
)

// rewriteText is the HTTP payload for classic text DNS rewrite rules.
type rewriteText struct {
	Rules string `json:"rules"`
}

// rewriteSettings contains DNS rewrite settings.
type rewriteSettings struct {
	// Enabled indicates whether classic rewrites are applied.
	Enabled bool `json:"enabled"`
}

// handleRewriteTextGet is the handler for the GET /control/rewrite/text HTTP
// API.
func (d *DNSFilter) handleRewriteTextGet(w http.ResponseWriter, r *http.Request) {
	resp := &rewriteText{}
	func() {
		d.confMu.RLock()
		defer d.confMu.RUnlock()

		resp.Rules = d.conf.Rewrites
	}()

	aghhttp.WriteJSONResponseOK(r.Context(), d.logger, w, r, resp)
}

// handleRewriteTextUpdate is the handler for the PUT /control/rewrite/text HTTP
// API.
func (d *DNSFilter) handleRewriteTextUpdate(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	req := &rewriteText{}
	err := json.NewDecoder(r.Body).Decode(req)
	if err != nil {
		aghhttp.ErrorAndLog(ctx, d.logger, r, w, http.StatusBadRequest, "json.Decode: %s", err)

		return
	}

	compiled, err := parseTextRewriteRules(req.Rules)
	if err != nil {
		aghhttp.ErrorAndLog(ctx, d.logger, r, w, http.StatusBadRequest, "%s", err)

		return
	}

	d.confMu.Lock()
	d.conf.Rewrites = req.Rules
	d.conf.rewrites = compiled
	d.confMu.Unlock()

	d.conf.ConfModifier.Apply(ctx)
}

// handleRewriteSettings is the handler for the GET /control/rewrite/settings
// HTTP API.
func (d *DNSFilter) handleRewriteSettings(w http.ResponseWriter, r *http.Request) {
	resp := &rewriteSettings{
		Enabled: protectedBool(d.confMu, &d.conf.RewritesEnabled),
	}

	aghhttp.WriteJSONResponseOK(r.Context(), d.logger, w, r, resp)
}

// handleRewriteSettingsUpdate is the handler for the PUT
// /control/rewrite/settings/update HTTP API.
func (d *DNSFilter) handleRewriteSettingsUpdate(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	req := &rewriteSettings{}
	err := json.NewDecoder(r.Body).Decode(req)
	if err != nil {
		aghhttp.ErrorAndLog(ctx, d.logger, r, w, http.StatusBadRequest, "json.Decode: %s", err)

		return
	}

	setProtectedBool(d.confMu, &d.conf.RewritesEnabled, req.Enabled)
	d.conf.ConfModifier.Apply(ctx)
}

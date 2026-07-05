package filtering

import (
	"encoding/json"
	"net/http"

	"github.com/nicelic/AdGuardHome-fork/internal/aghhttp"
)

// simpleListText is the HTTP payload for simple allowlist and blocklist rules.
type simpleListText struct {
	Rules string `json:"rules"`
}

// handleSimpleAllowlistTextGet is the handler for the
// GET /control/simple_allowlist/text HTTP API.
func (d *DNSFilter) handleSimpleAllowlistTextGet(w http.ResponseWriter, r *http.Request) {
	resp := &simpleListText{}
	func() {
		d.confMu.RLock()
		defer d.confMu.RUnlock()

		resp.Rules = d.conf.SimpleAllowlist
	}()

	aghhttp.WriteJSONResponseOK(r.Context(), d.logger, w, r, resp)
}

// handleSimpleAllowlistTextUpdate is the handler for the
// PUT /control/simple_allowlist/text HTTP API.
func (d *DNSFilter) handleSimpleAllowlistTextUpdate(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	req := &simpleListText{}
	err := json.NewDecoder(r.Body).Decode(req)
	if err != nil {
		aghhttp.ErrorAndLog(ctx, d.logger, r, w, http.StatusBadRequest, "json.Decode: %s", err)

		return
	}

	compiled, err := parseSimpleListRules(req.Rules)
	if err != nil {
		aghhttp.ErrorAndLog(ctx, d.logger, r, w, http.StatusBadRequest, "%s", err)

		return
	}

	d.confMu.Lock()
	d.conf.SimpleAllowlist = req.Rules
	d.conf.simpleAllowRules = compiled
	d.confMu.Unlock()

	d.conf.ConfModifier.Apply(ctx)
}

// handleSimpleBlocklistTextGet is the handler for the
// GET /control/simple_blocklist/text HTTP API.
func (d *DNSFilter) handleSimpleBlocklistTextGet(w http.ResponseWriter, r *http.Request) {
	resp := &simpleListText{}
	func() {
		d.confMu.RLock()
		defer d.confMu.RUnlock()

		resp.Rules = d.conf.SimpleBlocklist
	}()

	aghhttp.WriteJSONResponseOK(r.Context(), d.logger, w, r, resp)
}

// handleSimpleBlocklistTextUpdate is the handler for the
// PUT /control/simple_blocklist/text HTTP API.
func (d *DNSFilter) handleSimpleBlocklistTextUpdate(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	req := &simpleListText{}
	err := json.NewDecoder(r.Body).Decode(req)
	if err != nil {
		aghhttp.ErrorAndLog(ctx, d.logger, r, w, http.StatusBadRequest, "json.Decode: %s", err)

		return
	}

	compiled, err := parseSimpleListRules(req.Rules)
	if err != nil {
		aghhttp.ErrorAndLog(ctx, d.logger, r, w, http.StatusBadRequest, "%s", err)

		return
	}

	d.confMu.Lock()
	d.conf.SimpleBlocklist = req.Rules
	d.conf.simpleBlockRules = compiled
	d.confMu.Unlock()

	d.conf.ConfModifier.Apply(ctx)
}

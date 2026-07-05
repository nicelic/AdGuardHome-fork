package home

import (
	"encoding/json"
	"net/http"
	"unicode/utf8"

	"github.com/nicelic/AdGuardHome-fork/internal/aghhttp"
	"github.com/AdguardTeam/golibs/httphdr"
)

// adminUpdateJSON is an object for the /control/admin/update endpoint.
type adminUpdateJSON struct {
	CurrentName     string `json:"current_name"`
	CurrentPassword string `json:"current_password"`
	NewName         string `json:"new_name"`
	NewPassword     string `json:"new_password"`
}

// handleAdminUpdate is the handler for PUT /control/admin/update endpoint.
func (web *webAPI) handleAdminUpdate(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	l := web.logger

	req := &adminUpdateJSON{}
	err := json.NewDecoder(r.Body).Decode(req)
	if err != nil {
		aghhttp.ErrorAndLog(ctx, l, r, w, http.StatusBadRequest, "reading req: %s", err)

		return
	}

	u, ok := webUserFromContext(ctx)
	if !ok || u == nil {
		w.WriteHeader(http.StatusUnauthorized)

		return
	}

	if string(u.Login) != req.CurrentName || !u.Password.Authenticate(ctx, req.CurrentPassword) {
		aghhttp.ErrorAndLog(ctx, l, r, w, http.StatusForbidden, "%s", errInvalidLogin)

		return
	}

	if utf8.RuneCountInString(req.NewPassword) < PasswordMinRunes {
		aghhttp.ErrorAndLog(
			ctx,
			l,
			r,
			w,
			http.StatusUnprocessableEntity,
			"password must be at least %d symbols long",
			PasswordMinRunes,
		)

		return
	}

	err = web.auth.updateUserCredentials(ctx, u, req.NewName, req.NewPassword)
	if err != nil {
		aghhttp.ErrorAndLog(ctx, l, r, w, http.StatusUnprocessableEntity, "%s", err)

		return
	}

	web.confModifier.Apply(ctx)

	http.SetCookie(w, expiredSessionCookie(panelSessionCookiePath(r)))

	h := w.Header()
	h.Set(httphdr.CacheControl, "no-store, no-cache, must-revalidate, proxy-revalidate")
	h.Set(httphdr.Pragma, "no-cache")
	h.Set(httphdr.Expires, "0")

	aghhttp.OK(ctx, l, w)
}

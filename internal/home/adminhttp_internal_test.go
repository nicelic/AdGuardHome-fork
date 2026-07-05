package home

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/nicelic/AdGuardHome-fork/internal/aghtest"
	"github.com/nicelic/AdGuardHome-fork/internal/aghuser"
	"github.com/AdguardTeam/golibs/httphdr"
	"github.com/AdguardTeam/golibs/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWeb_HandleAdminUpdate(t *testing.T) {
	storeGlobals(t)

	const (
		userName        = "name"
		userPassword    = "password"
		userNewName     = "renamed"
		userNewPassword = "new-password"
	)

	sessionsDB := filepath.Join(t.TempDir(), "sessions.db")
	baseMux := http.NewServeMux()

	auth, err := newAuth(testutil.ContextWithTimeout(t, testTimeout), &authConfig{
		baseLogger:     testLogger,
		mux:            baseMux,
		rateLimiter:    emptyRateLimiter{},
		trustedProxies: testTrustedProxies,
		dbFilename:     sessionsDB,
		users:          nil,
		sessionTTL:     time.Minute,
		isGLiNet:       false,
	})
	require.NoError(t, err)

	t.Cleanup(func() { auth.close(testutil.ContextWithTimeout(t, testTimeout)) })

	ctx := testutil.ContextWithTimeout(t, testTimeout)
	err = auth.addUser(ctx, &webUser{Name: userName}, userPassword)
	require.NoError(t, err)

	user, err := auth.users.ByLogin(ctx, aghuser.Login(userName))
	require.NoError(t, err)
	require.NotNil(t, user)

	session, err := auth.sessions.New(ctx, user)
	require.NoError(t, err)

	applied := false
	web := newTestWeb(t, &webConfig{
		auth: auth,
		mux:  baseMux,
		configModifier: &aghtest.ConfigModifier{
			OnApply: func(_ context.Context) {
				applied = true
			},
		},
	})

	globalContext.web = web

	makeRequest := func(body adminUpdateJSON, reqCtx context.Context) *http.Request {
		reqBody, marshalErr := json.Marshal(body)
		require.NoError(t, marshalErr)

		req := httptest.NewRequest(http.MethodPut, "/control/admin/update", bytes.NewReader(reqBody))
		req.Header.Set(httphdr.ContentType, "application/json")
		if reqCtx != nil {
			req = req.WithContext(reqCtx)
		}

		return req
	}

	t.Run("success", func(t *testing.T) {
		applied = false

		reqCtx := withWebUser(context.Background(), user)
		w := httptest.NewRecorder()
		web.handleAdminUpdate(w, makeRequest(adminUpdateJSON{
			CurrentName:     userName,
			CurrentPassword: userPassword,
			NewName:         userNewName,
			NewPassword:     userNewPassword,
		}, reqCtx))

		assert.Equal(t, http.StatusOK, w.Code)
		assert.Equal(t, "OK\n", w.Body.String())
		assert.True(t, applied)
		assert.Contains(t, w.Header().Get(httphdr.SetCookie), "agh_session=")
		assert.Contains(t, w.Header().Get(httphdr.SetCookie), "Path=/")

		gotUser, userErr := auth.users.ByLogin(ctx, aghuser.Login(userName))
		require.NoError(t, userErr)
		assert.Nil(t, gotUser)

		gotUser, userErr = auth.users.ByLogin(ctx, aghuser.Login(userNewName))
		require.NoError(t, userErr)
		require.NotNil(t, gotUser)
		assert.True(t, gotUser.Password.Authenticate(ctx, userNewPassword))

		gotSession, sessionErr := auth.sessions.FindByToken(ctx, session.Token)
		require.NoError(t, sessionErr)
		assert.Nil(t, gotSession)
	})

	t.Run("invalid_current_password", func(t *testing.T) {
		auth2, err2 := newAuth(testutil.ContextWithTimeout(t, testTimeout), &authConfig{
			baseLogger:     testLogger,
			mux:            http.NewServeMux(),
			rateLimiter:    emptyRateLimiter{},
			trustedProxies: testTrustedProxies,
			dbFilename:     filepath.Join(t.TempDir(), "sessions.db"),
			users:          nil,
			sessionTTL:     time.Minute,
			isGLiNet:       false,
		})
		require.NoError(t, err2)
		t.Cleanup(func() { auth2.close(testutil.ContextWithTimeout(t, testTimeout)) })

		err2 = auth2.addUser(ctx, &webUser{Name: userName}, userPassword)
		require.NoError(t, err2)

		user2, err2 := auth2.users.ByLogin(ctx, aghuser.Login(userName))
		require.NoError(t, err2)
		require.NotNil(t, user2)

		session2, err2 := auth2.sessions.New(ctx, user2)
		require.NoError(t, err2)

		web2 := newTestWeb(t, &webConfig{
			auth: auth2,
			mux:  http.NewServeMux(),
		})

		reqCtx := withWebUser(context.Background(), user2)
		w := httptest.NewRecorder()
		web2.handleAdminUpdate(w, makeRequest(adminUpdateJSON{
			CurrentName:     userName,
			CurrentPassword: "wrong-password",
			NewName:         userNewName,
			NewPassword:     userNewPassword,
		}, reqCtx))

		assert.Equal(t, http.StatusForbidden, w.Code)

		gotUser, userErr := auth2.users.ByLogin(ctx, aghuser.Login(userName))
		require.NoError(t, userErr)
		require.NotNil(t, gotUser)
		assert.True(t, gotUser.Password.Authenticate(ctx, userPassword))

		gotSession, sessionErr := auth2.sessions.FindByToken(ctx, session2.Token)
		require.NoError(t, sessionErr)
		require.NotNil(t, gotSession)
	})

	t.Run("unauthorized", func(t *testing.T) {
		w := httptest.NewRecorder()
		web.handleAdminUpdate(w, makeRequest(adminUpdateJSON{
			CurrentName:     userNewName,
			CurrentPassword: userNewPassword,
			NewName:         userName,
			NewPassword:     userPassword,
		}, nil))

		assert.Equal(t, http.StatusUnauthorized, w.Code)
	})
}

package home

import (
	"net/http"
	"path/filepath"
	"testing"

	"github.com/nicelic/AdGuardHome-fork/internal/aghuser"
	"github.com/AdguardTeam/golibs/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
)

func TestAuth_UsersList(t *testing.T) {
	const (
		userName        = "name"
		userPassword    = "password"
		userNewName     = "renamed"
		userNewPassword = "new-password"
	)

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(userPassword), bcrypt.DefaultCost)
	require.NoError(t, err)

	sessionsDB := filepath.Join(t.TempDir(), "sessions.db")

	user := webUser{
		Name:         userName,
		PasswordHash: string(passwordHash),
		UserID:       aghuser.MustNewUserID(),
	}

	auth, err := newAuth(testutil.ContextWithTimeout(t, testTimeout), &authConfig{
		baseLogger:     testLogger,
		mux:            http.NewServeMux(),
		rateLimiter:    emptyRateLimiter{},
		trustedProxies: testTrustedProxies,
		dbFilename:     sessionsDB,
		users:          nil,
		sessionTTL:     testTimeout,
		isGLiNet:       false,
	})
	require.NoError(t, err)

	t.Cleanup(func() { auth.close(testutil.ContextWithTimeout(t, testTimeout)) })

	ctx := testutil.ContextWithTimeout(t, testTimeout)

	assert.Empty(t, auth.usersList(ctx))

	err = auth.addUser(ctx, &user, userPassword)
	require.NoError(t, err)

	assert.Equal(t, []webUser{user}, auth.usersList(ctx))

	cur, err := auth.users.ByLogin(ctx, aghuser.Login(userName))
	require.NoError(t, err)
	require.NotNil(t, cur)

	sess, err := auth.sessions.New(ctx, cur)
	require.NoError(t, err)

	err = auth.updateUserCredentials(ctx, cur, userNewName, userNewPassword)
	require.NoError(t, err)

	gotUser, err := auth.users.ByLogin(ctx, aghuser.Login(userName))
	require.NoError(t, err)
	assert.Nil(t, gotUser)

	gotUser, err = auth.users.ByLogin(ctx, aghuser.Login(userNewName))
	require.NoError(t, err)
	require.NotNil(t, gotUser)
	assert.True(t, gotUser.Password.Authenticate(ctx, userNewPassword))

	gotSess, err := auth.sessions.FindByToken(ctx, sess.Token)
	require.NoError(t, err)
	assert.Nil(t, gotSess)

	users := auth.usersList(ctx)
	require.Len(t, users, 1)
	assert.Equal(t, userNewName, users[0].Name)
	assert.NotEqual(t, user.PasswordHash, users[0].PasswordHash)
}

package aghuser_test

import (
	"testing"

	"github.com/nicelic/AdGuardHome-fork/internal/aghuser"
	"github.com/AdguardTeam/golibs/errors"
	"github.com/AdguardTeam/golibs/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
)

func TestDB(t *testing.T) {
	db := aghuser.NewDefaultDB()

	const (
		userWithIDPassRaw  = "user_with_id_password"
		userSecondPassRaw  = "user_second_password"
		userUpdatedPassRaw = "user_updated_password"
	)

	userWithIDPassHash, err := bcrypt.GenerateFromPassword(
		[]byte(userWithIDPassRaw),
		bcrypt.DefaultCost,
	)
	require.NoError(t, err)

	userSecondPassHash, err := bcrypt.GenerateFromPassword(
		[]byte(userSecondPassRaw),
		bcrypt.DefaultCost,
	)
	require.NoError(t, err)

	userUpdatedPassHash, err := bcrypt.GenerateFromPassword(
		[]byte(userUpdatedPassRaw),
		bcrypt.DefaultCost,
	)
	require.NoError(t, err)

	userWithIDPass := aghuser.NewDefaultPassword(string(userWithIDPassHash))
	userSecondPass := aghuser.NewDefaultPassword(string(userSecondPassHash))
	userUpdatedPass := aghuser.NewDefaultPassword(string(userUpdatedPassHash))

	var (
		userWithID = &aghuser.User{
			ID:       aghuser.MustNewUserID(),
			Login:    "user_with_id",
			Password: userWithIDPass,
		}
		userSecond = &aghuser.User{
			ID:       aghuser.MustNewUserID(),
			Login:    "user_second",
			Password: userSecondPass,
		}
		userDuplicateLogin = &aghuser.User{
			ID:       aghuser.MustNewUserID(),
			Login:    userWithID.Login,
			Password: userWithIDPass,
		}
	)

	ctx := testutil.ContextWithTimeout(t, testTimeout)

	err = db.Create(ctx, userWithID)
	require.NoError(t, err)

	err = db.Create(ctx, userSecond)
	require.NoError(t, err)

	err = db.Create(ctx, userDuplicateLogin)
	assert.ErrorIs(t, err, errors.ErrDuplicated)

	got, err := db.ByUUID(ctx, userWithID.ID)
	require.NoError(t, err)

	assert.Equal(t, userWithID, got)
	assert.True(t, got.Password.Authenticate(ctx, userWithIDPassRaw))

	got, err = db.ByLogin(ctx, userSecond.Login)
	require.NoError(t, err)

	assert.Equal(t, userSecond, got)
	assert.True(t, got.Password.Authenticate(ctx, userSecondPassRaw))

	users, err := db.All(ctx)
	require.NoError(t, err)

	assert.Len(t, users, 2)
	assert.Equal(t, []*aghuser.User{userSecond, userWithID}, users)

	userUpdated := &aghuser.User{
		ID:       userSecond.ID,
		Login:    "user_updated",
		Password: userUpdatedPass,
	}

	err = db.Update(ctx, userUpdated)
	require.NoError(t, err)

	got, err = db.ByLogin(ctx, userSecond.Login)
	require.NoError(t, err)

	assert.Nil(t, got)

	got, err = db.ByLogin(ctx, userUpdated.Login)
	require.NoError(t, err)

	assert.Equal(t, userUpdated, got)
	assert.True(t, got.Password.Authenticate(ctx, userUpdatedPassRaw))

	err = db.Update(ctx, &aghuser.User{
		ID:       userUpdated.ID,
		Login:    userWithID.Login,
		Password: userUpdatedPass,
	})
	assert.ErrorIs(t, err, errors.ErrDuplicated)

	users, err = db.All(ctx)
	require.NoError(t, err)

	assert.Len(t, users, 2)
	assert.Equal(t, []*aghuser.User{userUpdated, userWithID}, users)
}

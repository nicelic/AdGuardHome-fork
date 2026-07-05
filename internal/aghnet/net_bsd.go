//go:build darwin || freebsd || openbsd

package aghnet

import (
	"context"
	"log/slog"

	"github.com/nicelic/AdGuardHome-fork/internal/aghos"
)

func canBindPrivilegedPorts(_ context.Context, _ *slog.Logger) (can bool, err error) {
	return aghos.HaveAdminRights()
}

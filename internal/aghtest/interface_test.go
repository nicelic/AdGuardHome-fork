package aghtest_test

import (
	"github.com/nicelic/AdGuardHome-fork/internal/aghtest"
	"github.com/nicelic/AdGuardHome-fork/internal/client"
)

// type check
//
// TODO(s.chzhen):  Resolve the import cycles and move it to aghtest.
var (
	_ client.AddressProcessor = (*aghtest.AddressProcessor)(nil)
	_ client.AddressUpdater   = (*aghtest.AddressUpdater)(nil)
)

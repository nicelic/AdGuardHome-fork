package home

import (
	"bytes"
	"cmp"
	"context"
	"log/slog"
	"net/http"
	"net/netip"
	"strings"
	"testing"
	"time"

	"github.com/nicelic/AdGuardHome-fork/internal/agh"
	"github.com/nicelic/AdGuardHome-fork/internal/aghhttp"
	"github.com/AdguardTeam/golibs/logutil/slogutil"
	"github.com/AdguardTeam/golibs/netutil"
	"github.com/AdguardTeam/golibs/netutil/urlutil"
	"github.com/AdguardTeam/golibs/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// testTimeout is the common timeout for tests and contexts.
const testTimeout = 1 * time.Second

// testLogger is a common logger for tests.
var testLogger = slogutil.NewDiscardLogger()

// testTrustedProxies is a common trusted proxies set for tests.
var testTrustedProxies = netutil.SliceSubnetSet([]netip.Prefix{})

// newTestWeb is a helper that creates new webAPI and fills it's config with
// given values.  If conf is nil, the default configuration will be used.
func newTestWeb(
	tb testing.TB,
	conf *webConfig,
) (web *webAPI) {
	tb.Helper()

	ctx := testutil.ContextWithTimeout(tb, testTimeout)
	conf = cmp.Or(conf, &webConfig{})

	web, err := newWeb(ctx, &webConfig{
		clientBuildFS:  conf.clientBuildFS,
		updater:        conf.updater,
		opts:           conf.opts,
		baseLogger:     cmp.Or(conf.baseLogger, testLogger),
		tlsManager:     conf.tlsManager,
		auth:           conf.auth,
		mux:            cmp.Or(conf.mux, http.NewServeMux()),
		configModifier: cmp.Or[agh.ConfigModifier](conf.configModifier, &agh.EmptyConfigModifier{}),
		httpReg:        cmp.Or[aghhttp.Registrar](conf.httpReg, &aghhttp.EmptyRegistrar{}),
		workDir:        conf.workDir,
		confPath:       conf.confPath,
		isCustomUpdURL: conf.isCustomUpdURL,
		isFirstRun:     conf.isFirstRun,
	})

	require.NoError(tb, err)

	return web
}

// storeGlobals is a test helper function that saves global variables and
// restores them once the test is complete.
//
// The global variables are:
//   - [config]
//   - [globalContext.clients.storage]
//   - [globalContext.dnsServer]
//   - [globalContext.web]
//
// TODO(s.chzhen):  Remove this once the TLS manager no longer accesses global
// variables.  Make tests that use this helper concurrent.
func storeGlobals(tb testing.TB) {
	tb.Helper()

	prevConfig := config
	storage := globalContext.clients.storage
	dnsServer := globalContext.dnsServer
	web := globalContext.web

	tb.Cleanup(func() {
		config = prevConfig
		globalContext.clients.storage = storage
		globalContext.dnsServer = dnsServer
		globalContext.web = web
	})
}

func TestMain(m *testing.M) {
	initCmdLineOpts()

	testutil.DiscardLogOutput(m)
}

func TestPrintHTTPAddresses_IncludesPanelPath(t *testing.T) {
	storeGlobals(t)

	config = &configuration{
		HTTPConfig: httpConfig{
			Address: netip.AddrPortFrom(netutil.IPv4Localhost(), 3000),
		},
		TLS: tlsConfigSettings{
			Enabled:            true,
			PanelServerName:    "panel.example.org",
			PanelServerURLPath: "/myui",
			PanelServerPort:    8443,
			PortHTTPS:          defaultPortHTTPS,
		},
	}

	var buf bytes.Buffer
	logger := slog.New(slog.NewTextHandler(&buf, nil))

	printHTTPAddresses(context.Background(), logger, urlutil.SchemeHTTPS, nil)
	assert.Contains(t, buf.String(), "url=https://panel.example.org:8443/myui/")

	buf.Reset()

	printHTTPAddresses(context.Background(), logger, urlutil.SchemeHTTP, nil)
	assert.True(t, strings.Contains(buf.String(), "url=http://127.0.0.1:3000/myui/"))
}

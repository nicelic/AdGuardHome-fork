package dnsforward

import (
	"net"
	"net/http"
	"net/netip"
	"testing"
	"time"

	"github.com/nicelic/AdGuardHome-fork/internal/aghnet"
	"github.com/nicelic/AdGuardHome-fork/internal/filtering"
	"github.com/nicelic/AdGuardHome-fork/internal/querylog"
	"github.com/nicelic/AdGuardHome-fork/internal/stats"
	"github.com/AdguardTeam/dnsproxy/proxy"
	"github.com/AdguardTeam/dnsproxy/upstream"
	"github.com/AdguardTeam/golibs/testutil"
	"github.com/miekg/dns"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// testQueryLog is a simple [querylog.QueryLog] implementation for tests.
type testQueryLog struct {
	// QueryLog is embedded here simply to make testQueryLog
	// a [querylog.QueryLog] without actually implementing all methods.
	querylog.QueryLog

	lastParams *querylog.AddParams
}

// Add implements the [querylog.QueryLog] interface for *testQueryLog.
func (l *testQueryLog) Add(p *querylog.AddParams) {
	l.lastParams = p
}

// ShouldLog implements the [querylog.QueryLog] interface for *testQueryLog.
func (l *testQueryLog) ShouldLog(string, uint16, uint16, []string) bool {
	return true
}

// testStats is a simple [stats.Interface] implementation for tests.
type testStats struct {
	// Stats is embedded here simply to make testStats a [stats.Interface]
	// without actually implementing all methods.
	stats.Interface

	lastEntry *stats.Entry
}

// Update implements the [stats.Interface] interface for *testStats.
func (l *testStats) Update(e *stats.Entry) {
	if e.Domain == "" {
		return
	}

	l.lastEntry = e
}

// ShouldCount implements the [stats.Interface] interface for *testStats.
func (l *testStats) ShouldCount(string, uint16, uint16, []string) bool {
	return true
}

type testDNSCryptResponseWriter struct {
	remoteAddr net.Addr
}

// LocalAddr implements the [dnscrypt.ResponseWriter] interface for
// *testDNSCryptResponseWriter.
func (w *testDNSCryptResponseWriter) LocalAddr() (addr net.Addr) {
	return &net.TCPAddr{}
}

// RemoteAddr implements the [dnscrypt.ResponseWriter] interface for
// *testDNSCryptResponseWriter.
func (w *testDNSCryptResponseWriter) RemoteAddr() (addr net.Addr) {
	return w.remoteAddr
}

// WriteMsg implements the [dnscrypt.ResponseWriter] interface for
// *testDNSCryptResponseWriter.
func (w *testDNSCryptResponseWriter) WriteMsg(_ *dns.Msg) (err error) {
	return nil
}

func TestServer_ProcessQueryLogsAndStats(t *testing.T) {
	const domain = "example.com."

	testCases := []struct {
		name                string
		domain              string
		proto               proxy.Proto
		addr                netip.AddrPort
		httpReq             *http.Request
		dnsCryptResponseWrt *testDNSCryptResponseWriter
		clientID            string
		wantLogProto        querylog.ClientProto
		wantLogTransport    querylog.ClientTransport
		wantStatClient      string
		wantCode            resultCode
		reason              filtering.Reason
		wantStatResult      stats.Result
	}{{
		name:             "success_udp",
		domain:           domain,
		proto:            proxy.ProtoUDP,
		addr:             testClientAddrPort,
		clientID:         "",
		wantLogProto:     "",
		wantLogTransport: querylog.ClientTransportUDP,
		wantStatClient:   "1.2.3.4",
		wantCode:         resultCodeSuccess,
		reason:           filtering.NotFilteredNotFound,
		wantStatResult:   stats.RNotFiltered,
	}, {
		name:             "success_tls_clientid",
		domain:           domain,
		proto:            proxy.ProtoTLS,
		addr:             testClientAddrPort,
		clientID:         "cli42",
		wantLogProto:     querylog.ClientProtoDoT,
		wantLogTransport: querylog.ClientTransportTCP,
		wantStatClient:   "cli42",
		wantCode:         resultCodeSuccess,
		reason:           filtering.NotFilteredNotFound,
		wantStatResult:   stats.RNotFiltered,
	}, {
		name:             "success_tls",
		domain:           domain,
		proto:            proxy.ProtoTLS,
		addr:             testClientAddrPort,
		clientID:         "",
		wantLogProto:     querylog.ClientProtoDoT,
		wantLogTransport: querylog.ClientTransportTCP,
		wantStatClient:   "1.2.3.4",
		wantCode:         resultCodeSuccess,
		reason:           filtering.NotFilteredNotFound,
		wantStatResult:   stats.RNotFiltered,
	}, {
		name:             "success_quic",
		domain:           domain,
		proto:            proxy.ProtoQUIC,
		addr:             testClientAddrPort,
		clientID:         "",
		wantLogProto:     querylog.ClientProtoDoQ,
		wantLogTransport: querylog.ClientTransportUDP,
		wantStatClient:   "1.2.3.4",
		wantCode:         resultCodeSuccess,
		reason:           filtering.NotFilteredNotFound,
		wantStatResult:   stats.RNotFiltered,
	}, {
		name:             "success_https",
		domain:           domain,
		proto:            proxy.ProtoHTTPS,
		addr:             testClientAddrPort,
		httpReq:          &http.Request{ProtoMajor: 2},
		clientID:         "",
		wantLogProto:     querylog.ClientProtoDoH,
		wantLogTransport: querylog.ClientTransportTCP,
		wantStatClient:   "1.2.3.4",
		wantCode:         resultCodeSuccess,
		reason:           filtering.NotFilteredNotFound,
		wantStatResult:   stats.RNotFiltered,
	}, {
		name:             "success_https_h3",
		domain:           domain,
		proto:            proxy.ProtoHTTPS,
		addr:             testClientAddrPort,
		httpReq:          &http.Request{ProtoMajor: 3},
		clientID:         "",
		wantLogProto:     querylog.ClientProtoDoH,
		wantLogTransport: querylog.ClientTransportUDP,
		wantStatClient:   "1.2.3.4",
		wantCode:         resultCodeSuccess,
		reason:           filtering.NotFilteredNotFound,
		wantStatResult:   stats.RNotFiltered,
	}, {
		name:   "success_dnscrypt_tcp",
		domain: domain,
		proto:  proxy.ProtoDNSCrypt,
		addr:   testClientAddrPort,
		dnsCryptResponseWrt: &testDNSCryptResponseWriter{
			remoteAddr: &net.TCPAddr{IP: net.IPv4(1, 2, 3, 4), Port: 1234},
		},
		clientID:         "",
		wantLogProto:     querylog.ClientProtoDNSCrypt,
		wantLogTransport: querylog.ClientTransportTCP,
		wantStatClient:   "1.2.3.4",
		wantCode:         resultCodeSuccess,
		reason:           filtering.NotFilteredNotFound,
		wantStatResult:   stats.RNotFiltered,
	}, {
		name:   "success_dnscrypt_udp",
		domain: domain,
		proto:  proxy.ProtoDNSCrypt,
		addr:   testClientAddrPort,
		dnsCryptResponseWrt: &testDNSCryptResponseWriter{
			remoteAddr: &net.UDPAddr{IP: net.IPv4(1, 2, 3, 4), Port: 1234},
		},
		clientID:         "",
		wantLogProto:     querylog.ClientProtoDNSCrypt,
		wantLogTransport: querylog.ClientTransportUDP,
		wantStatClient:   "1.2.3.4",
		wantCode:         resultCodeSuccess,
		reason:           filtering.NotFilteredNotFound,
		wantStatResult:   stats.RNotFiltered,
	}, {
		name:             "success_udp_filtered",
		domain:           domain,
		proto:            proxy.ProtoUDP,
		addr:             testClientAddrPort,
		clientID:         "",
		wantLogProto:     "",
		wantLogTransport: querylog.ClientTransportUDP,
		wantStatClient:   "1.2.3.4",
		wantCode:         resultCodeSuccess,
		reason:           filtering.FilteredBlockList,
		wantStatResult:   stats.RFiltered,
	}, {
		name:             "success_udp_sb",
		domain:           domain,
		proto:            proxy.ProtoUDP,
		addr:             testClientAddrPort,
		clientID:         "",
		wantLogProto:     "",
		wantLogTransport: querylog.ClientTransportUDP,
		wantStatClient:   "1.2.3.4",
		wantCode:         resultCodeSuccess,
		reason:           filtering.FilteredSafeBrowsing,
		wantStatResult:   stats.RSafeBrowsing,
	}, {
		name:             "success_udp_ss",
		domain:           domain,
		proto:            proxy.ProtoUDP,
		addr:             testClientAddrPort,
		clientID:         "",
		wantLogProto:     "",
		wantLogTransport: querylog.ClientTransportUDP,
		wantStatClient:   "1.2.3.4",
		wantCode:         resultCodeSuccess,
		reason:           filtering.FilteredSafeSearch,
		wantStatResult:   stats.RSafeSearch,
	}, {
		name:             "success_udp_pc",
		domain:           domain,
		proto:            proxy.ProtoUDP,
		addr:             testClientAddrPort,
		clientID:         "",
		wantLogProto:     "",
		wantLogTransport: querylog.ClientTransportUDP,
		wantStatClient:   "1.2.3.4",
		wantCode:         resultCodeSuccess,
		reason:           filtering.FilteredParental,
		wantStatResult:   stats.RParental,
	}, {
		name:             "success_udp_pc_empty_fqdn",
		domain:           ".",
		proto:            proxy.ProtoUDP,
		addr:             netip.MustParseAddrPort("4.3.2.1:1234"),
		clientID:         "",
		wantLogProto:     "",
		wantLogTransport: querylog.ClientTransportUDP,
		wantStatClient:   "4.3.2.1",
		wantCode:         resultCodeSuccess,
		reason:           filtering.FilteredParental,
		wantStatResult:   stats.RParental,
	}}

	ups, err := upstream.AddressToUpstream("1.1.1.1", nil)
	require.NoError(t, err)

	for _, tc := range testCases {
		ql := &testQueryLog{}
		st := &testStats{}
		srv := &Server{
			baseLogger: testLogger,
			logger:     testLogger,
			queryLog:   ql,
			stats:      st,
			anonymizer: aghnet.NewIPMut(nil),
		}
		t.Run(tc.name, func(t *testing.T) {
			req := &dns.Msg{
				Question: []dns.Question{{
					Name: tc.domain,
				}},
			}
			pctx := &proxy.DNSContext{
				Proto:                  tc.proto,
				Req:                    req,
				Res:                    &dns.Msg{},
				Addr:                   tc.addr,
				Upstream:               ups,
				HTTPRequest:            tc.httpReq,
				DNSCryptResponseWriter: tc.dnsCryptResponseWrt,
			}
			dctx := &dnsContext{
				proxyCtx:  pctx,
				startTime: time.Now(),
				result: &filtering.Result{
					Reason: tc.reason,
				},
				clientID: tc.clientID,
			}

			ctx := testutil.ContextWithTimeout(t, testTimeout)
			code := srv.processQueryLogsAndStats(ctx, testLogger, dctx)
			assert.Equal(t, tc.wantCode, code)
			assert.Equal(t, tc.wantLogProto, ql.lastParams.ClientProto)
			assert.Equal(t, tc.wantLogTransport, ql.lastParams.ClientTransport)
			assert.Equal(t, tc.wantStatClient, st.lastEntry.Client)
			assert.Equal(t, tc.wantStatResult, st.lastEntry.Result)
		})
	}
}

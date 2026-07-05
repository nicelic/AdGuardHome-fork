package dnsforward

import (
	"net"
	"net/netip"
	"testing"

	"github.com/nicelic/AdGuardHome-fork/internal/filtering"
	"github.com/AdguardTeam/dnsproxy/proxy"
	"github.com/AdguardTeam/golibs/netutil"
	"github.com/AdguardTeam/golibs/testutil"
	"github.com/AdguardTeam/urlfilter/rules"
	"github.com/miekg/dns"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestServer_FilterDNSRewrite(t *testing.T) {
	// Helper data.
	const domain = "example.com"
	ip4, ip6 := netutil.IPv4Localhost(), netutil.IPv6Localhost()
	mxVal := &rules.DNSMX{
		Exchange:   "mail.example.com",
		Preference: 32,
	}
	svcbVal := &rules.DNSSVCB{
		Params:   map[string]string{"alpn": "h3", "dohpath": "/dns-query"},
		Target:   dns.Fqdn(domain),
		Priority: 32,
	}
	srvVal := &rules.DNSSRV{
		Priority: 32,
		Weight:   60,
		Port:     8080,
		Target:   dns.Fqdn(domain),
	}

	// Helper functions and entities.
	srv := createTestServer(t, &filtering.Config{
		BlockingMode: filtering.BlockingModeDefault,
	}, ServerConfig{
		TLSConf: &TLSConfig{},
		Config: Config{
			UpstreamMode:     UpstreamModeLoadBalance,
			EDNSClientSubnet: &EDNSClientSubnet{Enabled: false},
			ClientsContainer: EmptyClientsContainer{},
		},
		ServePlainDNS: true,
	})

	makeQ := func(qtype rules.RRType) (req *dns.Msg) {
		return &dns.Msg{
			Question: []dns.Question{{
				Qtype: qtype,
			}},
		}
	}
	makeRes := func(rcode rules.RCode, rr rules.RRType, v rules.RRValue) (res *filtering.Result) {
		resp := filtering.DNSRewriteResultResponse{
			rr: []rules.RRValue{v},
		}
		return &filtering.Result{
			DNSRewriteResult: &filtering.DNSRewriteResult{
				RCode:    rcode,
				Response: resp,
			},
		}
	}

	// Tests.
	t.Run("nxdomain", func(t *testing.T) {
		req := makeQ(dns.TypeA)
		res := makeRes(dns.RcodeNameError, 0, nil)
		d := &proxy.DNSContext{}

		err := srv.filterDNSRewrite(testutil.ContextWithTimeout(t, testTimeout), req, res, d)
		require.NoError(t, err)

		assert.Equal(t, dns.RcodeNameError, d.Res.Rcode)
	})

	t.Run("noerror_empty", func(t *testing.T) {
		req := makeQ(dns.TypeA)
		res := makeRes(dns.RcodeSuccess, 0, nil)
		d := &proxy.DNSContext{}

		err := srv.filterDNSRewrite(testutil.ContextWithTimeout(t, testTimeout), req, res, d)
		require.NoError(t, err)

		assert.Equal(t, dns.RcodeSuccess, d.Res.Rcode)
		assert.Empty(t, d.Res.Answer)
	})

	t.Run("noerror_a", func(t *testing.T) {
		req := makeQ(dns.TypeA)
		res := makeRes(dns.RcodeSuccess, dns.TypeA, ip4)
		d := &proxy.DNSContext{}

		err := srv.filterDNSRewrite(testutil.ContextWithTimeout(t, testTimeout), req, res, d)
		require.NoError(t, err)

		assert.Equal(t, dns.RcodeSuccess, d.Res.Rcode)

		require.Len(t, d.Res.Answer, 1)
		assert.Equal(t, net.IP(ip4.AsSlice()), d.Res.Answer[0].(*dns.A).A)
	})

	t.Run("noerror_aaaa", func(t *testing.T) {
		req := makeQ(dns.TypeAAAA)
		res := makeRes(dns.RcodeSuccess, dns.TypeAAAA, ip6)
		d := &proxy.DNSContext{}

		err := srv.filterDNSRewrite(testutil.ContextWithTimeout(t, testTimeout), req, res, d)
		require.NoError(t, err)

		assert.Equal(t, dns.RcodeSuccess, d.Res.Rcode)

		require.Len(t, d.Res.Answer, 1)
		assert.Equal(t, net.IP(ip6.AsSlice()), d.Res.Answer[0].(*dns.AAAA).AAAA)
	})

	t.Run("noerror_ptr", func(t *testing.T) {
		req := makeQ(dns.TypePTR)
		res := makeRes(dns.RcodeSuccess, dns.TypePTR, domain)
		d := &proxy.DNSContext{}

		err := srv.filterDNSRewrite(testutil.ContextWithTimeout(t, testTimeout), req, res, d)
		require.NoError(t, err)

		assert.Equal(t, dns.RcodeSuccess, d.Res.Rcode)

		require.Len(t, d.Res.Answer, 1)
		assert.Equal(t, dns.Fqdn(domain), d.Res.Answer[0].(*dns.PTR).Ptr)
	})

	t.Run("noerror_txt", func(t *testing.T) {
		req := makeQ(dns.TypeTXT)
		res := makeRes(dns.RcodeSuccess, dns.TypeTXT, domain)
		d := &proxy.DNSContext{}

		err := srv.filterDNSRewrite(testutil.ContextWithTimeout(t, testTimeout), req, res, d)
		require.NoError(t, err)

		assert.Equal(t, dns.RcodeSuccess, d.Res.Rcode)

		require.Len(t, d.Res.Answer, 1)
		assert.Equal(t, []string{domain}, d.Res.Answer[0].(*dns.TXT).Txt)
	})

	t.Run("noerror_mx", func(t *testing.T) {
		req := makeQ(dns.TypeMX)
		res := makeRes(dns.RcodeSuccess, dns.TypeMX, mxVal)
		d := &proxy.DNSContext{}

		err := srv.filterDNSRewrite(testutil.ContextWithTimeout(t, testTimeout), req, res, d)
		require.NoError(t, err)

		assert.Equal(t, dns.RcodeSuccess, d.Res.Rcode)

		require.Len(t, d.Res.Answer, 1)
		ans, ok := d.Res.Answer[0].(*dns.MX)

		require.True(t, ok)
		assert.Equal(t, dns.Fqdn(mxVal.Exchange), ans.Mx)
		assert.Equal(t, mxVal.Preference, ans.Preference)
	})

	t.Run("noerror_svcb", func(t *testing.T) {
		req := makeQ(dns.TypeSVCB)
		res := makeRes(dns.RcodeSuccess, dns.TypeSVCB, svcbVal)
		d := &proxy.DNSContext{}

		err := srv.filterDNSRewrite(testutil.ContextWithTimeout(t, testTimeout), req, res, d)
		require.NoError(t, err)

		assert.Equal(t, dns.RcodeSuccess, d.Res.Rcode)

		require.Len(t, d.Res.Answer, 1)
		ans, ok := d.Res.Answer[0].(*dns.SVCB)

		require.True(t, ok)
		require.Len(t, ans.Value, 2)

		assert.ElementsMatch(
			t,
			[]dns.SVCBKey{dns.SVCB_ALPN, dns.SVCB_DOHPATH},
			[]dns.SVCBKey{ans.Value[0].Key(), ans.Value[1].Key()},
		)
		assert.ElementsMatch(
			t,
			[]string{svcbVal.Params["alpn"], svcbVal.Params["dohpath"]},
			[]string{ans.Value[0].String(), ans.Value[1].String()},
		)
		assert.Equal(t, svcbVal.Target, ans.Target)
		assert.Equal(t, svcbVal.Priority, ans.Priority)
	})

	t.Run("noerror_https", func(t *testing.T) {
		req := makeQ(dns.TypeHTTPS)
		res := makeRes(dns.RcodeSuccess, dns.TypeHTTPS, svcbVal)
		d := &proxy.DNSContext{}

		err := srv.filterDNSRewrite(testutil.ContextWithTimeout(t, testTimeout), req, res, d)
		require.NoError(t, err)

		assert.Equal(t, dns.RcodeSuccess, d.Res.Rcode)

		require.Len(t, d.Res.Answer, 1)
		ans, ok := d.Res.Answer[0].(*dns.HTTPS)

		require.True(t, ok)
		require.Len(t, ans.Value, 2)

		assert.ElementsMatch(
			t,
			[]dns.SVCBKey{dns.SVCB_ALPN, dns.SVCB_DOHPATH},
			[]dns.SVCBKey{ans.Value[0].Key(), ans.Value[1].Key()},
		)
		assert.ElementsMatch(
			t,
			[]string{svcbVal.Params["alpn"], svcbVal.Params["dohpath"]},
			[]string{ans.Value[0].String(), ans.Value[1].String()},
		)
		assert.Equal(t, svcbVal.Target, ans.Target)
		assert.Equal(t, svcbVal.Priority, ans.Priority)
	})

	t.Run("noerror_srv", func(t *testing.T) {
		req := makeQ(dns.TypeSRV)
		res := makeRes(dns.RcodeSuccess, dns.TypeSRV, srvVal)
		d := &proxy.DNSContext{}

		err := srv.filterDNSRewrite(testutil.ContextWithTimeout(t, testTimeout), req, res, d)
		require.NoError(t, err)

		assert.Equal(t, dns.RcodeSuccess, d.Res.Rcode)

		require.Len(t, d.Res.Answer, 1)
		ans, ok := d.Res.Answer[0].(*dns.SRV)

		require.True(t, ok)
		assert.Equal(t, srvVal.Priority, ans.Priority)
		assert.Equal(t, srvVal.Weight, ans.Weight)
		assert.Equal(t, srvVal.Port, ans.Port)
		assert.Equal(t, srvVal.Target, ans.Target)
	})
}

func TestServer_FilterClassicDNSRewrite(t *testing.T) {
	t.Parallel()

	srv := createTestServer(t, &filtering.Config{
		BlockingMode: filtering.BlockingModeDefault,
	}, ServerConfig{
		TLSConf: &TLSConfig{},
		Config: Config{
			UpstreamMode:     UpstreamModeLoadBalance,
			EDNSClientSubnet: &EDNSClientSubnet{Enabled: false},
			ClientsContainer: EmptyClientsContainer{},
		},
		ServePlainDNS: true,
	})

	req := &dns.Msg{
		Question: []dns.Question{{
			Name:  "example.org.",
			Qtype: dns.TypeTXT,
		}},
	}

	res := &filtering.Result{
		DNSRewriteResult: &filtering.DNSRewriteResult{
			RCode: dns.RcodeSuccess,
			Response: filtering.DNSRewriteResultResponse{
				dns.TypeCNAME: []rules.RRValue{"alias1.example", "alias2.example"},
				dns.TypeA: []rules.RRValue{
					netip.MustParseAddr("1.2.3.4"),
					netip.MustParseAddr("1.2.3.5"),
				},
				dns.TypeAAAA: []rules.RRValue{
					netip.MustParseAddr("2001:db8::1"),
				},
			},
		},
	}

	d := &proxy.DNSContext{}
	err := srv.filterClassicDNSRewrite(testutil.ContextWithTimeout(t, testTimeout), req, res, d)
	require.NoError(t, err)

	require.Len(t, d.Res.Answer, 5)

	cname1, ok := d.Res.Answer[0].(*dns.CNAME)
	require.True(t, ok)
	assert.Equal(t, "alias1.example.", cname1.Target)

	cname2, ok := d.Res.Answer[1].(*dns.CNAME)
	require.True(t, ok)
	assert.Equal(t, "alias2.example.", cname2.Target)

	a1, ok := d.Res.Answer[2].(*dns.A)
	require.True(t, ok)
	assert.Equal(t, net.IP{1, 2, 3, 4}, a1.A)

	a2, ok := d.Res.Answer[3].(*dns.A)
	require.True(t, ok)
	assert.Equal(t, net.IP{1, 2, 3, 5}, a2.A)

	aaaa, ok := d.Res.Answer[4].(*dns.AAAA)
	require.True(t, ok)
	assert.Equal(t, net.IP(netip.MustParseAddr("2001:db8::1").AsSlice()), aaaa.AAAA)
}

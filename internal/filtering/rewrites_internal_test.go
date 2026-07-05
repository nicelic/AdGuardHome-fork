package filtering

import (
	"net/netip"
	"testing"

	"github.com/AdguardTeam/urlfilter/rules"
	"github.com/miekg/dns"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseTextRewriteRules(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name    string
		raw     string
		wantErr string
	}{{
		name: "valid",
		raw:  "[example.org *.example.org,1.2.3.4]:[1.1.1.1, 1.1.1.2][2001:db8::1][alias.example alias2.example]\n# [disabled]:[1.1.1.1][][]\n",
	}, {
		name: "valid_with_outer_whitespace",
		raw:  " [example.org *.example.org,1.2.3.4] : [1.1.1.1, 1.1.1.2] [2001:db8::1] [alias.example alias2.example] \n",
	}, {
		name:    "missing_colon",
		raw:     "[example.org][1.1.1.1][][]",
		wantErr: `line 1: invalid rule "[example.org][1.1.1.1][][]": missing ':' separator`,
	}, {
		name:    "empty_left",
		raw:     "[]:[1.1.1.1][][]",
		wantErr: `line 1: invalid rule "[]:[1.1.1.1][][]": left group must contain at least one matcher`,
	}, {
		name:    "empty_right",
		raw:     "[example.org]:[][][]",
		wantErr: `line 1: invalid rule "[example.org]:[][][]": right groups must contain at least one value`,
	}, {
		name:    "invalid_ipv4",
		raw:     "[example.org]:[bad-ip][][]",
		wantErr: `line 1: invalid IPv4 value "bad-ip"`,
	}, {
		name:    "invalid_ipv6",
		raw:     "[example.org]:[][1.1.1.1][]",
		wantErr: `line 1: invalid IPv6 value "1.1.1.1"`,
	}, {
		name:    "invalid_cname",
		raw:     "[example.org]:[][][*bad.example]",
		wantErr: `line 1: invalid CNAME value "*bad.example"`,
	}, {
		name:    "line_number",
		raw:     "\n# comment\n[example.org]:[][1.1.1.1][]",
		wantErr: `line 3: invalid IPv6 value "1.1.1.1"`,
	}}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			compiled, err := parseTextRewriteRules(tc.raw)
			if tc.wantErr != "" {
				require.EqualError(t, err, tc.wantErr)
				require.Nil(t, compiled)

				return
			}

			require.NoError(t, err)
			require.Len(t, compiled, 1)
			assert.Equal(t, []string{"example.org", "*.example.org", "1.2.3.4"}, compiled[0].matchers)
			assert.Equal(
				t,
				[]netip.Addr{
					netip.MustParseAddr("1.1.1.1"),
					netip.MustParseAddr("1.1.1.2"),
				},
				compiled[0].ipv4,
			)
			assert.Equal(t, []netip.Addr{netip.MustParseAddr("2001:db8::1")}, compiled[0].ipv6)
			assert.Equal(t, []string{"alias.example", "alias2.example"}, compiled[0].cnames)
		})
	}
}

func TestPrepareRewritesPreservesRawText(t *testing.T) {
	t.Parallel()

	const rawRules = "[example.org]:[1.1.1.1][][]\r\n# [disabled.example]:[2.2.2.2][][]\r\n"

	f, _ := newForTest(t, &Config{
		RewritesEnabled: true,
		Rewrites:        rawRules,
	}, nil)
	t.Cleanup(f.Close)

	assert.Equal(t, rawRules, f.conf.Rewrites)
}

func TestProcessRewrites(t *testing.T) {
	t.Parallel()

	f, _ := newForTest(t, &Config{
		RewritesEnabled: true,
		Rewrites: "# disabled exact match should be ignored\n" +
			"# [disabled.example]:[203.0.113.1][][]\n" +
			"[*.example.org test.example.org,2001:db8::10]:[1.2.3.4, 1.2.3.5][2001:db8::1][alias.example alias2.example]\n" +
			"[test.example.org]:[5.6.7.8][][]\n",
	}, nil)
	t.Cleanup(f.Close)

	testCases := []struct {
		name       string
		host       string
		qtype      uint16
		wantReason Reason
		wantIPv4   []netip.Addr
		wantIPv6   []netip.Addr
		wantCNAMEs []string
	}{{
		name:       "exact_match_uses_first_matching_line",
		host:       "test.example.org",
		qtype:      dns.TypeA,
		wantReason: Rewritten,
		wantIPv4: []netip.Addr{
			netip.MustParseAddr("1.2.3.4"),
			netip.MustParseAddr("1.2.3.5"),
		},
		wantIPv6:   []netip.Addr{netip.MustParseAddr("2001:db8::1")},
		wantCNAMEs: []string{"alias.example", "alias2.example"},
	}, {
		name:       "wildcard_match",
		host:       "www.example.org",
		qtype:      dns.TypeAAAA,
		wantReason: Rewritten,
		wantIPv4: []netip.Addr{
			netip.MustParseAddr("1.2.3.4"),
			netip.MustParseAddr("1.2.3.5"),
		},
		wantIPv6:   []netip.Addr{netip.MustParseAddr("2001:db8::1")},
		wantCNAMEs: []string{"alias.example", "alias2.example"},
	}, {
		name:       "ip_like_matcher",
		host:       "2001:db8::10",
		qtype:      dns.TypeTXT,
		wantReason: Rewritten,
		wantIPv4: []netip.Addr{
			netip.MustParseAddr("1.2.3.4"),
			netip.MustParseAddr("1.2.3.5"),
		},
		wantIPv6:   []netip.Addr{netip.MustParseAddr("2001:db8::1")},
		wantCNAMEs: []string{"alias.example", "alias2.example"},
	}, {
		name:       "disabled_rule_is_ignored",
		host:       "disabled.example",
		qtype:      dns.TypeA,
		wantReason: NotFilteredNotFound,
	}, {
		name:       "not_found",
		host:       "missing.example",
		qtype:      dns.TypeA,
		wantReason: NotFilteredNotFound,
	}}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			res := f.processRewrites(tc.host, tc.qtype)
			require.Equal(t, tc.wantReason, res.Reason)

			if tc.wantReason == NotFilteredNotFound {
				require.Nil(t, res.DNSRewriteResult)

				return
			}

			require.NotNil(t, res.DNSRewriteResult)
			assert.Equal(t, tc.wantCNAMEs[0], res.CanonName)
			assert.Equal(t, append(append([]netip.Addr{}, tc.wantIPv4...), tc.wantIPv6...), res.IPList)

			assertStringRRValuesEqual(t, tc.wantCNAMEs, res.DNSRewriteResult.Response[dns.TypeCNAME])
			assertAddrRRValuesEqual(t, tc.wantIPv4, res.DNSRewriteResult.Response[dns.TypeA])
			assertAddrRRValuesEqual(t, tc.wantIPv6, res.DNSRewriteResult.Response[dns.TypeAAAA])
		})
	}
}

func assertStringRRValuesEqual(t *testing.T, want []string, actual []rules.RRValue) {
	t.Helper()

	got := make([]string, 0, len(actual))
	for _, value := range actual {
		typed, ok := value.(string)
		require.True(t, ok)
		got = append(got, typed)
	}

	assert.Equal(t, want, got)
}

func assertAddrRRValuesEqual(t *testing.T, want []netip.Addr, actual []rules.RRValue) {
	t.Helper()

	got := make([]netip.Addr, 0, len(actual))
	for _, value := range actual {
		typed, ok := value.(netip.Addr)
		require.True(t, ok)
		got = append(got, typed)
	}

	assert.Equal(t, want, got)
}

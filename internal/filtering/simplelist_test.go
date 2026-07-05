package filtering

import (
	"strings"
	"testing"

	"github.com/nicelic/AdGuardHome-fork/internal/filtering/rulelist"
	"github.com/AdguardTeam/golibs/testutil"
	"github.com/miekg/dns"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseSimpleListRules(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name    string
		raw     string
		wantErr string
	}{{
		name: "valid",
		raw:  "aa.cc\n*.aa.cc\n*.a.aa.cc\n# comment\n",
	}, {
		name: "valid_with_outer_whitespace",
		raw:  "  *.aa.cc  \r\n",
	}, {
		name:    "partial_wildcard",
		raw:     "a*.aa.cc",
		wantErr: `line 1: invalid rule "a*.aa.cc": wildcard must occupy a whole label`,
	}, {
		name:    "empty_label",
		raw:     "aa..cc",
		wantErr: `line 1: invalid rule "aa..cc": empty label`,
	}, {
		name:    "invalid_domain",
		raw:     strings.Repeat("a", 64) + ".cc",
		wantErr: `line 1: invalid rule "` + strings.Repeat("a", 64) + `.cc": invalid domain name`,
	}, {
		name:    "ipv4_address",
		raw:     "192.0.2.1",
		wantErr: `line 1: invalid rule "192.0.2.1": IP addresses are not supported`,
	}, {
		name:    "line_number",
		raw:     "\n# comment\nbad*.aa.cc",
		wantErr: `line 3: invalid rule "bad*.aa.cc": wildcard must occupy a whole label`,
	}}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			compiled, err := parseSimpleListRules(tc.raw)
			if tc.wantErr != "" {
				require.EqualError(t, err, tc.wantErr)
				require.Nil(t, compiled)

				return
			}

			require.NoError(t, err)
			require.NotEmpty(t, compiled)
		})
	}
}

func TestSimpleListRuleMatches(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name string
		rule string
		host string
		want bool
	}{{
		name: "exact",
		rule: "aa.cc",
		host: "aa.cc",
		want: true,
	}, {
		name: "single_wildcard_matches_root",
		rule: "*.aa.cc",
		host: "aa.cc",
		want: true,
	}, {
		name: "single_wildcard_matches_one_label",
		rule: "*.aa.cc",
		host: "a.aa.cc",
		want: true,
	}, {
		name: "single_wildcard_does_not_match_two_labels",
		rule: "*.aa.cc",
		host: "a.b.aa.cc",
		want: false,
	}, {
		name: "middle_wildcard_matches_root_position",
		rule: "*.a.aa.cc",
		host: "a.aa.cc",
		want: true,
	}, {
		name: "middle_wildcard_matches_one_label",
		rule: "*.a.aa.cc",
		host: "x.a.aa.cc",
		want: true,
	}, {
		name: "middle_wildcard_does_not_match_wrong_branch",
		rule: "*.a.aa.cc",
		host: "aa.aa.cc",
		want: false,
	}, {
		name: "middle_wildcard_does_not_match_shorter_host",
		rule: "*.a.aa.cc",
		host: "aa.cc",
		want: false,
	}, {
		name: "unicode_rule_matches_unicode_host",
		rule: "bücher.example",
		host: "bücher.example",
		want: true,
	}, {
		name: "unicode_rule_matches_punycode_host",
		rule: "bücher.example",
		host: "xn--bcher-kva.example",
		want: true,
	}, {
		name: "unicode_wildcard_matches_unicode_host",
		rule: "*.bücher.example",
		host: "子.bücher.example",
		want: true,
	}, {
		name: "does_not_match_ip_address",
		rule: "192.0.2.1.example",
		host: "192.0.2.1",
		want: false,
	}}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			rule, err := parseSimpleListRule(tc.rule)
			require.NoError(t, err)

			assert.Equal(t, tc.want, rule.matches(tc.host))
		})
	}
}

func TestSimpleListPriority(t *testing.T) {
	t.Parallel()

	d, setts := newForTest(t, &Config{
		SimpleAllowlist: "shared.example\n",
		SimpleBlocklist: "shared.example\nsimple-block-before-user.example\n",
	}, nil)
	t.Cleanup(d.Close)

	ctx := testutil.ContextWithTimeout(t, testTimeout)
	err := d.setFilters(
		ctx,
		Filter{
			ID: rulelist.IDCustom,
			Data: []byte(
				"@@||simple-block-before-user.example^\n" +
					"||user-before-allow.example^\n",
			),
		},
		[]Filter{{
			ID: 10,
			Data: []byte(
				"||allow-before-block.example^\n" +
					"||block-only.example^\n",
			),
		}},
		[]Filter{{
			ID: 20,
			Data: []byte(
				"@@||user-before-allow.example^\n" +
					"@@||allow-before-block.example^\n",
			),
		}},
		false,
	)
	require.NoError(t, err)

	testCases := []struct {
		name         string
		host         string
		wantReason   Reason
		wantFilterID rulelist.APIID
	}{{
		name:         "simple_allowlist_before_simple_blocklist",
		host:         "shared.example",
		wantReason:   NotFilteredAllowList,
		wantFilterID: rulelist.APIIDSimpleAllowlist,
	}, {
		name:         "simple_blocklist_before_custom_rules",
		host:         "simple-block-before-user.example",
		wantReason:   FilteredBlockList,
		wantFilterID: rulelist.APIIDSimpleBlocklist,
	}, {
		name:         "custom_rules_before_dns_allowlist",
		host:         "user-before-allow.example",
		wantReason:   FilteredBlockList,
		wantFilterID: rulelist.APIIDCustom,
	}, {
		name:         "dns_allowlist_before_dns_blocklist",
		host:         "allow-before-block.example",
		wantReason:   NotFilteredAllowList,
		wantFilterID: 20,
	}, {
		name:         "dns_blocklist_last",
		host:         "block-only.example",
		wantReason:   FilteredBlockList,
		wantFilterID: 10,
	}}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			res, checkErr := d.CheckHost(tc.host, dns.TypeA, setts)
			require.NoError(t, checkErr)
			require.Len(t, res.Rules, 1)

			assert.Equal(t, tc.wantReason, res.Reason)
			assert.Equal(t, tc.wantFilterID, res.Rules[0].FilterListID)
		})
	}
}

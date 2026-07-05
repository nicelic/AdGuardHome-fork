package filtering

import (
	"fmt"
	"net/netip"
	"strings"

	"github.com/nicelic/AdGuardHome-fork/internal/filtering/rulelist"
	"github.com/miekg/dns"
	"golang.org/x/net/idna"
)

// simpleListRule is a single compiled simple allowlist or blocklist rule.
type simpleListRule struct {
	labels []string
	text   string
}

// prepareSimpleLists parses and validates the configured simple domain lists.
func (d *DNSFilter) prepareSimpleLists() (err error) {
	d.conf.simpleAllowRules, err = parseSimpleListRules(d.conf.SimpleAllowlist)
	if err != nil {
		return fmt.Errorf("simple allowlist: %w", err)
	}

	d.conf.simpleBlockRules, err = parseSimpleListRules(d.conf.SimpleBlocklist)
	if err != nil {
		return fmt.Errorf("simple blocklist: %w", err)
	}

	return nil
}

// parseSimpleListRules parses the multiline simple domain-list text.
func parseSimpleListRules(raw string) (compiled []*simpleListRule, err error) {
	lines := strings.Split(normalizeRewriteText(raw), "\n")
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}

		var rule *simpleListRule
		rule, err = parseSimpleListRule(trimmed)
		if err != nil {
			return nil, fmt.Errorf("line %d: %w", i+1, err)
		}

		compiled = append(compiled, rule)
	}

	return compiled, nil
}

// parseSimpleListRule parses a single enabled simple domain-list rule.
func parseSimpleListRule(line string) (rule *simpleListRule, err error) {
	pat := strings.TrimSpace(strings.TrimSuffix(line, "."))
	if pat == "" {
		return nil, fmt.Errorf("invalid rule %q: empty value", line)
	}

	if _, parseErr := netip.ParseAddr(pat); parseErr == nil {
		return nil, fmt.Errorf("invalid rule %q: IP addresses are not supported", line)
	}

	labels := strings.Split(pat, ".")
	normalized := make([]string, len(labels))
	for i, label := range labels {
		switch {
		case label == "":
			return nil, fmt.Errorf("invalid rule %q: empty label", line)
		case label == "*":
			normalized[i] = label
		case strings.Contains(label, "*"):
			return nil, fmt.Errorf("invalid rule %q: wildcard must occupy a whole label", line)
		default:
			ascii, convErr := idna.ToASCII(label)
			if convErr != nil {
				return nil, fmt.Errorf("invalid rule %q: %w", line, convErr)
			}

			normalized[i] = strings.ToLower(ascii)
		}
	}

	validation := strings.ReplaceAll(strings.Join(normalized, "."), "*", "w")
	if _, ok := dns.IsDomainName(validation + "."); !ok {
		return nil, fmt.Errorf("invalid rule %q: invalid domain name", line)
	}

	return &simpleListRule{
		labels: normalized,
		text:   line,
	}, nil
}

// matches reports whether host matches the simple domain-list rule.
func (rw *simpleListRule) matches(host string) (ok bool) {
	host, ok = normalizeSimpleListHost(host)
	if !ok {
		return false
	}

	return matchSimpleListLabels(rw.labels, strings.Split(host, "."))
}

// normalizeSimpleListHost canonicalizes host into a lowercase ASCII form so
// that exact and wildcard matching behaves the same for IDN and punycode
// inputs.
func normalizeSimpleListHost(host string) (normalized string, ok bool) {
	host = strings.TrimSpace(strings.TrimSuffix(host, "."))
	if host == "" {
		return "", false
	}

	if _, err := netip.ParseAddr(host); err == nil {
		return "", false
	}

	ascii, err := idna.ToASCII(host)
	if err != nil {
		return "", false
	}

	ascii = strings.ToLower(ascii)
	if _, ok = dns.IsDomainName(ascii + "."); !ok {
		return "", false
	}

	return ascii, true
}

// matchSimpleListLabels reports whether hostLabels match patLabels.  Each '*'
// label in the pattern matches zero or one whole domain label.
func matchSimpleListLabels(patLabels, hostLabels []string) (ok bool) {
	type indexPair struct {
		pat  int
		host int
	}

	memo := make(map[indexPair]bool, len(patLabels))
	seen := make(map[indexPair]bool, len(patLabels))

	var match func(patIdx, hostIdx int) bool
	match = func(patIdx, hostIdx int) bool {
		key := indexPair{
			pat:  patIdx,
			host: hostIdx,
		}
		if seen[key] {
			return memo[key]
		}

		seen[key] = true

		switch {
		case patIdx == len(patLabels):
			memo[key] = hostIdx == len(hostLabels)
		case patLabels[patIdx] == "*":
			memo[key] = match(patIdx+1, hostIdx) ||
				(hostIdx < len(hostLabels) && match(patIdx+1, hostIdx+1))
		case hostIdx >= len(hostLabels):
			memo[key] = false
		default:
			memo[key] = patLabels[patIdx] == hostLabels[hostIdx] &&
				match(patIdx+1, hostIdx+1)
		}

		return memo[key]
	}

	return match(0, 0)
}

// matchSimpleAllowlist checks the host against the configured simple
// allowlist.
func (d *DNSFilter) matchSimpleAllowlist(host string) (res Result) {
	d.confMu.RLock()
	defer d.confMu.RUnlock()

	for _, rule := range d.conf.simpleAllowRules {
		if rule.matches(host) {
			return newSimpleListResult(rule, rulelist.APIIDSimpleAllowlist, NotFilteredAllowList)
		}
	}

	return Result{}
}

// matchSimpleBlocklist checks the host against the configured simple
// blocklist.
func (d *DNSFilter) matchSimpleBlocklist(host string) (res Result) {
	d.confMu.RLock()
	defer d.confMu.RUnlock()

	for _, rule := range d.conf.simpleBlockRules {
		if rule.matches(host) {
			return newSimpleListResult(rule, rulelist.APIIDSimpleBlocklist, FilteredBlockList)
		}
	}

	return Result{}
}

// newSimpleListResult converts a simple list rule into a filtering result.
func newSimpleListResult(
	rule *simpleListRule,
	filterListID rulelist.APIID,
	reason Reason,
) (res Result) {
	return Result{
		Rules: []*ResultRule{{
			FilterListID: filterListID,
			Text:         rule.text,
		}},
		Reason:     reason,
		IsFiltered: reason == FilteredBlockList,
	}
}

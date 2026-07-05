package filtering

import (
	"context"
	"fmt"
	"net/netip"
	"strings"

	"github.com/AdguardTeam/urlfilter/rules"
	"github.com/miekg/dns"
)

// textRewriteRule is a single compiled classic DNS rewrite rule.
type textRewriteRule struct {
	matchers []string
	ipv4     []netip.Addr
	ipv6     []netip.Addr
	cnames   []string
}

// prepareRewrites parses and validates the configured classic DNS rewrites.
func (d *DNSFilter) prepareRewrites(_ context.Context) (err error) {
	d.conf.rewrites, err = parseTextRewriteRules(d.conf.Rewrites)
	if err != nil {
		return err
	}

	return nil
}

// processRewrites performs filtering based on the classic text DNS rewrite
// records.
func (d *DNSFilter) processRewrites(host string, _ uint16) (res Result) {
	d.confMu.RLock()
	defer d.confMu.RUnlock()

	if !d.conf.RewritesEnabled || len(d.conf.rewrites) == 0 {
		return Result{}
	}

	host = strings.ToLower(host)
	for _, rewrite := range d.conf.rewrites {
		if !rewrite.matches(host) {
			continue
		}

		return rewrite.result()
	}

	return Result{}
}

// normalizeRewriteText normalizes line endings while keeping every line's
// original content intact.
func normalizeRewriteText(raw string) (normalized string) {
	normalized = strings.ReplaceAll(raw, "\r\n", "\n")
	normalized = strings.ReplaceAll(normalized, "\r", "\n")

	return normalized
}

// parseTextRewriteRules parses the multiline classic rewrite rules text.
func parseTextRewriteRules(raw string) (compiled []*textRewriteRule, err error) {
	lines := strings.Split(normalizeRewriteText(raw), "\n")
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}

		var rule *textRewriteRule
		rule, err = parseTextRewriteRule(trimmed)
		if err != nil {
			return nil, fmt.Errorf("line %d: %w", i+1, err)
		}

		compiled = append(compiled, rule)
	}

	return compiled, nil
}

// parseTextRewriteRule parses a single enabled classic text DNS rewrite rule.
func parseTextRewriteRule(line string) (rule *textRewriteRule, err error) {
	line = strings.TrimSpace(line)

	left, rest, ok := cutRewriteGroup(line)
	if !ok {
		return nil, fmt.Errorf("invalid rule %q: missing left group", line)
	}

	rest = trimLeadingRewriteWhitespace(rest)
	if !strings.HasPrefix(rest, ":") {
		return nil, fmt.Errorf("invalid rule %q: missing ':' separator", line)
	}

	rest = trimLeadingRewriteWhitespace(rest[1:])

	ipv4Group, rest, ok := cutRewriteGroup(rest)
	if !ok {
		return nil, fmt.Errorf("invalid rule %q: missing IPv4 group", line)
	}

	ipv6Group, rest, ok := cutRewriteGroup(rest)
	if !ok {
		return nil, fmt.Errorf("invalid rule %q: missing IPv6 group", line)
	}

	cnameGroup, rest, ok := cutRewriteGroup(rest)
	if !ok {
		return nil, fmt.Errorf("invalid rule %q: missing CNAME group", line)
	}

	if strings.TrimSpace(rest) != "" {
		return nil, fmt.Errorf("invalid rule %q: unexpected trailing content", line)
	}

	matchers := splitRewriteGroupValues(left)
	if len(matchers) == 0 {
		return nil, fmt.Errorf("invalid rule %q: left group must contain at least one matcher", line)
	}

	ipv4, err := parseRewriteIPGroup(ipv4Group, true)
	if err != nil {
		return nil, err
	}

	ipv6, err := parseRewriteIPGroup(ipv6Group, false)
	if err != nil {
		return nil, err
	}

	cnames, err := parseRewriteCNAMEGroup(cnameGroup)
	if err != nil {
		return nil, err
	}

	if len(ipv4) == 0 && len(ipv6) == 0 && len(cnames) == 0 {
		return nil, fmt.Errorf("invalid rule %q: right groups must contain at least one value", line)
	}

	for i, matcher := range matchers {
		matchers[i] = strings.ToLower(matcher)
	}

	return &textRewriteRule{
		matchers: matchers,
		ipv4:     ipv4,
		ipv6:     ipv6,
		cnames:   cnames,
	}, nil
}

// cutRewriteGroup extracts the leading bracketed group from s.
func cutRewriteGroup(s string) (group, rest string, ok bool) {
	s = trimLeadingRewriteWhitespace(s)
	if !strings.HasPrefix(s, "[") {
		return "", s, false
	}

	end := strings.IndexByte(s[1:], ']')
	if end < 0 {
		return "", s, false
	}

	end++

	return s[1:end], s[end+1:], true
}

// trimLeadingRewriteWhitespace trims ASCII whitespace used around rewrite
// groups and separators.
func trimLeadingRewriteWhitespace(s string) (trimmed string) {
	return strings.TrimLeft(s, " \t\n\r\f\v")
}

// splitRewriteGroupValues splits a bracket group's values by ASCII whitespace
// and commas.
func splitRewriteGroupValues(group string) (values []string) {
	return strings.FieldsFunc(group, func(r rune) bool {
		return r == ',' || r == ' ' || r == '\t' || r == '\n' || r == '\r' || r == '\f' || r == '\v'
	})
}

// parseRewriteIPGroup parses either the IPv4 or IPv6 group.
func parseRewriteIPGroup(group string, wantIPv4 bool) (addrs []netip.Addr, err error) {
	values := splitRewriteGroupValues(group)
	for _, value := range values {
		addr, parseErr := netip.ParseAddr(value)
		if parseErr != nil {
			groupName := "IPv6"
			if wantIPv4 {
				groupName = "IPv4"
			}

			return nil, fmt.Errorf("invalid %s value %q", groupName, value)
		}

		if wantIPv4 && !addr.Is4() {
			return nil, fmt.Errorf("invalid IPv4 value %q", value)
		} else if !wantIPv4 && !addr.Is6() {
			return nil, fmt.Errorf("invalid IPv6 value %q", value)
		}

		addrs = append(addrs, addr)
	}

	return addrs, nil
}

// parseRewriteCNAMEGroup parses the CNAME group.
func parseRewriteCNAMEGroup(group string) (cnames []string, err error) {
	values := splitRewriteGroupValues(group)
	for _, value := range values {
		value = strings.ToLower(value)
		if strings.Contains(value, "*") {
			return nil, fmt.Errorf("invalid CNAME value %q", value)
		}

		if _, ok := dns.IsDomainName(value); !ok {
			return nil, fmt.Errorf("invalid CNAME value %q", value)
		}

		cnames = append(cnames, value)
	}

	return cnames, nil
}

// matches reports whether host matches any matcher in the rule.
func (rw *textRewriteRule) matches(host string) (ok bool) {
	for _, matcher := range rw.matchers {
		if matcher == host || matchDomainWildcard(host, matcher) {
			return true
		}
	}

	return false
}

// result converts rw into a filtering result.
func (rw *textRewriteRule) result() (res Result) {
	dnsRewrite := &DNSRewriteResult{
		RCode:    dns.RcodeSuccess,
		Response: DNSRewriteResultResponse{},
	}

	for _, cname := range rw.cnames {
		dnsRewrite.Response[dns.TypeCNAME] = append(dnsRewrite.Response[dns.TypeCNAME], rules.RRValue(cname))
	}

	for _, addr := range rw.ipv4 {
		dnsRewrite.Response[dns.TypeA] = append(dnsRewrite.Response[dns.TypeA], rules.RRValue(addr))
	}

	for _, addr := range rw.ipv6 {
		dnsRewrite.Response[dns.TypeAAAA] = append(dnsRewrite.Response[dns.TypeAAAA], rules.RRValue(addr))
	}

	ipList := make([]netip.Addr, 0, len(rw.ipv4)+len(rw.ipv6))
	ipList = append(ipList, rw.ipv4...)
	ipList = append(ipList, rw.ipv6...)

	canonName := ""
	if len(rw.cnames) > 0 {
		canonName = rw.cnames[0]
	}

	return Result{
		DNSRewriteResult: dnsRewrite,
		CanonName:        canonName,
		IPList:           ipList,
		Reason:           Rewritten,
	}
}

// isWildcard returns true if pat is a wildcard domain pattern.
func isWildcard(pat string) (ok bool) {
	return len(pat) > 1 && pat[0] == '*' && pat[1] == '.'
}

// matchDomainWildcard returns true if host matches the wildcard pattern.
func matchDomainWildcard(host, wildcard string) (ok bool) {
	return isWildcard(wildcard) && strings.HasSuffix(host, wildcard[1:])
}

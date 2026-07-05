package configmigrate

import (
	"context"
	"fmt"
	"net/netip"
	"strings"
)

// migrateTo35 performs the following changes:
//
//	# BEFORE:
//	'filtering':
//	  'rewrites':
//	    - 'domain': test.example
//	      'answer': 192.0.2.0
//	      'enabled': true
//	  # …
//
//	# AFTER:
//	'filtering':
//	  'rewrites': |
//	    [test.example]:[192.0.2.0][][]
//	  # …
func (m Migrator) migrateTo35(_ context.Context, diskConf yobj) (err error) {
	diskConf["schema_version"] = 35

	fltConf, ok, err := fieldVal[yobj](diskConf, "filtering")
	if !ok {
		return err
	}

	raw, ok := fltConf["rewrites"]
	if !ok || raw == nil {
		fltConf["rewrites"] = ""

		return nil
	}

	switch rewrites := raw.(type) {
	case string:
		return nil
	case yarr:
		fltConf["rewrites"], err = rewriteItemsToText(rewrites)

		return err
	default:
		return fmt.Errorf("unexpected type of %q: %T", "rewrites", raw)
	}
}

type rewriteTextGroup struct {
	domain string
	ipv4   []string
	ipv6   []string
	cname  []string
}

func rewriteItemsToText(items yarr) (text string, err error) {
	var lines []string
	groups := map[string]*rewriteTextGroup{}
	var order []string

	for i, item := range items {
		rw, ok := item.(yobj)
		if !ok {
			return "", fmt.Errorf("rewrites at index %d: unexpected type: %T", i, item)
		}

		domain, answer, enabled, err := rewriteItemFields(rw, i)
		if err != nil {
			return "", err
		}

		groupName, unsupported := rewriteAnswerGroup(answer)
		if !enabled {
			lines = append(lines, "# "+formatRewriteTextLine(
				&rewriteTextGroup{domain: domain},
				groupName,
				answer,
			))

			continue
		}

		if unsupported {
			lines = append(
				lines,
				fmt.Sprintf(
					"# [%s]:[][][] legacy rewrite answer %q cannot be represented by text rewrites",
					domain,
					answer,
				),
			)

			continue
		}

		group := groups[domain]
		if group == nil {
			group = &rewriteTextGroup{domain: domain}
			groups[domain] = group
			order = append(order, domain)
		}

		addRewriteGroupValue(group, groupName, answer)
	}

	activeLines := make([]string, 0, len(order))
	for _, domain := range order {
		activeLines = append(activeLines, formatRewriteTextLine(groups[domain], "", ""))
	}

	lines = append(activeLines, lines...)
	if len(lines) == 0 {
		return "", nil
	}

	return strings.Join(lines, "\n") + "\n", nil
}

func rewriteItemFields(item yobj, idx int) (domain, answer string, enabled bool, err error) {
	domain, ok, err := fieldVal[string](item, "domain")
	if err != nil {
		return "", "", false, fmt.Errorf("rewrites at index %d: %w", idx, err)
	} else if !ok || domain == "" {
		return "", "", false, fmt.Errorf("rewrites at index %d: missing domain", idx)
	}

	answer, ok, err = fieldVal[string](item, "answer")
	if err != nil {
		return "", "", false, fmt.Errorf("rewrites at index %d: %w", idx, err)
	} else if !ok || answer == "" {
		return "", "", false, fmt.Errorf("rewrites at index %d: missing answer", idx)
	}

	enabled = true
	rawEnabled, ok := item["enabled"]
	if !ok || rawEnabled == nil {
		return domain, answer, enabled, nil
	}

	enabledValue, ok := rawEnabled.(bool)
	if !ok {
		return "", "", false, fmt.Errorf("rewrites at index %d: unexpected type of %q: %T", idx, "enabled", rawEnabled)
	}

	enabled = enabledValue

	return domain, answer, enabled, nil
}

func rewriteAnswerGroup(answer string) (group string, unsupported bool) {
	switch answer {
	case "A", "AAAA":
		return "", true
	default:
		// Go on.
	}

	addr, err := netip.ParseAddr(answer)
	if err != nil {
		return "cname", false
	}

	if addr.Is4() {
		return "ipv4", false
	}

	return "ipv6", false
}

func addRewriteGroupValue(group *rewriteTextGroup, groupName, value string) {
	switch groupName {
	case "ipv4":
		group.ipv4 = append(group.ipv4, value)
	case "ipv6":
		group.ipv6 = append(group.ipv6, value)
	case "cname":
		group.cname = append(group.cname, value)
	default:
		// Go on.
	}
}

func formatRewriteTextLine(group *rewriteTextGroup, singleGroup, singleValue string) (line string) {
	if singleGroup != "" {
		addRewriteGroupValue(group, singleGroup, singleValue)
	}

	return fmt.Sprintf(
		"[%s]:[%s][%s][%s]",
		group.domain,
		strings.Join(group.ipv4, " "),
		strings.Join(group.ipv6, " "),
		strings.Join(group.cname, " "),
	)
}

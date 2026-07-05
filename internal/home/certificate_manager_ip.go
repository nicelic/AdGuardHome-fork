package home

import (
	"context"
	"io"
	"net"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"
)

var (
	certManagerPublicIPLookupURLs = []string{
		"https://icanhazip.com",
		"https://api.ip.sb/ip",
		"https://api.ipify.org",
		"https://ifconfig.me/ip",
		"https://ipinfo.io/ip",
	}

	certManagerPublicIPv4LookupURLs = []string{
		"https://api4.ipify.org",
		"https://ipv4.icanhazip.com",
		"https://v4.ident.me",
		"https://ipv4.ip.sb",
	}

	certManagerPublicIPv6LookupURLs = []string{
		"https://api6.ipify.org",
		"https://ipv6.icanhazip.com",
		"https://v6.ident.me",
		"https://ipv6.ip.sb",
	}
)

type certificateManagerIPOption struct {
	Value  string `json:"value"`
	Label  string `json:"label"`
	Family string `json:"family"`
	Source string `json:"source"`
}

type certificateManagerIPOptionsResult struct {
	Items       []certificateManagerIPOption `json:"items"`
	RefreshedAt int64                        `json:"refreshedAt"`
}

func (s *certificateManagerService) GetIPOptions(
	ctx context.Context,
) (result *certificateManagerIPOptionsResult, err error) {
	return &certificateManagerIPOptionsResult{
		Items:       s.collectIPOptions(ctx),
		RefreshedAt: time.Now().Unix(),
	}, nil
}

func (s *certificateManagerService) collectIPOptions(
	ctx context.Context,
) (items []certificateManagerIPOption) {
	seen := map[string]struct{}{}

	appendValues := func(values []string, source string) {
		for _, raw := range values {
			value, family, ok := normalizeCertificateManagerIPValue(raw)
			if !ok {
				continue
			}
			if _, exists := seen[value]; exists {
				continue
			}

			seen[value] = struct{}{}
			items = append(items, certificateManagerIPOption{
				Value:  value,
				Label:  value,
				Family: family,
				Source: source,
			})
		}
	}

	appendValues(s.lookupOutboundIPs(ctx), "outbound")
	appendValues(collectCertificateManagerInterfaceIPs(true), "interface")

	if len(items) == 0 {
		appendValues(collectCertificateManagerInterfaceIPs(false), "interface_fallback")
	}

	if len(items) == 0 {
		if value, ok := s.lookupDefaultOutboundIP(ctx); ok {
			appendValues([]string{value}, "outbound_default")
		}
	}

	return items
}

func collectCertificateManagerInterfaceIPs(publicOnly bool) (values []string) {
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil
	}

	seen := map[string]struct{}{}
	ipv4 := []string{}
	ipv6 := []string{}

	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}

		addrs, addrErr := iface.Addrs()
		if addrErr != nil {
			continue
		}

		for _, addr := range addrs {
			ip := certificateManagerNetIPFromAddr(addr)
			value, family, ok := normalizeCertificateManagerNetIP(ip, publicOnly)
			if !ok {
				continue
			}
			if _, exists := seen[value]; exists {
				continue
			}

			seen[value] = struct{}{}
			if family == "ipv4" {
				ipv4 = append(ipv4, value)
			} else {
				ipv6 = append(ipv6, value)
			}
		}
	}

	sort.Strings(ipv4)
	sort.Strings(ipv6)

	return append(ipv4, ipv6...)
}

func certificateManagerNetIPFromAddr(addr net.Addr) (ip net.IP) {
	switch value := addr.(type) {
	case *net.IPNet:
		return value.IP
	case *net.IPAddr:
		return value.IP
	default:
		return nil
	}
}

func normalizeCertificateManagerNetIP(
	ip net.IP,
	publicOnly bool,
) (value string, family string, ok bool) {
	if ip == nil {
		return "", "", false
	}

	if ip4 := ip.To4(); ip4 != nil {
		ip = ip4
	}

	if ip.IsLoopback() ||
		ip.IsMulticast() ||
		ip.IsUnspecified() ||
		ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() {
		return "", "", false
	}

	if publicOnly && ip.IsPrivate() {
		return "", "", false
	}

	if ip.To4() != nil {
		return ip.String(), "ipv4", true
	}

	return strings.ToLower(ip.String()), "ipv6", true
}

func normalizeCertificateManagerIPValue(raw string) (value string, family string, ok bool) {
	trimmed := strings.TrimSpace(strings.Trim(strings.TrimSpace(raw), "[]"))
	if trimmed == "" {
		return "", "", false
	}

	ip := net.ParseIP(trimmed)
	return normalizeCertificateManagerNetIP(ip, false)
}

func (s *certificateManagerService) lookupOutboundIPs(ctx context.Context) (values []string) {
	client := s.newCertificateManagerLookupHTTPClient(5 * time.Second)

	var mu sync.Mutex
	var wg sync.WaitGroup

	ipv4 := []string{}
	ipv6 := []string{}

	lookupFamily := func(urls []string, family string, dst *[]string) {
		defer wg.Done()

		for _, rawURL := range urls {
			value, foundFamily, ok := queryCertificateManagerPublicIP(ctx, client, rawURL)
			if !ok || foundFamily != family {
				continue
			}

			mu.Lock()
			*dst = append(*dst, value)
			mu.Unlock()

			return
		}
	}

	wg.Add(2)
	go lookupFamily(certManagerPublicIPv4LookupURLs, "ipv4", &ipv4)
	go lookupFamily(certManagerPublicIPv6LookupURLs, "ipv6", &ipv6)
	wg.Wait()

	return append(ipv4, ipv6...)
}

func (s *certificateManagerService) lookupDefaultOutboundIP(
	ctx context.Context,
) (value string, ok bool) {
	client := s.newCertificateManagerLookupHTTPClient(4 * time.Second)

	for _, rawURL := range certManagerPublicIPLookupURLs {
		value, _, ok = queryCertificateManagerPublicIP(ctx, client, rawURL)
		if ok {
			return value, true
		}
	}

	return "", false
}

func (s *certificateManagerService) newCertificateManagerLookupHTTPClient(
	timeout time.Duration,
) (client *http.Client) {
	if s.httpCli == nil {
		return &http.Client{Timeout: timeout}
	}

	clone := *s.httpCli
	clone.Timeout = timeout

	return &clone
}

func queryCertificateManagerPublicIP(
	ctx context.Context,
	client *http.Client,
	rawURL string,
) (value string, family string, ok bool) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return "", "", false
	}

	resp, err := client.Do(req)
	if err != nil {
		return "", "", false
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	if resp.StatusCode != http.StatusOK {
		return "", "", false
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", false
	}

	return normalizeCertificateManagerIPValue(string(body))
}

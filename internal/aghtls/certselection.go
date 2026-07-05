package aghtls

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net/netip"
	"slices"
	"strings"

	"github.com/AdguardTeam/golibs/errors"
	"github.com/AdguardTeam/golibs/netutil"
)

// SelectionOptions are the runtime options for TLS certificate selection.
type SelectionOptions struct {
	// RequestedServerName is the SNI name sent by the client, if any.
	RequestedServerName string

	// ServiceName is the configured service hostname or wildcard pattern that
	// the request must match.
	ServiceName string

	// LocalIP is the accepted local IP address used for selecting IP
	// certificates when the client doesn't send SNI.
	LocalIP netip.Addr

	// Strict controls whether a non-matching SNI should be rejected when
	// ServiceName is empty.
	Strict bool

	// AllowClientIDSubdomain controls whether an additional leading label is
	// allowed before ServiceName, for example "clientid.example.org" for
	// "example.org".
	AllowClientIDSubdomain bool
}

// IsWildcardServerName returns true if name is a single-label wildcard DNS
// name.
func IsWildcardServerName(name string) (ok bool) {
	name = normalizeServerName(name)

	return strings.HasPrefix(name, "*.") && !strings.Contains(name[2:], "*")
}

// MatchServerName reports whether host matches pattern.  pattern may be either
// an exact hostname or a single-label wildcard, such as "*.example.org".
func MatchServerName(host, pattern string) (ok bool) {
	host = normalizeServerName(host)
	pattern = normalizeServerName(pattern)
	if host == "" || pattern == "" || strings.Contains(host, "*") {
		return false
	}

	if !IsWildcardServerName(pattern) {
		return strings.EqualFold(host, pattern)
	}

	suffix := pattern[2:]
	if !strings.HasSuffix(host, "."+suffix) {
		return false
	}

	return strings.Count(host, ".") == strings.Count(suffix, ".")+1
}

// CertificateLeaf returns the cached or parsed leaf certificate.
func CertificateLeaf(cert *tls.Certificate) (leaf *x509.Certificate, err error) {
	if cert.Leaf != nil {
		return cert.Leaf, nil
	}

	if len(cert.Certificate) == 0 {
		return nil, errors.Error("empty tls certificate chain")
	}

	leaf, err = x509.ParseCertificate(cert.Certificate[0])
	if err != nil {
		return nil, fmt.Errorf("parsing tls certificate leaf: %w", err)
	}

	cert.Leaf = leaf

	return leaf, nil
}

// CertificateNames collects all names covered by certs.
func CertificateNames(certs []tls.Certificate) (dnsNames []string, err error) {
	uniq := map[string]struct{}{}
	for i := range certs {
		var leaf *x509.Certificate
		leaf, err = CertificateLeaf(&certs[i])
		if err != nil {
			return nil, fmt.Errorf("certificate %d: %w", i+1, err)
		}

		for _, name := range leaf.DNSNames {
			uniq[name] = struct{}{}
		}

		if len(leaf.DNSNames) == 0 && leaf.Subject.CommonName != "" {
			uniq[leaf.Subject.CommonName] = struct{}{}
		}
	}

	for name := range uniq {
		dnsNames = append(dnsNames, name)
	}

	slices.Sort(dnsNames)

	return dnsNames, nil
}

// FindTLSCertificate returns the best matching certificate for serverName.
// If serverName is empty or no matching certificate exists, nil is returned.
func FindTLSCertificate(certs []tls.Certificate, serverName string) (cert *tls.Certificate) {
	serverName = normalizeServerName(serverName)
	if len(certs) == 0 || serverName == "" {
		return nil
	}

	for i := range certs {
		if certificateHasExactServerName(&certs[i], serverName) {
			return &certs[i]
		}
	}

	for i := range certs {
		leaf, err := CertificateLeaf(&certs[i])
		if err != nil {
			continue
		}

		if leaf.VerifyHostname(serverName) == nil {
			return &certs[i]
		}
	}

	return nil
}

// certificateHasExactServerName reports whether cert covers serverName without
// relying on wildcard matching.  This keeps the selection order stable when
// both an exact certificate and a wildcard certificate can satisfy the same
// SNI.
func certificateHasExactServerName(cert *tls.Certificate, serverName string) (ok bool) {
	leaf, err := CertificateLeaf(cert)
	if err != nil {
		return false
	}

	if ip, err := netip.ParseAddr(serverName); err == nil {
		ip = ip.Unmap()

		for _, certIP := range leaf.IPAddresses {
			certIPAddr, ok := netip.AddrFromSlice(certIP)
			if ok && certIPAddr.Unmap() == ip {
				return true
			}
		}

		return false
	}

	for _, dnsName := range leaf.DNSNames {
		if IsWildcardServerName(dnsName) {
			continue
		}

		if normalizeServerName(dnsName) == serverName {
			return true
		}
	}

	return false
}

// FindTLSCertificateByIP returns the best matching IP certificate for localIP.
func FindTLSCertificateByIP(certs []tls.Certificate, localIP netip.Addr) (cert *tls.Certificate) {
	if len(certs) == 0 || !localIP.IsValid() || localIP.IsUnspecified() {
		return nil
	}

	ipText := localIP.Unmap().String()
	for i := range certs {
		leaf, err := CertificateLeaf(&certs[i])
		if err != nil {
			continue
		}

		if leaf.VerifyHostname(ipText) == nil {
			return &certs[i]
		}
	}

	return nil
}

// SelectCertificate chooses a certificate according to opts and returns it.
func SelectCertificate(
	certs []tls.Certificate,
	opts SelectionOptions,
) (cert *tls.Certificate, err error) {
	if len(certs) == 0 {
		return nil, fmt.Errorf("no tls certificate configured")
	}

	serverName := normalizeServerName(opts.RequestedServerName)
	serviceName := normalizeServerName(opts.ServiceName)
	if serverName != "" {
		certServerName := serverName
		if serviceName != "" {
			switch {
			case MatchServerName(serverName, serviceName):
			case opts.AllowClientIDSubdomain:
				_, rest, ok := strings.Cut(serverName, ".")
				if !ok || !MatchServerName(rest, serviceName) {
					return nil, fmt.Errorf(
						"request sni %q doesn't match configured service name %q",
						serverName,
						serviceName,
					)
				}

				certServerName = rest
			default:
				return nil, fmt.Errorf(
					"request sni %q doesn't match configured service name %q",
					serverName,
					serviceName,
				)
			}
		}

		cert = FindTLSCertificate(certs, serverName)
		if cert != nil {
			return cert, nil
		}

		if certServerName != serverName {
			cert = FindTLSCertificate(certs, certServerName)
			if cert != nil {
				return cert, nil
			}
		}

		if serviceName != "" || opts.Strict {
			return nil, fmt.Errorf("no tls certificate matches %q", serverName)
		}

		return &certs[0], nil
	}

	cert = FindTLSCertificateByIP(certs, opts.LocalIP)
	if cert != nil {
		return cert, nil
	}

	return &certs[0], nil
}

// normalizeServerName returns a canonical server name for matching.
func normalizeServerName(name string) (normalized string) {
	normalized = strings.TrimSpace(strings.ToLower(name))
	normalized = strings.TrimSuffix(normalized, ".")

	return normalized
}

// MatchCertificateName reports whether host matches one of the certificate
// names.
func MatchCertificateName(dnsNames []string, host string) (ok bool) {
	host = normalizeServerName(host)
	if !netutil.IsValidHostname(host) && !netutil.IsValidIPString(host) {
		return false
	}

	if _, ok = slices.BinarySearch(dnsNames, host); ok {
		return true
	}

	for _, dn := range dnsNames {
		if MatchServerName(host, dn) {
			return true
		}
	}

	return false
}

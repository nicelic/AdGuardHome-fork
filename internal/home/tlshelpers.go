package home

import (
	"fmt"
	"path"
	"strings"

	"github.com/nicelic/AdGuardHome-fork/internal/aghtls"
	"github.com/AdguardTeam/golibs/netutil"
)

const (
	defaultPanelServerURLPath  = "/"
	defaultDNSOverHTTPSURLPath = "/dns-query"
)

// effectivePanelServerName returns the panel hostname used at runtime.
func effectivePanelServerName(conf *tlsConfigSettings) (name string) {
	if conf == nil {
		return ""
	}

	if conf.PanelServerName != "" {
		return conf.PanelServerName
	}

	return conf.ServerName
}

// effectivePanelServerPort returns the HTTPS port used by the panel.
func effectivePanelServerPort(conf *tlsConfigSettings) (port uint16) {
	if conf == nil {
		return 0
	}

	if conf.PanelServerPort != 0 {
		return conf.PanelServerPort
	}

	return conf.PortHTTPS
}

// effectivePanelServerURLPath returns the normalized panel URL prefix.
func effectivePanelServerURLPath(conf *tlsConfigSettings) (panelPath string) {
	if conf == nil {
		return defaultPanelServerURLPath
	}

	panelPath = conf.PanelServerURLPath
	if panelPath == "" {
		panelPath = defaultPanelServerURLPath
	}

	return panelPath
}

// effectiveDNSOverHTTPSURLPath returns the normalized DoH URL path.
func effectiveDNSOverHTTPSURLPath(conf *tlsConfigSettings) (dohPath string) {
	if conf == nil {
		return defaultDNSOverHTTPSURLPath
	}

	dohPath = conf.DNSOverHTTPSURLPath
	if dohPath == "" {
		dohPath = defaultDNSOverHTTPSURLPath
	}

	return dohPath
}

// advertisedDNSServerName returns the exact DNS server name that can be turned
// into URLs.  Wildcards are not advertised.
func advertisedDNSServerName(conf *tlsConfigSettings) (name string) {
	if conf == nil {
		return ""
	}

	name = conf.ServerName
	if aghtls.IsWildcardServerName(name) {
		return ""
	}

	return name
}

// advertisedPanelServerName returns the exact panel server name that can be
// turned into URLs.  Wildcards are not advertised.
func advertisedPanelServerName(conf *tlsConfigSettings) (name string) {
	if conf == nil {
		return ""
	}

	name = effectivePanelServerName(conf)
	if aghtls.IsWildcardServerName(name) {
		return ""
	}

	return name
}

// shouldServeDoHOnDNSProxy reports whether DoH should use a dedicated dnsproxy
// HTTPS listener.
func shouldServeDoHOnDNSProxy(conf *tlsConfigSettings) (ok bool) {
	if conf == nil {
		return false
	}

	return conf.Enabled && conf.PortHTTPS != 0 && conf.PanelServerPort != 0
}

// shouldServeDoHOnPanelWeb reports whether DoH should be handled by the panel
// web server for legacy shared-port mode.
func shouldServeDoHOnPanelWeb(conf *tlsConfigSettings) (ok bool) {
	if conf == nil {
		return false
	}

	return conf.Enabled && conf.PortHTTPS != 0 && conf.PanelServerPort == 0
}

// hasEncryptedDNSProtocol reports whether at least one encrypted DNS protocol
// will listen for incoming DNS requests.
func hasEncryptedDNSProtocol(conf *tlsConfigSettings) (ok bool) {
	if conf == nil {
		return false
	}

	return conf.PortHTTPS != 0 ||
		conf.PortDNSOverTLS != 0 ||
		conf.PortDNSOverQUIC != 0 ||
		conf.PortDNSCrypt != 0
}

// normalizeTLSSettings validates and normalizes TLS-related runtime settings.
func normalizeTLSSettings(conf *tlsConfigSettings) (err error) {
	conf.ServerName = strings.TrimSpace(conf.ServerName)
	conf.PanelServerName = strings.TrimSpace(conf.PanelServerName)

	err = validateTLSServiceName(conf.ServerName, "server_name")
	if err != nil {
		return err
	}

	err = validateTLSServiceName(conf.PanelServerName, "panel_server_name")
	if err != nil {
		return err
	}

	conf.PanelServerURLPath, err = normalizeTLSURLPath(conf.PanelServerURLPath, defaultPanelServerURLPath)
	if err != nil {
		return fmt.Errorf("panel_server_url_path: %w", err)
	}

	conf.DNSOverHTTPSURLPath, err = normalizeTLSURLPath(conf.DNSOverHTTPSURLPath, defaultDNSOverHTTPSURLPath)
	if err != nil {
		return fmt.Errorf("dns_over_quic_url_path: %w", err)
	}

	return nil
}

// dnsOverHTTPSRoutes returns the current DoH route patterns.
func dnsOverHTTPSRoutes(conf *tlsConfigSettings) (routes []string) {
	dohPath := effectiveDNSOverHTTPSURLPath(conf)

	return []string{
		"GET " + dohPath,
		"POST " + dohPath,
		"GET " + dohPath + "/{ClientID}",
		"POST " + dohPath + "/{ClientID}",
	}
}

// matchesCurrentDoHPath reports whether reqPath points to the currently active
// DoH endpoint.
func matchesCurrentDoHPath(reqPath string, conf *tlsConfigSettings) (ok bool) {
	dohPath := effectiveDNSOverHTTPSURLPath(conf)
	if reqPath == dohPath {
		return true
	}

	return strings.HasPrefix(reqPath, dohPath+"/")
}

// certificateValidationNames returns the set of representative hostnames used
// for certificate validation.
func certificateValidationNames(conf *tlsConfigSettings) (names []string) {
	if conf == nil {
		return nil
	}

	uniq := map[string]struct{}{}
	for _, name := range []string{conf.ServerName, effectivePanelServerName(conf)} {
		name = validationServerName(name)
		if name == "" {
			continue
		}

		if _, ok := uniq[name]; ok {
			continue
		}

		uniq[name] = struct{}{}
		names = append(names, name)
	}

	return names
}

// dnsCertificateValidationNames returns representative DNS encryption
// hostnames used for certificate validation.
func dnsCertificateValidationNames(conf *tlsConfigSettings) (names []string) {
	if conf == nil {
		return nil
	}

	name := validationServerName(conf.ServerName)
	if name == "" {
		return nil
	}

	return []string{name}
}

// panelCertificateValidationNames returns representative panel HTTPS hostnames
// used for certificate validation.
func panelCertificateValidationNames(conf *tlsConfigSettings) (names []string) {
	if conf == nil {
		return nil
	}

	name := validationServerName(effectivePanelServerName(conf))
	if name == "" {
		return nil
	}

	return []string{name}
}

// validationServerName returns a concrete hostname suitable for x509 hostname
// validation.  Wildcards are mapped to a single representative subdomain.
func validationServerName(name string) (validated string) {
	switch {
	case name == "":
		return ""
	case aghtls.IsWildcardServerName(name):
		return "agh." + strings.TrimPrefix(name, "*.")
	default:
		return name
	}
}

// normalizeTLSURLPath validates and normalizes a configurable URL path.
func normalizeTLSURLPath(raw string, defaultValue string) (normalized string, err error) {
	normalized = strings.TrimSpace(raw)
	if normalized == "" {
		return defaultValue, nil
	}

	if strings.ContainsAny(normalized, "?#") {
		return "", fmt.Errorf("query and fragment are not allowed")
	}

	if !strings.HasPrefix(normalized, "/") {
		normalized = "/" + normalized
	}

	normalized = path.Clean(normalized)
	if normalized == "." {
		return defaultValue, nil
	}

	if normalized != "/" {
		normalized = strings.TrimRight(normalized, "/")
	}

	if normalized == "" || !strings.HasPrefix(normalized, "/") {
		return "", fmt.Errorf("must be an absolute path")
	}

	return normalized, nil
}

// validateTLSServiceName validates a configured exact or wildcard hostname.
func validateTLSServiceName(name string, field string) (err error) {
	if name == "" {
		return nil
	}

	if aghtls.IsWildcardServerName(name) {
		name = strings.TrimPrefix(name, "*.")
	} else if strings.Contains(name, "*") {
		return fmt.Errorf("%s: invalid wildcard position", field)
	}

	if !netutil.IsValidHostname(name) {
		return fmt.Errorf("%s: invalid hostname %q", field, name)
	}

	return nil
}

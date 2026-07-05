package home

import (
	"crypto/tls"
	"fmt"
	"net/netip"

	"github.com/nicelic/AdGuardHome-fork/internal/aghtls"
)

// selectWebCertificate chooses the certificate for the panel HTTPS listener.
// In shared mode it accepts both the panel server name and the DNS server name,
// while the ClientID-prefixed SNI relaxation is only applied to the DNS name.
func selectWebCertificate(
	certs []tls.Certificate,
	tlsConf *tlsConfigSettings,
	serverName string,
	localIP netip.Addr,
) (cert *tls.Certificate, err error) {
	if len(certs) == 0 {
		return nil, fmt.Errorf("no tls certificate configured")
	}

	strict := tlsConf != nil && tlsConf.StrictSNICheck
	if serverName == "" {
		return aghtls.SelectCertificate(certs, aghtls.SelectionOptions{
			RequestedServerName: serverName,
			LocalIP:             localIP,
			Strict:              strict,
		})
	}

	panelServerName := effectivePanelServerName(tlsConf)
	dnsServerName := ""
	if tlsConf != nil {
		dnsServerName = tlsConf.ServerName
	}

	attempts := []aghtls.SelectionOptions{}
	if panelServerName != "" {
		attempts = append(attempts, aghtls.SelectionOptions{
			RequestedServerName: serverName,
			ServiceName:         panelServerName,
			LocalIP:             localIP,
			Strict:              strict,
		})
	}

	if shouldServeDoHOnPanelWeb(tlsConf) && dnsServerName != "" {
		attempts = append(attempts, aghtls.SelectionOptions{
			RequestedServerName:    serverName,
			ServiceName:            dnsServerName,
			LocalIP:                localIP,
			Strict:                 strict,
			AllowClientIDSubdomain: true,
		})
	}

	var lastErr error
	for _, opts := range attempts {
		cert, err = aghtls.SelectCertificate(certs, opts)
		if err == nil {
			return cert, nil
		}

		lastErr = err
	}

	if len(attempts) == 0 {
		return aghtls.SelectCertificate(certs, aghtls.SelectionOptions{
			RequestedServerName: serverName,
			LocalIP:             localIP,
			Strict:              strict,
		})
	}

	return nil, lastErr
}

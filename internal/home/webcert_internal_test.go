package home

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"net/netip"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSelectWebCertificate_SharedMode(t *testing.T) {
	panelCert := createNamedTLSCertificate(t, "panel.example.org")
	dnsCert := createNamedTLSCertificate(t, "dns.example.org")
	certs := []tls.Certificate{panelCert, dnsCert}

	conf := &tlsConfigSettings{
		Enabled:         true,
		PanelServerName: "panel.example.org",
		ServerName:      "dns.example.org",
		PortHTTPS:       defaultPortHTTPS,
	}

	t.Run("panel_name", func(t *testing.T) {
		cert, err := selectWebCertificate(certs, conf, "panel.example.org", testLocalIP)
		require.NoError(t, err)
		assertCertDNSNames(t, cert, "panel.example.org")
	})

	t.Run("dns_name", func(t *testing.T) {
		cert, err := selectWebCertificate(certs, conf, "dns.example.org", testLocalIP)
		require.NoError(t, err)
		assertCertDNSNames(t, cert, "dns.example.org")
	})

	t.Run("dns_client_id_subdomain", func(t *testing.T) {
		cert, err := selectWebCertificate(certs, conf, "cli.dns.example.org", testLocalIP)
		require.NoError(t, err)
		assertCertDNSNames(t, cert, "dns.example.org")
	})

	t.Run("panel_extra_label_rejected", func(t *testing.T) {
		cert, err := selectWebCertificate(certs, conf, "cli.panel.example.org", testLocalIP)
		assert.Nil(t, cert)
		assert.Error(t, err)
	})
}

var testLocalIP = netip.MustParseAddr("127.0.0.1")

func assertCertDNSNames(tb testing.TB, cert *tls.Certificate, want string) {
	tb.Helper()

	leaf, err := x509.ParseCertificate(cert.Certificate[0])
	require.NoError(tb, err)
	assert.Equal(tb, []string{want}, leaf.DNSNames)
}

func createNamedTLSCertificate(tb testing.TB, dnsName string) (cert tls.Certificate) {
	tb.Helper()

	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(tb, err)

	template := &x509.Certificate{
		SerialNumber: big.NewInt(time.Now().UnixNano()),
		Subject: pkix.Name{
			Organization: []string{"AdGuard Tests"},
		},
		DNSNames:  []string{dnsName},
		NotBefore: time.Now().Add(-time.Hour),
		NotAfter:  time.Now().Add(time.Hour),
		KeyUsage:  x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage: []x509.ExtKeyUsage{
			x509.ExtKeyUsageServerAuth,
		},
	}

	derBytes, err := x509.CreateCertificate(rand.Reader, template, template, &privateKey.PublicKey, privateKey)
	require.NoError(tb, err)

	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: derBytes})
	keyPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(privateKey),
	})

	cert, err = tls.X509KeyPair(certPEM, keyPEM)
	require.NoError(tb, err)

	cert.Leaf, err = x509.ParseCertificate(cert.Certificate[0])
	require.NoError(tb, err)

	return cert
}

package aghtls

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSelectCertificate_AllowClientIDSubdomain(t *testing.T) {
	cert := createNamedTLSCertificate(t, "example.org")

	t.Run("disabled", func(t *testing.T) {
		got, err := SelectCertificate([]tls.Certificate{cert}, SelectionOptions{
			RequestedServerName: "cli.example.org",
			ServiceName:         "example.org",
		})
		assert.Nil(t, got)
		assert.Error(t, err)
	})

	t.Run("enabled", func(t *testing.T) {
		got, err := SelectCertificate([]tls.Certificate{cert}, SelectionOptions{
			RequestedServerName:    "cli.example.org",
			ServiceName:            "example.org",
			AllowClientIDSubdomain: true,
		})
		require.NoError(t, err)
		require.NotNil(t, got)

		leaf, err := CertificateLeaf(got)
		require.NoError(t, err)
		assert.Equal(t, []string{"example.org"}, leaf.DNSNames)
	})
}

func TestSelectCertificate_PrefersExactBeforeWildcard(t *testing.T) {
	wildcardCert := createNamedTLSCertificate(t, "*.example.org")
	exactCert := createNamedTLSCertificate(t, "panel.example.org")

	got, err := SelectCertificate(
		[]tls.Certificate{wildcardCert, exactCert},
		SelectionOptions{
			RequestedServerName: "panel.example.org",
			ServiceName:         "panel.example.org",
		},
	)
	require.NoError(t, err)
	require.NotNil(t, got)

	leaf, err := CertificateLeaf(got)
	require.NoError(t, err)
	assert.Equal(t, []string{"panel.example.org"}, leaf.DNSNames)
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

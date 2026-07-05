package dnsforward

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"slices"
	"testing"
	"time"

	"github.com/nicelic/AdGuardHome-fork/internal/aghtls"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAnyNameMatches(t *testing.T) {
	dnsNames := []string{"host1", "*.host2", "1.2.3.4"}
	slices.Sort(dnsNames)

	testCases := []struct {
		name    string
		dnsName string
		want    bool
	}{{
		name:    "match",
		dnsName: "host1",
		want:    true,
	}, {
		name:    "match",
		dnsName: "a.host2",
		want:    true,
	}, {
		name:    "mismatch_nested_wildcard",
		dnsName: "b.a.host2",
		want:    false,
	}, {
		name:    "match",
		dnsName: "1.2.3.4",
		want:    true,
	}, {
		name:    "mismatch_bad_ip",
		dnsName: "1.2.3.256",
		want:    false,
	}, {
		name:    "mismatch",
		dnsName: "host2",
		want:    false,
	}, {
		name:    "mismatch",
		dnsName: "",
		want:    false,
	}, {
		name:    "mismatch",
		dnsName: "*.host2",
		want:    false,
	}}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, anyNameMatches(dnsNames, tc.dnsName))
		})
	}
}

func TestServer_onGetCertificate_MultiCerts(t *testing.T) {
	certOne := createNamedTLSCertificate(t, "one.example.org")
	certTwo := createNamedTLSCertificate(t, "two.example.org")

	s := &Server{
		logger: testLogger,
		conf: ServerConfig{
			TLSConf: &TLSConfig{
				Certificates:     []tls.Certificate{certOne, certTwo},
				StrictSNICheck:   true,
				ServerName:       "",
				HTTPSListenAddrs: nil,
			},
		},
	}

	t.Run("match_second", func(t *testing.T) {
		cert, err := s.onGetCertificate(&tls.ClientHelloInfo{ServerName: "two.example.org"})
		require.NoError(t, err)

		leaf, err := aghtls.CertificateLeaf(cert)
		require.NoError(t, err)
		assert.Equal(t, []string{"two.example.org"}, leaf.DNSNames)
	})

	t.Run("reject_unknown", func(t *testing.T) {
		cert, err := s.onGetCertificate(&tls.ClientHelloInfo{ServerName: "unknown.example.org"})
		assert.Nil(t, cert)
		assert.Error(t, err)
	})
}

func TestServer_onGetCertificate_ClientIDSubdomain(t *testing.T) {
	cert := createNamedTLSCertificate(t, "dns.example.org")

	s := &Server{
		logger: testLogger,
		conf: ServerConfig{
			TLSConf: &TLSConfig{
				Certificates:   []tls.Certificate{cert},
				StrictSNICheck: true,
				ServerName:     "dns.example.org",
			},
		},
	}

	got, err := s.onGetCertificate(&tls.ClientHelloInfo{ServerName: "cli.dns.example.org"})
	require.NoError(t, err)
	require.NotNil(t, got)

	leaf, err := aghtls.CertificateLeaf(got)
	require.NoError(t, err)
	assert.Equal(t, []string{"dns.example.org"}, leaf.DNSNames)
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

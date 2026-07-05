package home

import (
	"bytes"
	"context"
	"crypto/tls"
	"fmt"
	"log/slog"
	"net/netip"
	"os"
	"path/filepath"
	"slices"
	"sync"
	"time"

	"github.com/nicelic/AdGuardHome-fork/internal/agh"
	"github.com/nicelic/AdGuardHome-fork/internal/aghalg"
	"github.com/nicelic/AdGuardHome-fork/internal/aghos"
	"github.com/nicelic/AdGuardHome-fork/internal/aghtls"
	"github.com/nicelic/AdGuardHome-fork/internal/configmigrate"
	"github.com/nicelic/AdGuardHome-fork/internal/dhcpd"
	"github.com/nicelic/AdGuardHome-fork/internal/dnsforward"
	"github.com/nicelic/AdGuardHome-fork/internal/filtering"
	"github.com/nicelic/AdGuardHome-fork/internal/querylog"
	"github.com/nicelic/AdGuardHome-fork/internal/schedule"
	"github.com/nicelic/AdGuardHome-fork/internal/stats"
	"github.com/AdguardTeam/dnsproxy/fastip"
	"github.com/AdguardTeam/golibs/errors"
	"github.com/AdguardTeam/golibs/logutil/slogutil"
	"github.com/AdguardTeam/golibs/netutil"
	"github.com/AdguardTeam/golibs/timeutil"
	"github.com/google/go-cmp/cmp"
	"github.com/google/renameio/v2/maybe"
	yaml "go.yaml.in/yaml/v4"
)

const (
	// dataDir is the name of a directory under the working one to store some
	// persistent data.
	dataDir = "data"

	// userFilterDataDir is the name of the directory used to store users'
	// FS-based rule lists.
	userFilterDataDir = "userfilters"
)

// logSettings are the logging settings part of the configuration file.
type logSettings struct {
	// Enabled indicates whether logging is enabled.
	Enabled bool `yaml:"enabled"`

	// File is the path to the log file.  If empty, logs are written to stdout.
	// If "syslog", logs are written to syslog.
	File string `yaml:"file"`

	// MaxBackups is the maximum number of old log files to retain.
	//
	// NOTE: MaxAge may still cause them to get deleted.
	MaxBackups int `yaml:"max_backups"`

	// MaxSize is the maximum size of the log file before it gets rotated, in
	// megabytes.  The default value is 100 MB.
	MaxSize int `yaml:"max_size"`

	// MaxAge is the maximum duration for retaining old log files, in days.
	MaxAge int `yaml:"max_age"`

	// Compress determines, if the rotated log files should be compressed using
	// gzip.
	Compress bool `yaml:"compress"`

	// LocalTime determines, if the time used for formatting the timestamps in
	// is the computer's local time.
	LocalTime bool `yaml:"local_time"`

	// Verbose determines, if verbose (aka debug) logging is enabled.
	Verbose bool `yaml:"verbose"`
}

// osConfig contains OS-related configuration.
type osConfig struct {
	// Group is the name of the group which AdGuard Home must switch to on
	// startup.  Empty string means no switching.
	Group string `yaml:"group"`
	// User is the name of the user which AdGuard Home must switch to on
	// startup.  Empty string means no switching.
	User string `yaml:"user"`
	// RlimitNoFile is the maximum number of opened fd's per process.  Zero
	// means use the default value.
	RlimitNoFile uint64 `yaml:"rlimit_nofile"`
}

type clientsConfig struct {
	// Sources defines the set of sources to fetch the runtime clients from.
	Sources *clientSourcesConfig `yaml:"runtime_sources"`
	// Persistent are the configured clients.
	Persistent []*clientObject `yaml:"persistent"`
}

// clientSourceConfig is used to configure where the runtime clients will be
// obtained from.
type clientSourcesConfig struct {
	WHOIS     bool `yaml:"whois"`
	ARP       bool `yaml:"arp"`
	RDNS      bool `yaml:"rdns"`
	DHCP      bool `yaml:"dhcp"`
	HostsFile bool `yaml:"hosts"`
}

// configuration is loaded from YAML.
//
// Field ordering is important, YAML fields better not to be reordered, if it's
// not absolutely necessary.
type configuration struct {
	// Raw file data to avoid re-reading of configuration file
	// It's reset after config is parsed
	fileData []byte

	// HTTPConfig is the block with http conf.
	HTTPConfig httpConfig `yaml:"http"`
	// Users are the clients capable for accessing the web interface.
	Users []webUser `yaml:"users"`
	// AuthAttempts is the maximum number of failed login attempts a user
	// can do before being blocked.
	AuthAttempts uint `yaml:"auth_attempts"`
	// AuthBlockMin is the duration, in minutes, of the block of new login
	// attempts after AuthAttempts unsuccessful login attempts.
	AuthBlockMin uint `yaml:"block_auth_min"`
	// ProxyURL is the address of proxy server for the internal HTTP client.
	ProxyURL string `yaml:"http_proxy"`
	// Language is a two-letter ISO 639-1 language code.
	Language string `yaml:"language"`
	// Theme is a UI theme for current user.
	Theme Theme `yaml:"theme"`

	// TODO(a.garipov): Make DNS and the fields below pointers and validate
	// and/or reset on explicit nulling.
	DNS      dnsConfig         `yaml:"dns"`
	TLS      tlsConfigSettings `yaml:"tls"`
	QueryLog queryLogConfig    `yaml:"querylog"`
	Stats    statsConfig       `yaml:"statistics"`

	// Filters reflects the filters from [filtering.Config].  It's cloned to the
	// config used in the filtering module at the startup.  Afterwards it's
	// cloned from the filtering module back here.
	//
	// TODO(e.burkov):  Move all the filtering configuration fields into the
	// only configuration subsection covering the changes with a single
	// migration.  Also keep the blocked services in mind.
	Filters          []filtering.FilterYAML `yaml:"filters"`
	WhitelistFilters []filtering.FilterYAML `yaml:"whitelist_filters"`
	UserRules        []string               `yaml:"user_rules"`

	DHCP      *dhcpd.ServerConfig `yaml:"dhcp"`
	Filtering *filtering.Config   `yaml:"filtering"`

	// Clients contains the YAML representations of the persistent clients.
	// This field is only used for reading and writing persistent client data.
	// Keep this field sorted to ensure consistent ordering.
	Clients *clientsConfig `yaml:"clients"`

	// Log is a block with log configuration settings.
	Log logSettings `yaml:"log"`

	OSConfig *osConfig `yaml:"os"`

	sync.RWMutex `yaml:"-"`

	// SchemaVersion is the version of the configuration schema.  See
	// [configmigrate.LastSchemaVersion].
	SchemaVersion uint `yaml:"schema_version"`

	// UnsafeUseCustomUpdateIndexURL is the URL to the custom update index.
	//
	// NOTE: It's only exists for testing purposes and should not be used in
	// release.
	UnsafeUseCustomUpdateIndexURL bool `yaml:"unsafe_use_custom_update_index_url,omitempty"`
}

// httpConfig is a block with HTTP configuration params.
//
// Field ordering is important, YAML fields better not to be reordered, if it's
// not absolutely necessary.
type httpConfig struct {
	// Pprof defines the profiling HTTP handler.  It is never nil.
	Pprof *httpPprofConfig `yaml:"pprof"`

	// DoH contains DNS-over-HTTPS configuration.  It is never nil.
	DoH *doHConfig `yaml:"doh"`

	// Address is the address to serve the web UI on.
	Address netip.AddrPort

	// SessionTTL for a web session.
	// An active session is automatically refreshed once a day.
	SessionTTL timeutil.Duration `yaml:"session_ttl"`
}

// httpPprofConfig is the block with pprof HTTP configuration.
type httpPprofConfig struct {
	// Port for the profiling handler.
	Port uint16 `yaml:"port"`

	// Enabled defines if the profiling handler is enabled.
	Enabled bool `yaml:"enabled"`
}

// doHConfig is the block with DNS-over-HTTPS configuration.
type doHConfig struct {
	// Routes is the list of HTTP route patterns for DoH requests.  Default
	// routes are:
	//   - "GET /dns-query"
	//   - "POST /dns-query"
	//   - "GET /dns-query/{ClientID}"
	//   - "POST /dns-query/{ClientID}"
	Routes []string `yaml:"routes"`

	// InsecureEnabled allows DoH queries via unencrypted HTTP.
	InsecureEnabled bool `yaml:"insecure_enabled"`
}

// dnsConfig is a block with DNS configuration params.
//
// Field ordering is important, YAML fields better not to be reordered, if it's
// not absolutely necessary.
type dnsConfig struct {
	BindHosts []netip.Addr `yaml:"bind_hosts"`
	Port      uint16       `yaml:"port"`

	// AnonymizeClientIP defines if clients' IP addresses should be anonymized
	// in query log and statistics.
	AnonymizeClientIP bool `yaml:"anonymize_client_ip"`

	// Config is the embed configuration with DNS params.
	//
	// TODO(a.garipov): Remove embed.
	dnsforward.Config `yaml:",inline"`

	// UpstreamTimeout is the timeout for querying upstream servers.
	UpstreamTimeout timeutil.Duration `yaml:"upstream_timeout"`

	// PrivateNets is the set of IP networks for which the private reverse DNS
	// resolver should be used.
	PrivateNets []netutil.Prefix `yaml:"private_networks"`

	// UsePrivateRDNS enables resolving requests containing a private IP address
	// using private reverse DNS resolvers.  See PrivateRDNSResolvers.
	//
	// TODO(e.burkov):  Rename in YAML.
	UsePrivateRDNS bool `yaml:"use_private_ptr_resolvers"`

	// PrivateRDNSResolvers is the slice of addresses to be used as upstreams
	// for private requests.  It's only used for PTR, SOA, and NS queries,
	// containing an ARPA subdomain, came from the the client with private
	// address.  The address considered private according to PrivateNets.
	//
	// If empty, the OS-provided resolvers are used for private requests.
	PrivateRDNSResolvers []string `yaml:"local_ptr_upstreams"`

	// UseDNS64 defines if DNS64 should be used for incoming requests.  Requests
	// of type PTR for addresses within the configured prefixes will be resolved
	// via [PrivateRDNSResolvers], so those should be valid and UsePrivateRDNS
	// be set to true.
	UseDNS64 bool `yaml:"use_dns64"`

	// DNS64Prefixes is the list of NAT64 prefixes to be used for DNS64.
	DNS64Prefixes []netip.Prefix `yaml:"dns64_prefixes"`

	// ServeHTTP3 defines if HTTP/3 is allowed for incoming requests.
	//
	// TODO(a.garipov): Add to the UI when HTTP/3 support is no longer
	// experimental.
	ServeHTTP3 bool `yaml:"serve_http3"`

	// UseHTTP3Upstreams defines if HTTP/3 is allowed for DNS-over-HTTPS
	// upstreams.
	//
	// TODO(a.garipov): Add to the UI when HTTP/3 support is no longer
	// experimental.
	UseHTTP3Upstreams bool `yaml:"use_http3_upstreams"`

	// ServePlainDNS defines if plain DNS is allowed for incoming requests.
	ServePlainDNS bool `yaml:"serve_plain_dns"`

	// HostsFileEnabled defines whether to use information from the system hosts
	// file to resolve queries.
	HostsFileEnabled bool `yaml:"hostsfile_enabled"`

	// PendingRequests configures duplicate requests policy.
	PendingRequests *pendingRequests `yaml:"pending_requests"`
}

// pendingRequests is a block with pending requests configuration.
type pendingRequests struct {
	// Enabled controls if duplicate requests should be sent to the upstreams
	// along with the original one.
	Enabled bool `yaml:"enabled"`
}

// tlsConfigSettings is the TLS configuration for DNS-over-TLS, DNS-over-QUIC,
// and HTTPS.  When adding new properties, update the [tlsConfigSettings.clone]
// and [tlsConfigSettings.setPrivateFieldsAndCompare] methods as necessary.
type tlsConfigSettings struct {
	// Enabled indicates whether encryption (DoT/DoH/HTTPS) is enabled.
	Enabled bool `yaml:"enabled" json:"enabled"`

	// PanelServerName is the hostname of the panel HTTPS server.  If empty, it
	// falls back to ServerName for backward compatibility.
	PanelServerName string `yaml:"panel_server_name" json:"panel_server_name,omitempty"`

	// PanelServerURLPath is the URL prefix used by the panel web interface.
	PanelServerURLPath string `yaml:"panel_server_url_path" json:"panel_server_url_path,omitempty"`

	// PanelServerPort is the HTTPS port used by the panel.  If 0, the panel
	// keeps using the legacy shared HTTPS listener on PortHTTPS.
	PanelServerPort uint16 `yaml:"panel_server_port" json:"panel_server_port,omitempty"`

	// ServerName is the hostname of the DNS encryption server.
	ServerName string `yaml:"server_name" json:"server_name,omitempty"`

	// ForceHTTPS, if true, forces an HTTP to HTTPS redirect.
	ForceHTTPS bool `yaml:"force_https" json:"force_https"`

	// PortHTTPS is the DNS-over-HTTPS port.  If 0, DoH will be disabled.
	PortHTTPS uint16 `yaml:"port_https" json:"port_https,omitempty"`

	// DNSOverHTTPSURLPath is the DoH request path.
	//
	// NOTE:  The yaml/json tag keeps the legacy field name for compatibility
	// with the customized frontend.
	DNSOverHTTPSURLPath string `yaml:"dns_over_quic_url_path" json:"dns_over_quic_url_path,omitempty"`

	// PortDNSOverTLS is the DNS-over-TLS port.  If 0, DoT will be disabled.
	PortDNSOverTLS uint16 `yaml:"port_dns_over_tls" json:"port_dns_over_tls,omitempty"`

	// PortDNSOverQUIC is the DNS-over-QUIC port.  If 0, DoQ will be disabled.
	PortDNSOverQUIC uint16 `yaml:"port_dns_over_quic" json:"port_dns_over_quic,omitempty"`

	// PortDNSCrypt is the port for DNSCrypt requests.  If it's zero, DNSCrypt
	// is disabled.
	PortDNSCrypt uint16 `yaml:"port_dnscrypt" json:"port_dnscrypt"`

	// DNSCryptConfigFile is the path to the DNSCrypt config file.  Must be set
	// if PortDNSCrypt is not zero.
	//
	// See https://github.com/AdguardTeam/dnsproxy and
	// https://github.com/ameshkov/dnscrypt.
	DNSCryptConfigFile string `yaml:"dnscrypt_config_file" json:"dnscrypt_config_file"`

	// CertificateChain is the PEM-encoded certificate chain for DNS
	// encryption.  Must be empty if [tlsConfigSettings.CertificatePath] is
	// provided.
	CertificateChain string `yaml:"certificate_chain" json:"certificate_chain"`

	// PrivateKey is the PEM-encoded private key for DNS encryption.  Must be
	// empty if [tlsConfigSettings.PrivateKeyPath] is provided.
	PrivateKey string `yaml:"private_key" json:"private_key"`

	// CertificatePath is the path to the DNS encryption certificate file.  Must
	// be empty if [tlsConfigSettings.CertificateChain] is provided.
	CertificatePath string `yaml:"certificate_path" json:"certificate_path"`

	// PrivateKeyPath is the path to the DNS encryption private key file.  Must
	// be empty if [tlsConfigSettings.PrivateKey] is provided.
	PrivateKeyPath string `yaml:"private_key_path" json:"private_key_path"`

	// CertificateKeyPairs is the list of DNS encryption certificate and private
	// key file pairs.  When more than one pair is configured, the first pair is
	// also mirrored in [tlsConfigSettings.CertificatePath] and
	// [tlsConfigSettings.PrivateKeyPath] for backward compatibility.
	CertificateKeyPairs []tlsCertificateKeyPair `yaml:"certificate_key_pairs,omitempty" json:"certificate_key_pairs,omitempty"`

	// PanelCertificateChain is the PEM-encoded certificate chain for panel
	// HTTPS.  Must be empty if [tlsConfigSettings.PanelCertificatePath] is
	// provided.
	PanelCertificateChain string `yaml:"panel_certificate_chain" json:"panel_certificate_chain"`

	// PanelPrivateKey is the PEM-encoded private key for panel HTTPS.  Must be
	// empty if [tlsConfigSettings.PanelPrivateKeyPath] is provided.
	PanelPrivateKey string `yaml:"panel_private_key" json:"panel_private_key"`

	// PanelCertificatePath is the path to the panel HTTPS certificate file.
	// Must be empty if [tlsConfigSettings.PanelCertificateChain] is provided.
	PanelCertificatePath string `yaml:"panel_certificate_path" json:"panel_certificate_path"`

	// PanelPrivateKeyPath is the path to the panel HTTPS private key file.
	// Must be empty if [tlsConfigSettings.PanelPrivateKey] is provided.
	PanelPrivateKeyPath string `yaml:"panel_private_key_path" json:"panel_private_key_path"`

	// PanelCertificateKeyPairs is the list of panel HTTPS certificate and
	// private key file pairs.  When more than one pair is configured, the first
	// pair is also mirrored in [tlsConfigSettings.PanelCertificatePath] and
	// [tlsConfigSettings.PanelPrivateKeyPath] for backward compatibility.
	PanelCertificateKeyPairs []tlsCertificateKeyPair `yaml:"panel_certificate_key_pairs,omitempty" json:"panel_certificate_key_pairs,omitempty"`

	// DNSAssignedCertificateIDs is the list of managed certificate IDs applied
	// to DNS encryption.  When non-empty, runtime uses the managed certificate
	// pool instead of the manual DNS certificate fields above.
	DNSAssignedCertificateIDs []uint64 `yaml:"dns_assigned_certificate_ids,omitempty" json:"dns_assigned_certificate_ids,omitempty"`

	// PanelAssignedCertificateIDs is the list of managed certificate IDs
	// applied to panel HTTPS.  When non-empty, runtime uses the managed
	// certificate pool instead of the manual panel certificate fields above.
	PanelAssignedCertificateIDs []uint64 `yaml:"panel_assigned_certificate_ids,omitempty" json:"panel_assigned_certificate_ids,omitempty"`

	// OverrideTLSCiphers, when set, contains the names of the cipher suites to
	// use.  If the slice is empty, the default safe suites are used.
	OverrideTLSCiphers []string `yaml:"override_tls_ciphers,omitempty" json:"-"`

	// CertificateChainData is the PEM-encoded byte data for the DNS encryption
	// certificate chain.
	CertificateChainData []byte `yaml:"-" json:"-"`

	// PrivateKeyData is the PEM-encoded byte data for the DNS encryption
	// private key.
	PrivateKeyData []byte `yaml:"-" json:"-"`

	// Certificates are the parsed TLS certificates used by DNS encryption
	// protocols such as DoH, DoT, and DoQ.
	Certificates []tls.Certificate `yaml:"-" json:"-"`

	// PanelCertificateChainData is the PEM-encoded byte data for the panel
	// HTTPS certificate chain.
	PanelCertificateChainData []byte `yaml:"-" json:"-"`

	// PanelPrivateKeyData is the PEM-encoded byte data for the panel HTTPS
	// private key.
	PanelPrivateKeyData []byte `yaml:"-" json:"-"`

	// PanelCertificates are the parsed TLS certificates used by panel HTTPS.
	PanelCertificates []tls.Certificate `yaml:"-" json:"-"`

	// StrictSNICheck controls if the connections with SNI mismatching the
	// certificate's ones should be rejected.
	StrictSNICheck bool `yaml:"strict_sni_check" json:"-"`
}

// tlsCertificateKeyPair is a pair of certificate and private key file paths.
type tlsCertificateKeyPair struct {
	// CertificatePath is the path to the certificate file.
	CertificatePath string `yaml:"certificate_path" json:"certificate_path"`

	// PrivateKeyPath is the path to the private key file.
	PrivateKeyPath string `yaml:"private_key_path" json:"private_key_path"`
}

// clone returns a deep copy of c.
func (c *tlsConfigSettings) clone() (clone *tlsConfigSettings) {
	clone = &tlsConfigSettings{}
	*clone = *c

	clone.OverrideTLSCiphers = slices.Clone(c.OverrideTLSCiphers)
	clone.CertificateKeyPairs = slices.Clone(c.CertificateKeyPairs)
	clone.PanelCertificateKeyPairs = slices.Clone(c.PanelCertificateKeyPairs)
	clone.DNSAssignedCertificateIDs = slices.Clone(c.DNSAssignedCertificateIDs)
	clone.PanelAssignedCertificateIDs = slices.Clone(c.PanelAssignedCertificateIDs)
	clone.CertificateChainData = slices.Clone(c.CertificateChainData)
	clone.PrivateKeyData = slices.Clone(c.PrivateKeyData)
	clone.Certificates = slices.Clone(c.Certificates)
	clone.PanelCertificateChainData = slices.Clone(c.PanelCertificateChainData)
	clone.PanelPrivateKeyData = slices.Clone(c.PanelPrivateKeyData)
	clone.PanelCertificates = slices.Clone(c.PanelCertificates)

	return clone
}

// certificateKeyPairs returns all configured DNS encryption certificate and key
// path pairs.
func (c *tlsConfigSettings) certificateKeyPairs() (pairs []tlsCertificateKeyPair) {
	if len(c.CertificateKeyPairs) > 0 {
		return slices.Clone(c.CertificateKeyPairs)
	}

	if c.CertificatePath == "" || c.PrivateKeyPath == "" {
		return nil
	}

	return []tlsCertificateKeyPair{{
		CertificatePath: c.CertificatePath,
		PrivateKeyPath:  c.PrivateKeyPath,
	}}
}

// panelCertificateKeyPairs returns all configured panel HTTPS certificate and
// key path pairs.
func (c *tlsConfigSettings) panelCertificateKeyPairs() (pairs []tlsCertificateKeyPair) {
	if len(c.PanelCertificateKeyPairs) > 0 {
		return slices.Clone(c.PanelCertificateKeyPairs)
	}

	if c.PanelCertificatePath == "" || c.PanelPrivateKeyPath == "" {
		return nil
	}

	return []tlsCertificateKeyPair{{
		CertificatePath: c.PanelCertificatePath,
		PrivateKeyPath:  c.PanelPrivateKeyPath,
	}}
}

// certificateWatchPairs returns all DNS encryption certificate and key path
// pairs that should be tracked for changes.  Unlike
// [tlsConfigSettings.certificateKeyPairs], it keeps mixed path/content
// single-certificate configurations to preserve compatibility with the legacy
// API.
func (c *tlsConfigSettings) certificateWatchPairs() (pairs []tlsCertificateKeyPair) {
	if len(c.CertificateKeyPairs) > 0 {
		return slices.Clone(c.CertificateKeyPairs)
	}

	if c.CertificatePath == "" && c.PrivateKeyPath == "" {
		return nil
	}

	return []tlsCertificateKeyPair{{
		CertificatePath: c.CertificatePath,
		PrivateKeyPath:  c.PrivateKeyPath,
	}}
}

// panelCertificateWatchPairs returns all panel HTTPS certificate and key path
// pairs that should be tracked for changes.
func (c *tlsConfigSettings) panelCertificateWatchPairs() (pairs []tlsCertificateKeyPair) {
	if len(c.PanelCertificateKeyPairs) > 0 {
		return slices.Clone(c.PanelCertificateKeyPairs)
	}

	if c.PanelCertificatePath == "" && c.PanelPrivateKeyPath == "" {
		return nil
	}

	return []tlsCertificateKeyPair{{
		CertificatePath: c.PanelCertificatePath,
		PrivateKeyPath:  c.PanelPrivateKeyPath,
	}}
}

// setCertificateKeyPairs normalizes DNS encryption certificate and key path
// pairs and mirrors the first pair into the legacy single-path fields.
func (c *tlsConfigSettings) setCertificateKeyPairs(pairs []tlsCertificateKeyPair) {
	if len(pairs) == 0 {
		c.CertificatePath = ""
		c.PrivateKeyPath = ""
		c.CertificateKeyPairs = nil

		return
	}

	c.CertificatePath = pairs[0].CertificatePath
	c.PrivateKeyPath = pairs[0].PrivateKeyPath

	if len(pairs) > 1 {
		c.CertificateKeyPairs = slices.Clone(pairs)
	} else {
		c.CertificateKeyPairs = nil
	}
}

// setPanelCertificateKeyPairs normalizes panel HTTPS certificate and key path
// pairs and mirrors the first pair into the single-path fields.
func (c *tlsConfigSettings) setPanelCertificateKeyPairs(pairs []tlsCertificateKeyPair) {
	if len(pairs) == 0 {
		c.PanelCertificatePath = ""
		c.PanelPrivateKeyPath = ""
		c.PanelCertificateKeyPairs = nil

		return
	}

	c.PanelCertificatePath = pairs[0].CertificatePath
	c.PanelPrivateKeyPath = pairs[0].PrivateKeyPath

	if len(pairs) > 1 {
		c.PanelCertificateKeyPairs = slices.Clone(pairs)
	} else {
		c.PanelCertificateKeyPairs = nil
	}
}

// setPrivateFieldsAndCompare sets any missing properties in conf to match those
// in c and returns true if TLS configurations are equal.  conf must not be be
// nil.
// It sets the following properties because these are not accepted from the
// frontend:
//
//	[tlsConfigSettings.DNSCryptConfigFile]
//	[tlsConfigSettings.OverrideTLSCiphers]
//	[tlsConfigSettings.DNSAssignedCertificateIDs]
//	[tlsConfigSettings.PanelAssignedCertificateIDs]
//	[tlsConfigSettings.PortDNSCrypt]
//
// The following properties are skipped as they are set by
// [tlsManager.loadTLSConfig]:
//
//	[tlsConfigSettings.CertificateChainData]
//	[tlsConfigSettings.PrivateKeyData]
func (c *tlsConfigSettings) setPrivateFieldsAndCompare(conf *tlsConfigSettings) (equal bool) {
	current := c.clone()
	cmpConf := conf.clone()

	conf.OverrideTLSCiphers = slices.Clone(c.OverrideTLSCiphers)
	conf.DNSCryptConfigFile = c.DNSCryptConfigFile
	conf.PortDNSCrypt = c.PortDNSCrypt
	conf.DNSAssignedCertificateIDs = slices.Clone(c.DNSAssignedCertificateIDs)
	conf.PanelAssignedCertificateIDs = slices.Clone(c.PanelAssignedCertificateIDs)

	cmpConf.OverrideTLSCiphers = slices.Clone(c.OverrideTLSCiphers)
	cmpConf.DNSCryptConfigFile = c.DNSCryptConfigFile
	cmpConf.PortDNSCrypt = c.PortDNSCrypt
	cmpConf.DNSAssignedCertificateIDs = slices.Clone(c.DNSAssignedCertificateIDs)
	cmpConf.PanelAssignedCertificateIDs = slices.Clone(c.PanelAssignedCertificateIDs)

	current.Certificates = nil
	cmpConf.Certificates = nil
	current.CertificateChainData = nil
	cmpConf.CertificateChainData = nil
	current.PrivateKeyData = nil
	cmpConf.PrivateKeyData = nil
	current.PanelCertificates = nil
	cmpConf.PanelCertificates = nil
	current.PanelCertificateChainData = nil
	cmpConf.PanelCertificateChainData = nil
	current.PanelPrivateKeyData = nil
	cmpConf.PanelPrivateKeyData = nil

	// TODO(a.garipov): Define a custom comparer.
	return cmp.Equal(current, cmpConf)
}

type queryLogConfig struct {
	// DirPath is the custom directory for logs.  If it's empty the default
	// directory will be used.  See [homeContext.getDataDir].
	DirPath string `yaml:"dir_path"`

	// Ignored is the list of host names, which should not be written to log.
	// "." is considered to be the root domain.
	Ignored []string `yaml:"ignored"`

	// Interval is the interval for query log's files rotation.
	Interval timeutil.Duration `yaml:"interval"`

	// MemSize is the number of entries kept in memory before they are flushed
	// to disk.
	MemSize uint `yaml:"size_memory"`

	// Enabled defines if the query log is enabled.
	Enabled bool `yaml:"enabled"`

	// IgnoredEnabled defines whether hosts from the ignored list should be
	// ignored.
	IgnoredEnabled bool `yaml:"ignored_enabled"`

	// FileEnabled defines, if the query log is written to the file.
	FileEnabled bool `yaml:"file_enabled"`
}

type statsConfig struct {
	// DirPath is the custom directory for statistics.  If it's empty the
	// default directory is used.  See [homeContext.getDataDir].
	DirPath string `yaml:"dir_path"`

	// Ignored is the list of host names, which should not be counted.
	Ignored []string `yaml:"ignored"`

	// Interval is the retention interval for statistics.
	Interval timeutil.Duration `yaml:"interval"`

	// Enabled defines if the statistics are enabled.
	Enabled bool `yaml:"enabled"`

	// IgnoredEnabled defines whether hosts from the ignored list should be
	// ignored.
	IgnoredEnabled bool `yaml:"ignored_enabled"`
}

// Default block host constants.
const (
	defaultSafeBrowsingBlockHost = "standard-block.dns.adguard.com"
	defaultParentalBlockHost     = "family-block.dns.adguard.com"
)

// config is the global configuration structure.
//
// TODO(a.garipov, e.burkov): This global is awful and must be removed.
var config = &configuration{
	AuthAttempts: 5,
	AuthBlockMin: 15,
	HTTPConfig: httpConfig{
		Address:    netip.AddrPortFrom(netip.IPv4Unspecified(), 3000),
		SessionTTL: timeutil.Duration(30 * timeutil.Day),
		Pprof: &httpPprofConfig{
			Enabled: false,
			Port:    6060,
		},
		DoH: &doHConfig{
			Routes: []string{
				"GET /dns-query",
				"POST /dns-query",
				"GET /dns-query/{ClientID}",
				"POST /dns-query/{ClientID}",
			},
			InsecureEnabled: false,
		},
	},
	DNS: dnsConfig{
		BindHosts: []netip.Addr{netip.IPv4Unspecified()},
		Port:      defaultPortDNS,
		Config: dnsforward.Config{
			Ratelimit:              200,
			RatelimitSubnetLenIPv4: 24,
			RatelimitSubnetLenIPv6: 56,
			RefuseAny:              true,
			UpstreamMode:           dnsforward.DefaultUpstreamMode,
			HandleDDR:              true,
			FastestTimeout:         timeutil.Duration(fastip.DefaultPingWaitTimeout),

			TrustedProxies: []netutil.Prefix{{
				Prefix: netip.MustParsePrefix("127.0.0.0/8"),
			}, {
				Prefix: netip.MustParsePrefix("::1/128"),
			}},
			CacheEnabled:             true,
			CacheSize:                4 * 1024 * 1024,
			CacheOptimisticAnswerTTL: timeutil.Duration(30 * time.Second),
			CacheOptimisticMaxAge:    timeutil.Duration(12 * time.Hour),
			EnableDNSSEC:             true,

			EDNSClientSubnet: &dnsforward.EDNSClientSubnet{
				CustomIP:  netip.Addr{},
				Enabled:   false,
				UseCustom: false,
			},

			// set default maximum concurrent queries to 300
			// we introduced a default limit due to this:
			// https://github.com/AdguardTeam/AdGuardHome/issues/2015#issuecomment-674041912
			// was later increased to 300 due to https://github.com/AdguardTeam/AdGuardHome/issues/2257
			MaxGoroutines: 300,
		},
		UpstreamTimeout:  timeutil.Duration(dnsforward.DefaultTimeout),
		UsePrivateRDNS:   true,
		ServePlainDNS:    true,
		HostsFileEnabled: true,
		PendingRequests: &pendingRequests{
			Enabled: true,
		},
	},
	TLS: tlsConfigSettings{
		PanelServerURLPath:  defaultPanelServerURLPath,
		PortHTTPS:           defaultPortHTTPS,
		DNSOverHTTPSURLPath: defaultDNSOverHTTPSURLPath,
		PortDNSOverTLS:      defaultPortTLS, // needs to be passed through to dnsproxy
		PortDNSOverQUIC:     defaultPortQUIC,
	},
	QueryLog: queryLogConfig{
		Enabled:        true,
		FileEnabled:    true,
		Interval:       timeutil.Duration(90 * timeutil.Day),
		MemSize:        1000,
		Ignored:        []string{},
		IgnoredEnabled: false,
	},
	Stats: statsConfig{
		Enabled:        true,
		Interval:       timeutil.Duration(1 * timeutil.Day),
		Ignored:        []string{},
		IgnoredEnabled: false,
	},
	// NOTE: Keep these parameters in sync with the one put into
	// client/src/helpers/filters/filters.ts by scripts/vetted-filters.
	//
	// TODO(a.garipov): Think of a way to make scripts/vetted-filters update
	// these as well if necessary.
	Filters: []filtering.FilterYAML{{
		Filter:  filtering.Filter{ID: 1},
		Enabled: true,
		URL:     "https://adguardteam.github.io/HostlistsRegistry/assets/filter_1.txt",
		Name:    "AdGuard DNS filter",
	}, {
		Filter:  filtering.Filter{ID: 2},
		Enabled: false,
		URL:     "https://adguardteam.github.io/HostlistsRegistry/assets/filter_2.txt",
		Name:    "AdAway Default Blocklist",
	}},
	Filtering: &filtering.Config{
		ProtectionEnabled:  true,
		BlockingMode:       filtering.BlockingModeNullIP,
		BlockedResponseTTL: 10, // in seconds

		FilteringEnabled:           true,
		FiltersUpdateIntervalHours: 24,

		RewritesEnabled: true,

		ParentalEnabled:     false,
		SafeBrowsingEnabled: false,

		SafeBrowsingCacheSize: 1 * 1024 * 1024,
		SafeSearchCacheSize:   1 * 1024 * 1024,
		ParentalCacheSize:     1 * 1024 * 1024,
		CacheTime:             30,

		SafeSearchConf: filtering.SafeSearchConfig{
			Enabled:    false,
			Bing:       true,
			DuckDuckGo: true,
			Ecosia:     true,
			Google:     true,
			Pixabay:    true,
			Yandex:     true,
			YouTube:    true,
		},

		BlockedServices: &filtering.BlockedServices{
			Schedule: schedule.EmptyWeekly(),
			IDs:      []string{},
		},

		ParentalBlockHost:     defaultParentalBlockHost,
		SafeBrowsingBlockHost: defaultSafeBrowsingBlockHost,
	},
	DHCP: &dhcpd.ServerConfig{
		LocalDomainName: "lan",
		Conf4: dhcpd.V4ServerConf{
			LeaseDuration: dhcpd.DefaultDHCPLeaseTTL,
			ICMPTimeout:   dhcpd.DefaultDHCPTimeoutICMP,
		},
		Conf6: dhcpd.V6ServerConf{
			LeaseDuration: dhcpd.DefaultDHCPLeaseTTL,
		},
	},
	Clients: &clientsConfig{
		Sources: &clientSourcesConfig{
			WHOIS:     true,
			ARP:       true,
			RDNS:      true,
			DHCP:      true,
			HostsFile: true,
		},
	},
	Log: logSettings{
		Enabled:    true,
		File:       "",
		MaxBackups: 0,
		MaxSize:    100,
		MaxAge:     3,
		Compress:   false,
		LocalTime:  false,
		Verbose:    false,
	},
	OSConfig:      &osConfig{},
	SchemaVersion: configmigrate.LastSchemaVersion,
	Theme:         ThemeAuto,
}

// configFilePath returns the absolute, symlink-resolved path to the current
// configuration file.  l must not be nil.
//
// TODO(s.chzhen):  Fix the bug where the wrong file may be resolved:
// [filepath.EvalSymlinks] resolves a relative path against the current working
// directory, not workDir.  Make the path absolute relative to workDir before
// calling EvalSymlinks.
func configFilePath(
	ctx context.Context,
	l *slog.Logger,
	workDir string,
	confPath string,
) (resolved string) {
	resolved, err := filepath.EvalSymlinks(confPath)
	if err != nil {
		l.DebugContext(
			ctx,
			"symlink resolve failed; using original path",
			"path", confPath,
			slogutil.KeyError, err,
		)

		resolved = confPath
	}

	if !filepath.IsAbs(confPath) {
		resolved = filepath.Join(workDir, confPath)
	}

	return resolved
}

// validateBindHosts returns error if any of binding hosts from configuration is
// not a valid IP address.
func validateBindHosts(
	ctx context.Context,
	l *slog.Logger,
	conf *configuration,
	fileData []byte,
) (err error) {
	if !conf.HTTPConfig.Address.IsValid() {
		return errors.Error("http.address is not a valid ip address")
	}

	for i, addr := range conf.DNS.BindHosts {
		if !addr.IsValid() {
			logIPHint(ctx, l, fileData)

			return fmt.Errorf("dns.bind_hosts at index %d is not a valid ip address", i)
		}
	}

	return nil
}

// parseConfig loads configuration from the YAML file, upgrading it if
// necessary.  l must not be nil.
func parseConfig(ctx context.Context, l *slog.Logger, workDir, confPath string) (err error) {
	// Do the upgrade if necessary.
	config.fileData, err = readConfigFile(ctx, l, workDir, confPath)
	if err != nil {
		return err
	}

	migrator := configmigrate.New(&configmigrate.Config{
		Logger:     l.With(slogutil.KeyPrefix, "config_migrator"),
		WorkingDir: workDir,
		DataDir:    filepath.Join(workDir, dataDir),
	})

	var upgraded bool
	config.fileData, upgraded, err = migrator.Migrate(
		ctx,
		config.fileData,
		configmigrate.LastSchemaVersion,
	)
	if err != nil {
		// Don't wrap the error, because it's informative enough as is.
		return err
	} else if upgraded {
		confPath = configFilePath(ctx, l, workDir, confPath)
		l.DebugContext(ctx, "writing config file after config upgrade", "path", confPath)

		err = maybe.WriteFile(confPath, config.fileData, aghos.DefaultPermFile)
		if err != nil {
			return fmt.Errorf("writing new config: %w", err)
		}
	}

	err = yaml.Unmarshal(config.fileData, &config)
	if err != nil {
		// Don't wrap the error since it's informative enough as is.
		return err
	}

	err = validateConfig(ctx, l, config.fileData)
	if err != nil {
		return err
	}

	if config.DNS.UpstreamTimeout == 0 {
		config.DNS.UpstreamTimeout = timeutil.Duration(dnsforward.DefaultTimeout)
	}

	// Do not wrap the error because it's informative enough as is.
	return validateTLSCipherIDs(config.TLS.OverrideTLSCiphers)
}

// logIPHint logs an informational message when the config contains an unquoted
// IP address with a trailing colon.  It's a best-effort check for a YAML
// parsing behavior where a list item is decoded as {key: null}.  l must not be
// nil.
func logIPHint(ctx context.Context, l *slog.Logger, data []byte) {
	var conf struct {
		DNS struct {
			BindHosts []any `yaml:"bind_hosts"`
		} `yaml:"dns"`
	}

	err := yaml.Unmarshal(data, &conf)
	if err != nil {
		// This should not happen since this is already the validation process.
		l.DebugContext(
			ctx,
			"failed to unmarshal config while logging ip hint",
			slogutil.KeyError, err,
		)

		return
	}

	for _, h := range conf.DNS.BindHosts {
		m, ok := h.(map[string]any)
		if !ok {
			continue
		}

		if !hasNilValue(m) {
			continue
		}

		l.WarnContext(ctx, "quote addresses that end with a colon in 'dns.bind_hosts'")

		return
	}
}

// hasNilValue returns true if m contains a nil value.
func hasNilValue(m map[string]any) (ok bool) {
	for _, v := range m {
		if v == nil {
			return true
		}
	}

	return false
}

// validateConfig returns error if the configuration is invalid.  l must not be
// nil.
func validateConfig(ctx context.Context, l *slog.Logger, fileData []byte) (err error) {
	err = validateBindHosts(ctx, l, config, fileData)
	if err != nil {
		// Don't wrap the error since it's informative enough as is.
		return err
	}

	tcpPorts := aghalg.UniqChecker[tcpPort]{}
	addPorts(tcpPorts, tcpPort(config.HTTPConfig.Address.Port()))

	udpPorts := aghalg.UniqChecker[udpPort]{}
	addPorts(udpPorts, udpPort(config.DNS.Port))

	if config.TLS.Enabled {
		addPorts(tcpPorts, tcpPort(config.TLS.PortDNSOverTLS), tcpPort(config.TLS.PortDNSCrypt))
		if config.TLS.PanelServerPort != 0 {
			addPorts(
				tcpPorts,
				tcpPort(config.TLS.PanelServerPort),
				tcpPort(config.TLS.PortHTTPS),
			)
		} else {
			addPorts(tcpPorts, tcpPort(config.TLS.PortHTTPS))
		}

		// TODO(e.burkov):  Consider adding a udpPort with the same value when
		// we add support for HTTP/3 for web admin interface.
		addPorts(udpPorts, udpPort(config.TLS.PortDNSOverQUIC))
	}

	if err = tcpPorts.Validate(); err != nil {
		return fmt.Errorf("validating tcp ports: %w", err)
	} else if err = udpPorts.Validate(); err != nil {
		return fmt.Errorf("validating udp ports: %w", err)
	}

	if err = normalizeTLSSettings(&config.TLS); err != nil {
		return fmt.Errorf("validating tls settings: %w", err)
	}

	if !filtering.ValidateUpdateIvl(config.Filtering.FiltersUpdateIntervalHours) {
		config.Filtering.FiltersUpdateIntervalHours = 24
	}

	if len(config.Users) == 0 {
		l.WarnContext(ctx, "no users in the configuration file; authentication is disabled")
	}

	if config.Language != "" && !allowedLanguages.Has(config.Language) {
		l.WarnContext(ctx, "unsupported language", "lang", config.Language)

		// Clear the language so the frontend can use the client's browser
		// language.
		config.Language = ""
	}

	return nil
}

// udpPort is the port number for UDP protocol.
type udpPort uint16

// tcpPort is the port number for TCP protocol.
type tcpPort uint16

// addPorts is a helper for ports validation that skips zero ports.
func addPorts[T tcpPort | udpPort](uc aghalg.UniqChecker[T], ports ...T) {
	for _, p := range ports {
		if p != 0 {
			uc.Add(p)
		}
	}
}

// readConfigFile reads configuration file contents.  l must not be nil.
func readConfigFile(
	ctx context.Context,
	l *slog.Logger,
	workDir string,
	confPath string,
) (fileData []byte, err error) {
	if len(config.fileData) > 0 {
		return config.fileData, nil
	}

	confPath = configFilePath(ctx, l, workDir, confPath)
	l.DebugContext(ctx, "reading config file", "path", confPath)

	// Do not wrap the error because it's informative enough as is.
	return os.ReadFile(confPath)
}

// write saves configuration to the YAML file and also saves the user filter
// contents to a file.  l must not be nil.
func (c *configuration) write(
	ctx context.Context,
	l *slog.Logger,
	tlsMgr *tlsManager,
	auth *auth,
	workDir string,
	confPath string,
) (err error) {
	c.Lock()
	defer c.Unlock()

	if auth != nil {
		config.Users = auth.usersList(ctx)
	}

	if tlsMgr != nil {
		extTLSConf := tlsMgr.extendedTLSConfig()
		config.TLS = *extTLSConf
	}

	if globalContext.stats != nil {
		statsConf := stats.Config{}
		globalContext.stats.WriteDiskConfig(&statsConf)
		config.Stats.Interval = timeutil.Duration(statsConf.Limit)
		config.Stats.Enabled = statsConf.Enabled
		config.Stats.Ignored = statsConf.Ignored.Values()
		config.Stats.IgnoredEnabled = statsConf.Ignored.IsEnabled()
	}

	if globalContext.queryLog != nil {
		dc := querylog.Config{}
		globalContext.queryLog.WriteDiskConfig(&dc)
		config.DNS.AnonymizeClientIP = dc.AnonymizeClientIP
		config.QueryLog.Enabled = dc.Enabled
		config.QueryLog.FileEnabled = dc.FileEnabled
		config.QueryLog.Interval = timeutil.Duration(dc.RotationIvl)
		config.QueryLog.MemSize = dc.MemSize
		config.QueryLog.Ignored = dc.Ignored.Values()
		config.QueryLog.IgnoredEnabled = dc.Ignored.IsEnabled()
	}

	if globalContext.filters != nil {
		globalContext.filters.WriteDiskConfig(config.Filtering)
		config.Filters = config.Filtering.Filters
		config.WhitelistFilters = config.Filtering.WhitelistFilters
		config.UserRules = config.Filtering.UserRules
	}

	if s := globalContext.dnsServer; s != nil {
		c := dnsforward.Config{}
		s.WriteDiskConfig(&c)
		dns := &config.DNS
		dns.Config = c

		dns.PrivateRDNSResolvers = s.LocalPTRResolvers()

		addrProcConf := s.AddrProcConfig()
		config.Clients.Sources.RDNS = addrProcConf.UseRDNS
		config.Clients.Sources.WHOIS = addrProcConf.UseWHOIS
		dns.UsePrivateRDNS = addrProcConf.UsePrivateRDNS
		dns.UpstreamTimeout = timeutil.Duration(s.UpstreamTimeout())
	}

	if globalContext.dhcpServer != nil {
		globalContext.dhcpServer.WriteDiskConfig(config.DHCP)
	}

	config.Clients.Persistent = globalContext.clients.forConfig()

	confPath = configFilePath(ctx, l, workDir, confPath)
	l.DebugContext(ctx, "writing config file", "path", confPath)

	buf := &bytes.Buffer{}
	enc := yaml.NewEncoder(buf)
	enc.SetIndent(2)

	err = enc.Encode(config)
	if err != nil {
		return fmt.Errorf("generating config file: %w", err)
	}

	err = maybe.WriteFile(confPath, buf.Bytes(), aghos.DefaultPermFile)
	if err != nil {
		return fmt.Errorf("writing config file: %w", err)
	}

	return nil
}

// validateTLSCipherIDs validates the custom TLS cipher suite IDs.
func validateTLSCipherIDs(cipherIDs []string) (err error) {
	if len(cipherIDs) == 0 {
		return nil
	}

	_, err = aghtls.ParseCiphers(cipherIDs)
	if err != nil {
		return fmt.Errorf("override_tls_ciphers: %w", err)
	}

	return nil
}

// defaultConfigModifier is a default [agh.ConfigModifier] implementation.
type defaultConfigModifier struct {
	auth     *auth
	config   *configuration
	logger   *slog.Logger
	tlsMgr   *tlsManager
	workDir  string
	confPath string
}

// newDefaultConfigModifier returns the new properly initialized
// *defaultConfigModifier.  All arguments must not be nil.
//
// TODO(s.chzhen):  Consider using configuration struct.
func newDefaultConfigModifier(
	conf *configuration,
	l *slog.Logger,
	workDir string,
	confPath string,
) (cm *defaultConfigModifier) {
	return &defaultConfigModifier{
		config:   conf,
		logger:   l,
		workDir:  workDir,
		confPath: confPath,
	}
}

// type check
var _ agh.ConfigModifier = (*defaultConfigModifier)(nil)

// Apply implements the [agh.ConfigModifier] interface for
// *defaultConfigModifier.
func (cm *defaultConfigModifier) Apply(ctx context.Context) {
	err := cm.config.write(ctx, cm.logger, cm.tlsMgr, cm.auth, cm.workDir, cm.confPath)
	if err != nil {
		cm.logger.ErrorContext(ctx, "writing config", slogutil.KeyError, err)
	}
}

// setAuth sets the auth parameters used by Apply.
func (cm *defaultConfigModifier) setAuth(a *auth) {
	cm.auth = a
}

// setTLSManager sets the TLS manager used by Apply.
func (cm *defaultConfigModifier) setTLSManager(m *tlsManager) {
	cm.tlsMgr = m
}

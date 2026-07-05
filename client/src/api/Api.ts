import { fetchRequest } from './fetch';

import { BASE_URL } from '../../constants';

import { detectCurrentPanelPage, getCurrentPanelBasePath, getPanelPagePath, getPathWithQueryString } from '../helpers/helpers';
import { QUERY_LOGS_PAGE_LIMIT, HTML_PAGES, THEMES } from '../helpers/constants';
import i18n from '../i18n';
import { LANGUAGES } from '../helpers/twosky';

class Api {
    baseUrl = BASE_URL;

    async makeRequest(path: any, method = 'POST', config: any = {}) {
        const url = `${this.baseUrl}/${path}`;

        try {
            const response = await fetchRequest(url, method, config);
            return response.data;
        } catch (error: any) {
            const errorPath = url;

            if (error.response) {
                const { pathname } = document.location;
                const currentPage = detectCurrentPanelPage(pathname);
                const shouldRedirect = currentPage !== HTML_PAGES.LOGIN && currentPage !== HTML_PAGES.INSTALL;

                if (error.response.status === 403 && shouldRedirect) {
                    const loginPageUrl = `${window.location.origin}${getPanelPagePath(
                        HTML_PAGES.LOGIN,
                        getCurrentPanelBasePath(pathname),
                    )}`;
                    window.location.replace(loginPageUrl);
                    return false;
                }

                throw new Error(`${errorPath} | ${error.response.data} | ${error.response.status}`);
            }

            throw new Error(`${errorPath} | ${error.message || error}`);
        }
    }

    // Global methods
    GLOBAL_STATUS = { path: 'status', method: 'GET' };

    GLOBAL_TEST_UPSTREAM_DNS = { path: 'test_upstream_dns', method: 'POST' };

    GLOBAL_VERSION = { path: 'version.json', method: 'POST' };

    GLOBAL_UPDATE = { path: 'update', method: 'POST' };

    getGlobalStatus() {
        const { path, method } = this.GLOBAL_STATUS;

        return this.makeRequest(path, method);
    }

    testUpstream(servers: any) {
        const { path, method } = this.GLOBAL_TEST_UPSTREAM_DNS;
        const config = {
            data: servers,
        };
        return this.makeRequest(path, method, config);
    }

    getGlobalVersion(data: any) {
        const { path, method } = this.GLOBAL_VERSION;
        const config = {
            data,
        };
        return this.makeRequest(path, method, config);
    }

    getUpdate() {
        const { path, method } = this.GLOBAL_UPDATE;

        return this.makeRequest(path, method);
    }

    // Filtering
    FILTERING_STATUS = { path: 'filtering/status', method: 'GET' };

    FILTERING_ADD_FILTER = { path: 'filtering/add_url', method: 'POST' };

    FILTERING_REMOVE_FILTER = { path: 'filtering/remove_url', method: 'POST' };

    FILTERING_SET_RULES = { path: 'filtering/set_rules', method: 'POST' };

    FILTERING_REFRESH = { path: 'filtering/refresh', method: 'POST' };

    FILTERING_SET_URL = { path: 'filtering/set_url', method: 'POST' };

    FILTERING_CONFIG = { path: 'filtering/config', method: 'POST' };

    FILTERING_CHECK_HOST = { path: 'filtering/check_host', method: 'GET' };

    getFilteringStatus() {
        const { path, method } = this.FILTERING_STATUS;

        return this.makeRequest(path, method);
    }

    refreshFilters(config: any) {
        const { path, method } = this.FILTERING_REFRESH;
        const parameters = {
            data: config,
        };

        return this.makeRequest(path, method, parameters);
    }

    addFilter(config: any) {
        const { path, method } = this.FILTERING_ADD_FILTER;
        const parameters = {
            data: config,
        };

        return this.makeRequest(path, method, parameters);
    }

    removeFilter(config: any) {
        const { path, method } = this.FILTERING_REMOVE_FILTER;
        const parameters = {
            data: config,
        };

        return this.makeRequest(path, method, parameters);
    }

    setRules(rules: any) {
        const { path, method } = this.FILTERING_SET_RULES;
        const parameters = {
            data: rules,
        };
        return this.makeRequest(path, method, parameters);
    }

    setFiltersConfig(config: any) {
        const { path, method } = this.FILTERING_CONFIG;
        const parameters = {
            data: config,
        };
        return this.makeRequest(path, method, parameters);
    }

    setFilterUrl(config: any) {
        const { path, method } = this.FILTERING_SET_URL;
        const parameters = {
            data: config,
        };
        return this.makeRequest(path, method, parameters);
    }

    checkHost(params: any) {
        const { path, method } = this.FILTERING_CHECK_HOST;
        const url = getPathWithQueryString(path, params);

        return this.makeRequest(url, method);
    }

    // Parental
    PARENTAL_STATUS = { path: 'parental/status', method: 'GET' };

    PARENTAL_ENABLE = { path: 'parental/enable', method: 'POST' };

    PARENTAL_DISABLE = { path: 'parental/disable', method: 'POST' };

    getParentalStatus() {
        const { path, method } = this.PARENTAL_STATUS;

        return this.makeRequest(path, method);
    }

    enableParentalControl() {
        const { path, method } = this.PARENTAL_ENABLE;

        return this.makeRequest(path, method);
    }

    disableParentalControl() {
        const { path, method } = this.PARENTAL_DISABLE;

        return this.makeRequest(path, method);
    }

    // Safebrowsing
    SAFEBROWSING_STATUS = { path: 'safebrowsing/status', method: 'GET' };

    SAFEBROWSING_ENABLE = { path: 'safebrowsing/enable', method: 'POST' };

    SAFEBROWSING_DISABLE = { path: 'safebrowsing/disable', method: 'POST' };

    getSafebrowsingStatus() {
        const { path, method } = this.SAFEBROWSING_STATUS;

        return this.makeRequest(path, method);
    }

    enableSafebrowsing() {
        const { path, method } = this.SAFEBROWSING_ENABLE;

        return this.makeRequest(path, method);
    }

    disableSafebrowsing() {
        const { path, method } = this.SAFEBROWSING_DISABLE;

        return this.makeRequest(path, method);
    }

    // Safesearch
    SAFESEARCH_STATUS = { path: 'safesearch/status', method: 'GET' };

    SAFESEARCH_UPDATE = { path: 'safesearch/settings', method: 'PUT' };

    getSafesearchStatus() {
        const { path, method } = this.SAFESEARCH_STATUS;

        return this.makeRequest(path, method);
    }

    /**
     * interface SafeSearchConfig {
        "enabled": boolean,
        "bing": boolean,
        "duckduckgo": boolean,
        "google": boolean,
        "pixabay": boolean,
        "yandex": boolean,
        "youtube": boolean
     * }
     * @param {*} data - SafeSearchConfig
     * @returns 200 ok
     */
    updateSafesearch(data: any) {
        const { path, method } = this.SAFESEARCH_UPDATE;
        return this.makeRequest(path, method, { data });
    }

    // enableSafesearch() {
    //     const { path, method } = this.SAFESEARCH_ENABLE;
    //     return this.makeRequest(path, method);
    // }

    // disableSafesearch() {
    //     const { path, method } = this.SAFESEARCH_DISABLE;
    //     return this.makeRequest(path, method);
    // }

    // Language

    async changeLanguage(config: any) {
        const profile = await this.getProfile();
        profile.language = config.language;

        return this.setProfile(profile);
    }

    // Theme

    async changeTheme(config: any) {
        const profile = await this.getProfile();
        profile.theme = config.theme;

        return this.setProfile(profile);
    }

    // DHCP
    DHCP_STATUS = { path: 'dhcp/status', method: 'GET' };

    DHCP_SET_CONFIG = { path: 'dhcp/set_config', method: 'POST' };

    DHCP_FIND_ACTIVE = { path: 'dhcp/find_active_dhcp', method: 'POST' };

    DHCP_INTERFACES = { path: 'dhcp/interfaces', method: 'GET' };

    DHCP_ADD_STATIC_LEASE = { path: 'dhcp/add_static_lease', method: 'POST' };

    DHCP_REMOVE_STATIC_LEASE = { path: 'dhcp/remove_static_lease', method: 'POST' };

    DHCP_UPDATE_STATIC_LEASE = { path: 'dhcp/update_static_lease', method: 'POST' };

    DHCP_RESET = { path: 'dhcp/reset', method: 'POST' };

    DHCP_LEASES_RESET = { path: 'dhcp/reset_leases', method: 'POST' };

    getDhcpStatus() {
        const { path, method } = this.DHCP_STATUS;

        return this.makeRequest(path, method);
    }

    getDhcpInterfaces() {
        const { path, method } = this.DHCP_INTERFACES;

        return this.makeRequest(path, method);
    }

    setDhcpConfig(config: any) {
        const { path, method } = this.DHCP_SET_CONFIG;
        const parameters = {
            data: config,
        };
        return this.makeRequest(path, method, parameters);
    }

    findActiveDhcp(req: any) {
        const { path, method } = this.DHCP_FIND_ACTIVE;
        const parameters = {
            data: req,
        };
        return this.makeRequest(path, method, parameters);
    }

    addStaticLease(config: any) {
        const { path, method } = this.DHCP_ADD_STATIC_LEASE;
        const parameters = {
            data: config,
        };
        return this.makeRequest(path, method, parameters);
    }

    removeStaticLease(config: any) {
        const { path, method } = this.DHCP_REMOVE_STATIC_LEASE;
        const parameters = {
            data: config,
        };
        return this.makeRequest(path, method, parameters);
    }

    updateStaticLease(config: any) {
        const { path, method } = this.DHCP_UPDATE_STATIC_LEASE;
        const parameters = {
            data: config,
        };
        return this.makeRequest(path, method, parameters);
    }

    resetDhcp() {
        const { path, method } = this.DHCP_RESET;

        return this.makeRequest(path, method);
    }

    resetDhcpLeases() {
        const { path, method } = this.DHCP_LEASES_RESET;

        return this.makeRequest(path, method);
    }

    // Installation
    INSTALL_GET_ADDRESSES = { path: 'install/get_addresses', method: 'GET' };

    INSTALL_CONFIGURE = { path: 'install/configure', method: 'POST' };

    INSTALL_CHECK_CONFIG = { path: 'install/check_config', method: 'POST' };

    getDefaultAddresses() {
        const { path, method } = this.INSTALL_GET_ADDRESSES;

        return this.makeRequest(path, method);
    }

    setAllSettings(config: any) {
        const { path, method } = this.INSTALL_CONFIGURE;
        const parameters = {
            data: config,
        };
        return this.makeRequest(path, method, parameters);
    }

    checkConfig(config: any) {
        const { path, method } = this.INSTALL_CHECK_CONFIG;
        const parameters = {
            data: config,
        };
        return this.makeRequest(path, method, parameters);
    }

    // DNS-over-HTTPS and DNS-over-TLS
    TLS_STATUS = { path: 'tls/status', method: 'GET' };

    TLS_CONFIG = { path: 'tls/configure', method: 'POST' };

    TLS_VALIDATE = { path: 'tls/validate', method: 'POST' };

    getTlsStatus() {
        const { path, method } = this.TLS_STATUS;

        return this.makeRequest(path, method);
    }

    setTlsConfig(config: any) {
        const { path, method } = this.TLS_CONFIG;
        const parameters = {
            data: config,
        };
        return this.makeRequest(path, method, parameters);
    }

    validateTlsConfig(config: any) {
        const { path, method } = this.TLS_VALIDATE;
        const parameters = {
            data: config,
        };
        return this.makeRequest(path, method, parameters);
    }

    // Per-client settings
    GET_CLIENTS = { path: 'clients', method: 'GET' };

    SEARCH_CLIENTS = { path: 'clients/search', method: 'POST' };

    ADD_CLIENT = { path: 'clients/add', method: 'POST' };

    DELETE_CLIENT = { path: 'clients/delete', method: 'POST' };

    UPDATE_CLIENT = { path: 'clients/update', method: 'POST' };

    getClients() {
        const { path, method } = this.GET_CLIENTS;

        return this.makeRequest(path, method);
    }

    addClient(config: any) {
        const { path, method } = this.ADD_CLIENT;
        const parameters = {
            data: config,
        };
        return this.makeRequest(path, method, parameters);
    }

    deleteClient(config: any) {
        const { path, method } = this.DELETE_CLIENT;
        const parameters = {
            data: config,
        };
        return this.makeRequest(path, method, parameters);
    }

    updateClient(config: any) {
        const { path, method } = this.UPDATE_CLIENT;
        const parameters = {
            data: config,
        };
        return this.makeRequest(path, method, parameters);
    }

    searchClients(config: any) {
        const { path, method } = this.SEARCH_CLIENTS;
        const parameters = {
            data: config,
        };
        return this.makeRequest(path, method, parameters);
    }

    // DNS access settings
    ACCESS_LIST = { path: 'access/list', method: 'GET' };

    ACCESS_SET = { path: 'access/set', method: 'POST' };

    getAccessList() {
        const { path, method } = this.ACCESS_LIST;

        return this.makeRequest(path, method);
    }

    setAccessList(config: any) {
        const { path, method } = this.ACCESS_SET;
        const parameters = {
            data: config,
        };
        return this.makeRequest(path, method, parameters);
    }

    // DNS rewrites
    REWRITE_TEXT = { path: 'rewrite/text', method: 'GET' };

    REWRITE_TEXT_UPDATE = { path: 'rewrite/text', method: 'PUT' };

    REWRITE_SETTINGS = { path: 'rewrite/settings', method: 'GET' };

    REWRITE_SETTINGS_UPDATE = { path: 'rewrite/settings/update', method: 'PUT' };

    getRewriteText() {
        const { path, method } = this.REWRITE_TEXT;

        return this.makeRequest(path, method);
    }

    updateRewriteText(data: { rules: string }) {
        const { path, method } = this.REWRITE_TEXT_UPDATE;
        const parameters = {
            data,
        };

        return this.makeRequest(path, method, parameters);
    }

    updateRewriteSettings(config: any) {
        const { path, method } = this.REWRITE_SETTINGS_UPDATE;
        const parameters = {
            data: config,
        };
        return this.makeRequest(path, method, parameters);
    }

    getRewriteSettings() {
        const { path, method } = this.REWRITE_SETTINGS;

        return this.makeRequest(path, method);
    }

    // Simple domain lists
    SIMPLE_ALLOWLIST_TEXT = { path: 'simple_allowlist/text', method: 'GET' };

    SIMPLE_ALLOWLIST_TEXT_UPDATE = { path: 'simple_allowlist/text', method: 'PUT' };

    SIMPLE_BLOCKLIST_TEXT = { path: 'simple_blocklist/text', method: 'GET' };

    SIMPLE_BLOCKLIST_TEXT_UPDATE = { path: 'simple_blocklist/text', method: 'PUT' };

    getSimpleAllowlistText() {
        const { path, method } = this.SIMPLE_ALLOWLIST_TEXT;

        return this.makeRequest(path, method);
    }

    updateSimpleAllowlistText(data: { rules: string }) {
        const { path, method } = this.SIMPLE_ALLOWLIST_TEXT_UPDATE;
        const parameters = {
            data,
        };

        return this.makeRequest(path, method, parameters);
    }

    getSimpleBlocklistText() {
        const { path, method } = this.SIMPLE_BLOCKLIST_TEXT;

        return this.makeRequest(path, method);
    }

    updateSimpleBlocklistText(data: { rules: string }) {
        const { path, method } = this.SIMPLE_BLOCKLIST_TEXT_UPDATE;
        const parameters = {
            data,
        };

        return this.makeRequest(path, method, parameters);
    }

    // Blocked services
    BLOCKED_SERVICES_GET = { path: 'blocked_services/get', method: 'GET' };

    BLOCKED_SERVICES_UPDATE = { path: 'blocked_services/update', method: 'PUT' };

    BLOCKED_SERVICES_ALL = { path: 'blocked_services/all', method: 'GET' };

    getAllBlockedServices() {
        const { path, method } = this.BLOCKED_SERVICES_ALL;

        return this.makeRequest(path, method);
    }

    getBlockedServices() {
        const { path, method } = this.BLOCKED_SERVICES_GET;

        return this.makeRequest(path, method);
    }

    updateBlockedServices(config: any) {
        const { path, method } = this.BLOCKED_SERVICES_UPDATE;
        const parameters = {
            data: config,
        };
        return this.makeRequest(path, method, parameters);
    }

    // Settings for statistics
    GET_STATS = { path: 'stats', method: 'GET' };

    GET_STATS_CONFIG = { path: 'stats/config', method: 'GET' };

    UPDATE_STATS_CONFIG = { path: 'stats/config/update', method: 'PUT' };

    STATS_RESET = { path: 'stats_reset', method: 'POST' };

    getStats() {
        const { path, method } = this.GET_STATS;

        return this.makeRequest(path, method);
    }

    getStatsConfig() {
        const { path, method } = this.GET_STATS_CONFIG;

        return this.makeRequest(path, method);
    }

    setStatsConfig(data: any) {
        const { path, method } = this.UPDATE_STATS_CONFIG;
        const config = {
            data,
        };
        return this.makeRequest(path, method, config);
    }

    resetStats() {
        const { path, method } = this.STATS_RESET;

        return this.makeRequest(path, method);
    }

    // Query log
    GET_QUERY_LOG = { path: 'querylog', method: 'GET' };

    UPDATE_QUERY_LOG_CONFIG = { path: 'querylog/config/update', method: 'PUT' };

    GET_QUERY_LOG_CONFIG = { path: 'querylog/config', method: 'GET' };

    QUERY_LOG_CLEAR = { path: 'querylog_clear', method: 'POST' };

    getQueryLog(params: any) {
        const { path, method } = this.GET_QUERY_LOG;
        // eslint-disable-next-line no-param-reassign
        params.limit = QUERY_LOGS_PAGE_LIMIT;
        const url = getPathWithQueryString(path, params);

        return this.makeRequest(url, method);
    }

    getQueryLogConfig() {
        const { path, method } = this.GET_QUERY_LOG_CONFIG;

        return this.makeRequest(path, method);
    }

    setQueryLogConfig(data: any) {
        const { path, method } = this.UPDATE_QUERY_LOG_CONFIG;
        const config = {
            data,
        };
        return this.makeRequest(path, method, config);
    }

    clearQueryLog() {
        const { path, method } = this.QUERY_LOG_CLEAR;

        return this.makeRequest(path, method);
    }

    // Login
    LOGIN = { path: 'login', method: 'POST' };

    login(data: any) {
        const { path, method } = this.LOGIN;
        const config = {
            data,
        };
        return this.makeRequest(path, method, config);
    }

    // Profile
    GET_PROFILE = { path: 'profile', method: 'GET' };

    UPDATE_PROFILE = { path: 'profile/update', method: 'PUT' };

    UPDATE_ADMIN = { path: 'admin/update', method: 'PUT' };

    getProfile() {
        const { path, method } = this.GET_PROFILE;

        return this.makeRequest(path, method);
    }

    setProfile(data: any) {
        const theme = data.theme ? data.theme : THEMES.auto;
        const defaultLanguage = i18n.language ? i18n.language : LANGUAGES.en;
        const language = data.language ? data.language : defaultLanguage;

        const { path, method } = this.UPDATE_PROFILE;
        const config = { data: { theme, language } };

        return this.makeRequest(path, method, config);
    }

    updateAdminCredentials(data: any) {
        const { path, method } = this.UPDATE_ADMIN;

        return this.makeRequest(path, method, { data });
    }

    // DNS config
    GET_DNS_CONFIG = { path: 'dns_info', method: 'GET' };

    SET_DNS_CONFIG = { path: 'dns_config', method: 'POST' };

    getDnsConfig() {
        const { path, method } = this.GET_DNS_CONFIG;

        return this.makeRequest(path, method);
    }

    setDnsConfig(data: any) {
        const { path, method } = this.SET_DNS_CONFIG;
        const config = {
            data,
        };
        return this.makeRequest(path, method, config);
    }

    SET_PROTECTION = { path: 'protection', method: 'POST' };

    setProtection(data: any) {
        const { enabled, duration } = data;
        const { path, method } = this.SET_PROTECTION;

        return this.makeRequest(path, method, { data: { enabled, duration } });
    }

    // Certificate manager
    CERT_MANAGER_OVERVIEW = { path: 'certificate_manager/acme-overview', method: 'GET' };

    CERT_MANAGER_VERSIONS = { path: 'certificate_manager/acme-versions', method: 'GET' };

    CERT_MANAGER_UPDATE_INFO = { path: 'certificate_manager/acme-update-info', method: 'GET' };

    CERT_MANAGER_IP_OPTIONS = { path: 'certificate_manager/ip-options', method: 'GET' };

    CERT_MANAGER_CERTIFICATE_LIST = { path: 'certificate_manager/certificate-list', method: 'GET' };

    CERT_MANAGER_CERTIFICATE_MATERIAL = { path: 'certificate_manager/certificate-material', method: 'GET' };

    CERT_MANAGER_INSTALL = { path: 'certificate_manager/acme-install', method: 'POST' };

    CERT_MANAGER_REMOVE = { path: 'certificate_manager/acme-remove', method: 'POST' };

    CERT_MANAGER_UPGRADE = { path: 'certificate_manager/acme-upgrade', method: 'POST' };

    CERT_MANAGER_ISSUE = { path: 'certificate_manager/acme-issue', method: 'POST' };

    CERT_MANAGER_RENEW = { path: 'certificate_manager/acme-renew', method: 'POST' };

    CERT_MANAGER_PUSH = { path: 'certificate_manager/acme-push', method: 'POST' };

    CERT_MANAGER_SET_AUTO_RENEW = { path: 'certificate_manager/acme-set-auto-renew', method: 'POST' };

    CERT_MANAGER_APPLY = { path: 'certificate_manager/acme-apply', method: 'POST' };

    CERT_MANAGER_UNAPPLY = { path: 'certificate_manager/acme-unapply', method: 'POST' };

    CERT_MANAGER_DELETE = { path: 'certificate_manager/acme-delete', method: 'POST' };

    CERT_MANAGER_SAVE_CONTACT_EMAIL = { path: 'certificate_manager/acme-contact-email-save', method: 'POST' };

    CERT_MANAGER_SAVE_ACME_ACCOUNT = { path: 'certificate_manager/acme-account-save', method: 'POST' };

    CERT_MANAGER_DELETE_ACME_ACCOUNT = { path: 'certificate_manager/acme-account-delete', method: 'POST' };

    CERT_MANAGER_SAVE_DNS_ACCOUNT = { path: 'certificate_manager/acme-dns-account-save', method: 'POST' };

    CERT_MANAGER_DELETE_DNS_ACCOUNT = { path: 'certificate_manager/acme-dns-account-delete', method: 'POST' };

    getCertificateManagerOverview() {
        const { path, method } = this.CERT_MANAGER_OVERVIEW;

        return this.makeRequest(path, method);
    }

    getCertificateManagerVersions(params: any = {}) {
        const { path, method } = this.CERT_MANAGER_VERSIONS;
        const url = getPathWithQueryString(path, params);

        return this.makeRequest(url, method);
    }

    getCertificateManagerUpdateInfo() {
        const { path, method } = this.CERT_MANAGER_UPDATE_INFO;

        return this.makeRequest(path, method);
    }

    getCertificateManagerIPOptions() {
        const { path, method } = this.CERT_MANAGER_IP_OPTIONS;

        return this.makeRequest(path, method);
    }

    getCertificateManagerCertificateList() {
        const { path, method } = this.CERT_MANAGER_CERTIFICATE_LIST;

        return this.makeRequest(path, method);
    }

    getCertificateManagerMaterial(params: any) {
        const { path, method } = this.CERT_MANAGER_CERTIFICATE_MATERIAL;
        const url = getPathWithQueryString(path, params);

        return this.makeRequest(url, method);
    }

    installCertificateManagerAcme(data: any) {
        const { path, method } = this.CERT_MANAGER_INSTALL;

        return this.makeRequest(path, method, { data });
    }

    removeCertificateManagerAcme(data: any) {
        const { path, method } = this.CERT_MANAGER_REMOVE;

        return this.makeRequest(path, method, { data });
    }

    upgradeCertificateManagerAcme() {
        const { path, method } = this.CERT_MANAGER_UPGRADE;

        return this.makeRequest(path, method);
    }

    issueCertificateManagerCertificate(data: any) {
        const { path, method } = this.CERT_MANAGER_ISSUE;

        return this.makeRequest(path, method, { data });
    }

    renewCertificateManagerCertificate(data: any) {
        const { path, method } = this.CERT_MANAGER_RENEW;

        return this.makeRequest(path, method, { data });
    }

    pushCertificateManagerCertificate(data: any) {
        const { path, method } = this.CERT_MANAGER_PUSH;

        return this.makeRequest(path, method, { data });
    }

    setCertificateManagerAutoRenew(data: any) {
        const { path, method } = this.CERT_MANAGER_SET_AUTO_RENEW;

        return this.makeRequest(path, method, { data });
    }

    applyCertificateManagerCertificate(data: any) {
        const { path, method } = this.CERT_MANAGER_APPLY;

        return this.makeRequest(path, method, { data });
    }

    unapplyCertificateManagerCertificate(data: any) {
        const { path, method } = this.CERT_MANAGER_UNAPPLY;

        return this.makeRequest(path, method, { data });
    }

    deleteCertificateManagerCertificate(data: any) {
        const { path, method } = this.CERT_MANAGER_DELETE;

        return this.makeRequest(path, method, { data });
    }

    saveCertificateManagerContactEmail(data: any) {
        const { path, method } = this.CERT_MANAGER_SAVE_CONTACT_EMAIL;

        return this.makeRequest(path, method, { data });
    }

    saveCertificateManagerAcmeAccount(data: any) {
        const { path, method } = this.CERT_MANAGER_SAVE_ACME_ACCOUNT;

        return this.makeRequest(path, method, { data });
    }

    deleteCertificateManagerAcmeAccount(data: any) {
        const { path, method } = this.CERT_MANAGER_DELETE_ACME_ACCOUNT;

        return this.makeRequest(path, method, { data });
    }

    saveCertificateManagerDnsAccount(data: any) {
        const { path, method } = this.CERT_MANAGER_SAVE_DNS_ACCOUNT;

        return this.makeRequest(path, method, { data });
    }

    deleteCertificateManagerDnsAccount(data: any) {
        const { path, method } = this.CERT_MANAGER_DELETE_DNS_ACCOUNT;

        return this.makeRequest(path, method, { data });
    }

    // Cache
    CLEAR_CACHE = { path: 'cache_clear', method: 'POST' };

    clearCache() {
        const { path, method } = this.CLEAR_CACHE;

        return this.makeRequest(path, method);
    }
}

const apiClient = new Api();
export default apiClient;

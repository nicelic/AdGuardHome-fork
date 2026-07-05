/* eslint-disable max-len */
import React, { useEffect, useMemo, useState } from 'react';
import ReactModal from 'react-modal';
import CreatableSelect from 'react-select/creatable';
import { useDispatch } from 'react-redux';

import apiClient from '../../api/Api';
import { addErrorToast, addSuccessToast } from '../../actions/toasts';
import PageTitle from '../ui/PageTitle';
import {
    buildCertificateManagerIPSelectOptions,
    CertificateManagerIPOption,
    normalizeCertificateManagerIPList,
    normalizeCertificateManagerIPOptions,
    serializeCertificateManagerIPList,
} from './ipOptions';
import '../ui/Modal.css';
import './CertificateManager.css';

if (typeof document !== 'undefined') {
    ReactModal.setAppElement('#root');
}

type DnsProviderField = {
    key: string;
    label: string;
    required?: boolean;
    placeholder?: string;
};

type DnsProvider = {
    providerCode: string;
    name: string;
    helper: string;
    fields: DnsProviderField[];
};

type AcmeAccount = {
    id: number;
    name: string;
    email: string;
    server: string;
    keyLength: string;
    remark: string;
    updatedAt: number;
};

type DnsAccount = {
    id: number;
    name: string;
    providerName: string;
    providerCode: string;
    env: Record<string, string>;
    remark: string;
    updatedAt: number;
};

type CertificateRecord = {
    id: number;
    displayId: number;
    mainDomain: string;
    domains: string[];
    certificateType: string;
    challenge: string;
    keyLength: string;
    issuedKeyAlgorithm: string;
    issuedSignatureAlgorithm: string;
    caServer: string;
    acmeAccountId: number;
    acmeAccountName: string;
    dnsAccountId: number;
    dnsAccountName: string;
    autoRenew: boolean;
    remark: string;
    webroot: string;
    dnsProvider: string;
    dnsEnvText: string;
    customArgs: string;
    pushDir: string;
    certPath: string;
    keyPath: string;
    fullchainPath: string;
    chainPath: string;
    fingerprint: string;
    notBefore: number;
    notAfter: number;
    lastIssuedAt: number;
    lastRenewedAt: number;
    updatedAt: number;
    createdAt: number;
    lastError: string;
    lastOutput: string;
    status: string;
    statusLabel: string;
    statusTone: string;
    expiresInDays: number;
    usageLabel: string;
    inUseByPanel: boolean;
    inUseByDNS: boolean;
};

type CertificateMaterial = {
    id: number;
    mainDomain: string;
    certPath: string;
    keyPath: string;
    fullchainPath: string;
    chainPath: string;
    certPem: string;
    keyPem: string;
    fullchainPem: string;
    chainPem: string;
    fingerprint: string;
    issuedKeyAlgorithm: string;
    issuedSignatureAlgorithm: string;
};

type VersionItem = {
    version: string;
    displayName: string;
    publishedAt: number;
};

type VersionListResult = {
    items: VersionItem[];
    page: number;
    perPage: number;
    hasMore: boolean;
};

type VersionCheckResult = {
    supported: boolean;
    installed: boolean;
    managedInstalled: boolean;
    currentVersion: string;
    latestVersion: string;
    hasUpdate: boolean;
    message: string;
    checkedAt: number;
};

type Overview = {
    supported: boolean;
    installed: boolean;
    managedInstalled: boolean;
    version: string;
    scriptPath: string;
    homeDir: string;
    contactEmail: string;
    preferredCA: string;
    defaultChallenge: string;
    defaultWebroot: string;
    defaultDnsProvider: string;
    defaultKeyLength: string;
    updateStatus: string;
    autoUpgrade: boolean;
    autoRenewWindow: {
        windowDays: number;
        dynamicByValidity: boolean;
        thresholdDays: number;
        minDynamicWindowDay: number;
        examples: number[];
    };
    caOptions: { name: string; value: string }[];
    dnsProviders: DnsProvider[];
    acmeAccounts: AcmeAccount[];
    dnsAccounts: DnsAccount[];
    certificates: CertificateRecord[];
};

type DnsAccountFormState = {
    id: number;
    name: string;
    providerCode: string;
    env: Record<string, string>;
    extraEnvText: string;
    remark: string;
};

type AcmeAccountFormState = {
    id: number;
    name: string;
    email: string;
    server: string;
    keyLength: string;
    remark: string;
};

type IssueFormState = {
    certificateType: 'domain' | 'ip';
    domainsText: string;
    ipAddresses: string[];
    challenge: string;
    webroot: string;
    dnsProvider: string;
    dnsAccountId: number;
    dnsEnvText: string;
    server: string;
    keyLength: string;
    customArgs: string;
    acmeAccountId: number;
    autoRenew: boolean;
    remark: string;
    pushDir: string;
};

type CertificateManagerIPSelectOption = {
    label: string;
    value: string;
};

const CERTIFICATE_MODAL_PORTAL_CLASS = 'certificate-manager__modal-portal';

const certificateModeOptions = [
    { label: '域名证书', value: 'domain' },
    { label: 'IP 证书', value: 'ip' },
];

const challengeOptions = [
    { label: 'DNS 验证（推荐）', value: 'dns' },
    { label: 'HTTP Standalone（80 优先）', value: 'standalone' },
    { label: 'HTTP Webroot（80 侧）', value: 'webroot' },
    { label: 'TLS ALPN（443 兜底）', value: 'alpn' },
];

const ipChallengeOptions = [
    { label: 'HTTP Standalone（80 优先）', value: 'standalone' },
    { label: 'TLS ALPN（443 兜底）', value: 'alpn' },
];

const keyLengthOptions = [
    { label: 'EC-256', value: 'ec-256' },
    { label: 'EC-384', value: 'ec-384' },
    { label: 'RSA-2048', value: '2048' },
    { label: 'RSA-4096', value: '4096' },
    { label: 'RSA-8192', value: '8192' },
];

const certManagerIPCertificateMaxIPs = 100;
const certManagerVersionPerPage = 5;
const certManagerLoadMoreVersionValue = '__load_more_versions__';

const fallbackDnsProviders: DnsProvider[] = [
    {
        providerCode: 'dns_ali',
        name: '阿里云',
        helper: 'acme.sh 官方: dns_ali',
        fields: [
            { key: 'Ali_Key', label: 'Access Key', required: true, placeholder: 'LTAIxxxxxxxxxxxxxxxx' },
            { key: 'Ali_Secret', label: 'Secret Key', required: true, placeholder: '请输入阿里云 Secret Key' },
        ],
    },
    {
        providerCode: 'dns_tencent',
        name: '腾讯云 DNSPod',
        helper: 'acme.sh 官方: dns_tencent',
        fields: [
            { key: 'Tencent_SecretId', label: 'SecretId', required: true, placeholder: 'AKIDxxxxxxxxxxxxxxxx' },
            { key: 'Tencent_SecretKey', label: 'SecretKey', required: true, placeholder: '请输入腾讯云 SecretKey' },
        ],
    },
    {
        providerCode: 'dns_cf',
        name: 'Cloudflare',
        helper: 'acme.sh 官方: dns_cf；支持 Token 模式（CF_Token + CF_Account_ID/CF_Zone_ID）或 Global Key 模式（CF_Email + CF_Key）',
        fields: [
            { key: 'CF_Token', label: 'API Token', placeholder: 'cf_xxxxxxxxxxxxxxxxxxxx' },
            { key: 'CF_Account_ID', label: 'Account ID（可选）', placeholder: '可选，用于缩小授权范围' },
            { key: 'CF_Zone_ID', label: 'Zone ID（可选）', placeholder: '可选，用于限制具体域名' },
            { key: 'CF_Email', label: 'Global API Email（可选）', placeholder: 'legacy@example.com' },
            { key: 'CF_Key', label: 'Global API Key（可选）', placeholder: '请输入 Cloudflare Global API Key' },
        ],
    },
];

const createDnsAccountForm = (providerCode = fallbackDnsProviders[0]?.providerCode || ''): DnsAccountFormState => ({
    id: 0,
    name: '',
    providerCode,
    env: {},
    extraEnvText: '',
    remark: '',
});

const createAcmeAccountForm = (): AcmeAccountFormState => ({
    id: 0,
    name: '',
    email: '',
    server: 'letsencrypt',
    keyLength: 'ec-256',
    remark: '',
});

const createIssueForm = (): IssueFormState => ({
    certificateType: 'domain',
    domainsText: '',
    ipAddresses: [],
    challenge: 'dns',
    webroot: '',
    dnsProvider: '',
    dnsAccountId: 0,
    dnsEnvText: '',
    server: 'letsencrypt',
    keyLength: 'ec-256',
    customArgs: '',
    acmeAccountId: 0,
    autoRenew: true,
    remark: '',
    pushDir: '',
});

const mergeVersionItems = (current: VersionItem[], incoming: VersionItem[]): VersionItem[] => {
    const next = [...current];
    const seen = new Set(current.map((item) => item.version));

    incoming.forEach((item) => {
        if (seen.has(item.version)) {
            return;
        }

        seen.add(item.version);
        next.push(item);
    });

    return next;
};

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const isLikelyEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const formatTime = (timestamp: number): string => {
    if (!timestamp) {
        return '-';
    }

    const date = new Date(timestamp * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
};

const challengeLabel = (value: string): string => {
    switch (value) {
        case 'dns':
            return 'DNS 验证';
        case 'webroot':
            return 'HTTP Webroot';
        case 'alpn':
            return 'TLS ALPN';
        case 'standalone':
        default:
            return 'HTTP Standalone';
    }
};

const caLabel = (value: string): string => {
    switch ((value || '').trim().toLowerCase()) {
        case 'letsencrypt':
            return "Let's Encrypt";
        case 'zerossl':
            return 'ZeroSSL';
        default:
            return value || '-';
    }
};

const normalizeCAValue = (value: string, fallback = 'letsencrypt'): string => {
    switch ((value || '').trim().toLowerCase()) {
        case 'letsencrypt':
            return 'letsencrypt';
        case 'zerossl':
            return 'zerossl';
        default:
            return fallback;
    }
};

const issueSignatureAlgorithmText = '由 CA 决定（当前不可指定）';

const ipOptionSourceLabel = (value: string): string => {
    switch (value) {
        case 'outbound':
            return '公网出口探测';
        case 'interface':
            return '本机公网网卡';
        case 'interface_fallback':
            return '本机网卡回退';
        case 'outbound_default':
            return '公网出口兜底';
        default:
            return '自动发现';
    }
};

const arrayEquals = (left: string[], right: string[]): boolean => {
    if (left.length !== right.length) {
        return false;
    }

    return left.every((value, index) => value === right[index]);
};

const certificateManagerIPSelectStyles = {
    control: (base: any, state: any) => ({
        ...base,
        minHeight: 46,
        borderRadius: 8,
        borderColor: state.isFocused ? 'rgba(59, 130, 246, 0.48)' : 'var(--certificate-panel-border)',
        backgroundColor: 'var(--certificate-modal-inner-bg)',
        boxShadow: state.isFocused ? '0 0 0 1px rgba(59, 130, 246, 0.18)' : 'none',
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
        '&:hover': {
            borderColor: 'rgba(59, 130, 246, 0.42)',
        },
    }),
    valueContainer: (base: any) => ({
        ...base,
        gap: 6,
        padding: '6px 10px',
    }),
    placeholder: (base: any) => ({
        ...base,
        color: 'var(--certificate-muted)',
    }),
    input: (base: any) => ({
        ...base,
        color: 'var(--black)',
    }),
    menu: (base: any) => ({
        ...base,
        zIndex: 12,
        overflow: 'hidden',
        border: '1px solid var(--certificate-panel-border)',
        borderRadius: 10,
        backgroundColor: 'var(--certificate-modal-surface)',
        boxShadow: '0 18px 36px rgba(15, 23, 42, 0.2)',
    }),
    menuList: (base: any) => ({
        ...base,
        maxHeight: 240,
        paddingTop: 6,
        paddingBottom: 6,
    }),
    option: (base: any, state: any) => ({
        ...base,
        backgroundColor: state.isSelected
            ? 'rgba(37, 99, 235, 0.14)'
            : state.isFocused
                ? 'rgba(37, 99, 235, 0.08)'
                : 'transparent',
        color: 'var(--black)',
        cursor: 'pointer',
    }),
    multiValue: (base: any) => ({
        ...base,
        borderRadius: 999,
        backgroundColor: 'rgba(37, 99, 235, 0.12)',
    }),
    multiValueLabel: (base: any) => ({
        ...base,
        color: 'var(--black)',
        fontWeight: 600,
    }),
    multiValueRemove: (base: any) => ({
        ...base,
        color: 'var(--certificate-muted)',
        borderTopRightRadius: 999,
        borderBottomRightRadius: 999,
        ':hover': {
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            color: '#dc2626',
        },
    }),
    dropdownIndicator: (base: any) => ({
        ...base,
        padding: 8,
        color: 'var(--certificate-muted)',
    }),
    clearIndicator: (base: any) => ({
        ...base,
        padding: 8,
        color: 'var(--certificate-muted)',
    }),
    indicatorSeparator: () => ({
        display: 'none',
    }),
    noOptionsMessage: (base: any) => ({
        ...base,
        color: 'var(--certificate-muted)',
    }),
    loadingMessage: (base: any) => ({
        ...base,
        color: 'var(--certificate-muted)',
    }),
};

const formatExpiresText = (days: number): string => {
    if (days < 0) {
        return `已过期 ${Math.abs(days)} 天`;
    }
    if (days === 0) {
        return '今天到期';
    }

    return `剩余 ${days} 天`;
};

const envSummary = (env: Record<string, string>): string => {
    const keys = Object.keys(env);
    if (keys.length === 0) {
        return '-';
    }
    if (keys.length === 1) {
        return keys[0];
    }

    return `${keys[0]} 等 ${keys.length} 项`;
};

const parseExtraEnvText = (raw: string): { env: Record<string, string>; invalidLine: string } => {
    const env: Record<string, string> = {};
    const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    let invalidLine = '';

    lines.forEach((lineRaw) => {
        const line = lineRaw.trim();
        if (invalidLine !== '' || line === '' || line.startsWith('#')) {
            return;
        }

        const index = line.indexOf('=');
        if (index <= 0) {
            invalidLine = line;
            return;
        }

        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim();
        if (key === '' || value === '' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
            invalidLine = line;
            return;
        }

        env[key] = value;
    });

    if (invalidLine !== '') {
        return { env: {}, invalidLine };
    }

    return { env, invalidLine: '' };
};

const buildExtraEnvText = (provider: DnsProvider | null, env: Record<string, string>): string => {
    const providerKeys = new Set((provider?.fields || []).map((field) => field.key));
    const lines = Object.keys(env)
        .filter((key) => !providerKeys.has(key))
        .sort()
        .map((key) => `${key}=${env[key]}`);

    return lines.join('\n');
};

const mergeDnsEnv = (
    provider: DnsProvider | null,
    env: Record<string, string>,
    extraEnvText: string,
): { env: Record<string, string>; error: string } => {
    const merged: Record<string, string> = {};
    const parsed = parseExtraEnvText(extraEnvText);
    if (parsed.invalidLine !== '') {
        return {
            env: {},
            error: `扩展环境变量格式错误：${parsed.invalidLine}`,
        };
    }

    (provider?.fields || []).forEach((field) => {
        const value = (env[field.key] || '').trim();
        if (value !== '') {
            merged[field.key] = value;
        }
    });

    Object.keys(parsed.env).forEach((key) => {
        merged[key] = parsed.env[key];
    });

    return { env: merged, error: '' };
};

const statusClassName = (tone: string): string => {
    switch (tone) {
        case 'success':
            return 'certificate-manager__status certificate-manager__status--success';
        case 'warning':
            return 'certificate-manager__status certificate-manager__status--warning';
        case 'danger':
            return 'certificate-manager__status certificate-manager__status--danger';
        default:
            return 'certificate-manager__status certificate-manager__status--info';
    }
};

const containsKeyword = (text: string, keyword: string): boolean => text.toLowerCase().includes(keyword);

const Icon = ({ name, className = '' }: { name: string; className?: string }) => (
    <svg className={`certificate-manager__svg ${className}`} aria-hidden="true">
        <use xlinkHref={`#${name}`} />
    </svg>
);

const CertificateManager = () => {
    const dispatch = useDispatch();

    const [loading, setLoading] = useState(true);
    const [busyKey, setBusyKey] = useState('');
    const [overview, setOverview] = useState<Overview | null>(null);
    const [versions, setVersions] = useState<VersionItem[]>([]);
    const [versionsLoaded, setVersionsLoaded] = useState(false);
    const [versionsLoading, setVersionsLoading] = useState(false);
    const [versionsLoadingMore, setVersionsLoadingMore] = useState(false);
    const [versionPage, setVersionPage] = useState(0);
    const [versionHasMore, setVersionHasMore] = useState(false);
    const [selectedInstallVersion, setSelectedInstallVersion] = useState('');
    const [runtimeEmail, setRuntimeEmail] = useState('');
    const [search, setSearch] = useState('');
    const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

    const [issueVisible, setIssueVisible] = useState(false);
    const [issueForm, setIssueForm] = useState<IssueFormState>(createIssueForm);
    const [issueError, setIssueError] = useState('');
    const [issueIPOptions, setIssueIPOptions] = useState<CertificateManagerIPOption[]>([]);
    const [issueIPOptionsLoading, setIssueIPOptionsLoading] = useState(false);
    const [issueIPOptionsLoaded, setIssueIPOptionsLoaded] = useState(false);

    const [acmeDialogVisible, setAcmeDialogVisible] = useState(false);
    const [acmeFormVisible, setAcmeFormVisible] = useState(false);
    const [acmeSearch, setAcmeSearch] = useState('');
    const [acmeForm, setAcmeForm] = useState<AcmeAccountFormState>(createAcmeAccountForm);
    const [acmeError, setAcmeError] = useState('');

    const [dnsDialogVisible, setDnsDialogVisible] = useState(false);
    const [dnsFormVisible, setDnsFormVisible] = useState(false);
    const [dnsSearch, setDnsSearch] = useState('');
    const [dnsForm, setDnsForm] = useState<DnsAccountFormState>(createDnsAccountForm);
    const [dnsError, setDnsError] = useState('');

    const [materialVisible, setMaterialVisible] = useState(false);
    const [materialLoading, setMaterialLoading] = useState(false);
    const [material, setMaterial] = useState<CertificateMaterial | null>(null);

    const [pushVisible, setPushVisible] = useState(false);
    const [pushTargetDir, setPushTargetDir] = useState('');
    const [pushCertificateId, setPushCertificateId] = useState(0);

    const dnsProviders = overview?.dnsProviders?.length ? overview.dnsProviders : fallbackDnsProviders;
    const selectedDnsProvider = useMemo(
        () => dnsProviders.find((item) => item.providerCode === dnsForm.providerCode) || dnsProviders[0] || null,
        [dnsForm.providerCode, dnsProviders],
    );
    const selectedIssueDnsProvider = useMemo(
        () => dnsProviders.find((item) => item.providerCode === issueForm.dnsProvider) || null,
        [dnsProviders, issueForm.dnsProvider],
    );
    const issueCAOptions = useMemo(() => {
        const options = overview?.caOptions || [];
        if (issueForm.certificateType !== 'ip') {
            return options;
        }

        const letsencryptOption = options.find((item) => normalizeCAValue(item.value) === 'letsencrypt');
        if (letsencryptOption) {
            return [letsencryptOption];
        }

        return [{ name: "Let's Encrypt", value: 'letsencrypt' }];
    }, [issueForm.certificateType, overview]);
    const availableIssueAcmeAccounts = useMemo(() => {
        if (issueForm.certificateType === 'ip') {
            return [];
        }

        const selectedServer = normalizeCAValue(issueForm.server || overview?.preferredCA || 'letsencrypt');

        return (overview?.acmeAccounts || []).filter((item) => {
            return normalizeCAValue(item.server, selectedServer) === selectedServer;
        });
    }, [issueForm.certificateType, issueForm.server, overview]);

    const filteredCertificates = useMemo(() => {
        const source = overview?.certificates || [];
        const keyword = search.trim().toLowerCase();
        if (keyword === '') {
            return source;
        }

        return source.filter((item) => containsKeyword([
            item.mainDomain,
            item.domains.join(' '),
            item.acmeAccountName,
            item.dnsAccountName,
            item.remark,
            item.fingerprint,
        ].join(' '), keyword));
    }, [overview, search]);

    const filteredAcmeAccounts = useMemo(() => {
        const source = overview?.acmeAccounts || [];
        const keyword = acmeSearch.trim().toLowerCase();
        if (keyword === '') {
            return source;
        }

        return source.filter((item) => containsKeyword([
            item.name,
            item.email,
            item.server,
            item.remark,
        ].join(' '), keyword));
    }, [overview, acmeSearch]);

    const filteredDnsAccounts = useMemo(() => {
        const source = overview?.dnsAccounts || [];
        const keyword = dnsSearch.trim().toLowerCase();
        if (keyword === '') {
            return source;
        }

        return source.filter((item) => containsKeyword([
            item.name,
            item.providerName,
            item.providerCode,
            item.remark,
            envSummary(item.env),
        ].join(' '), keyword));
    }, [overview, dnsSearch]);
    const installVersionOptions = useMemo(() => {
        const items = [...versions];
        const hasSelected = selectedInstallVersion !== ''
            && items.some((item) => item.version === selectedInstallVersion);

        if (!hasSelected && selectedInstallVersion !== '') {
            items.unshift({
                version: selectedInstallVersion,
                displayName: `v${selectedInstallVersion}`,
                publishedAt: 0,
            });
        }

        if (versionHasMore) {
            items.push({
                version: certManagerLoadMoreVersionValue,
                displayName: versionsLoadingMore ? '正在加载更多版本...' : '加载更多版本...',
                publishedAt: 0,
            });
        }

        return items;
    }, [selectedInstallVersion, versionHasMore, versions, versionsLoadingMore]);

    const dnsMergedEnv = useMemo(
        () => mergeDnsEnv(selectedDnsProvider, dnsForm.env, dnsForm.extraEnvText),
        [dnsForm.env, dnsForm.extraEnvText, selectedDnsProvider],
    );

    const issueMergedEnv = useMemo(
        () => parseExtraEnvText(issueForm.dnsEnvText),
        [issueForm.dnsEnvText],
    );
    const issueIPSelectOptions = useMemo(
        (): CertificateManagerIPSelectOption[] => buildCertificateManagerIPSelectOptions(issueIPOptions, issueForm.ipAddresses),
        [issueForm.ipAddresses, issueIPOptions],
    );
    const issueIPSelectedOptions = useMemo(
        (): CertificateManagerIPSelectOption[] => normalizeCertificateManagerIPList(
            issueForm.ipAddresses,
            certManagerIPCertificateMaxIPs,
        ).map((value) => ({ label: value, value })),
        [issueForm.ipAddresses],
    );
    const issueIPOptionMap = useMemo(
        () => new Map(issueIPOptions.map((item) => [item.value, item])),
        [issueIPOptions],
    );
    const issueDialogNotice = useMemo(() => {
        if (!overview?.supported) {
            return {
                title: '当前环境仅支持预览',
                text: '当前平台暂未接入真实 ACME 运行能力，本窗口可先整理申请参数，但暂时不能直接发起证书申请。',
            };
        }

        if (!overview?.installed) {
            return {
                title: '提交前还差一步',
                text: '检测到 acme.sh 尚未安装。你可以先填写证书参数，真正提交前需要先在上方“acme.sh 运行时”区域完成下载安装。',
            };
        }

        if (!overview?.managedInstalled) {
            return {
                title: '已检测到本地 acme.sh',
                text: '当前会复用系统里已有的 acme.sh 脚本执行证书流程，同时继续把工作目录与证书库存保存在本项目数据目录中；若想完全切换为当前项目受管运行时，可先点击上方“下载安装 / 接管”。',
            };
        }

        return null;
    }, [overview?.installed, overview?.managedInstalled, overview?.supported]);
    const issueSubmitDisabled = busyKey !== '' || !overview?.supported || !overview?.installed;
    let issueSubmitLabel = '申请证书';
    if (!overview?.supported) {
        issueSubmitLabel = '当前环境不支持申请';
    } else if (!overview?.installed) {
        issueSubmitLabel = '请先安装 acme.sh';
    }

    const loadIssueIPOptions = async (force = false) => {
        if (issueIPOptionsLoading || (!force && issueIPOptionsLoaded)) {
            return;
        }

        setIssueIPOptionsLoading(true);
        try {
            const result = await apiClient.getCertificateManagerIPOptions();
            const nextOptions = normalizeCertificateManagerIPOptions(result);

            setIssueIPOptions(nextOptions);
            setIssueIPOptionsLoaded(true);
            setIssueForm((current) => {
                if (current.certificateType !== 'ip' || current.ipAddresses.length > 0 || nextOptions.length === 0) {
                    return current;
                }

                return {
                    ...current,
                    ipAddresses: [nextOptions[0].value],
                };
            });
        } catch (error) {
            dispatch(addErrorToast({ error }));
        } finally {
            setIssueIPOptionsLoading(false);
        }
    };

    const updateIssueIPAddresses = (raw: unknown) => {
        const normalized = normalizeCertificateManagerIPList(raw, certManagerIPCertificateMaxIPs + 1);
        const nextValues = normalized.slice(0, certManagerIPCertificateMaxIPs);

        setIssueForm((current) => {
            if (arrayEquals(current.ipAddresses, nextValues)) {
                return current;
            }

            return {
                ...current,
                ipAddresses: nextValues,
            };
        });

        if (normalized.length > certManagerIPCertificateMaxIPs) {
            setIssueError(`IP 证书最多可选择 ${certManagerIPCertificateMaxIPs} 个 IP。`);
        } else if (issueError.startsWith('IP 证书最多可选择')) {
            setIssueError('');
        }
    };

    const loadOverview = async (showBusy = false) => {
        if (showBusy) {
            setBusyKey('refresh');
        }

        try {
            const data = await apiClient.getCertificateManagerOverview();
            setOverview(data);
            setRuntimeEmail(data.contactEmail || '');
            if (!selectedInstallVersion && data.version) {
                setSelectedInstallVersion(data.version);
            }
        } catch (error) {
            dispatch(addErrorToast({ error }));
        } finally {
            setLoading(false);
            if (showBusy) {
                setBusyKey('');
            }
        }
    };

    const loadVersions = async (page = 1, append = false) => {
        if (append) {
            if (versionsLoadingMore || versionsLoading || !versionHasMore || page <= versionPage) {
                return;
            }
            setVersionsLoadingMore(true);
        } else {
            if (versionsLoading || versionsLoaded) {
                return;
            }
            setVersionsLoading(true);
        }

        try {
            const result = await apiClient.getCertificateManagerVersions({
                page,
                per_page: certManagerVersionPerPage,
            }) as VersionListResult;
            const items = result?.items || [];
            setVersions((current) => (append ? mergeVersionItems(current, items) : items));
            setVersionsLoaded(true);
            setVersionPage(result?.page || page);
            setVersionHasMore(Boolean(result?.hasMore));

            if (!selectedInstallVersion && items.length > 0) {
                setSelectedInstallVersion(items[0].version);
            }
        } catch (error) {
            dispatch(addErrorToast({ error }));
        } finally {
            if (append) {
                setVersionsLoadingMore(false);
            } else {
                setVersionsLoading(false);
            }
        }
    };

    const ensureVersionsLoaded = async () => {
        if (versionsLoaded || versionsLoading || versionsLoadingMore) {
            return;
        }

        await loadVersions(1, false);
    };

    const handleInstallVersionChange = async (value: string) => {
        if (value === certManagerLoadMoreVersionValue) {
            await loadVersions(versionPage + 1, true);

            return;
        }

        setSelectedInstallVersion(value);
    };

    useEffect(() => {
        loadOverview();
    }, []);

    useEffect(() => {
        if (issueVisible && overview) {
            setIssueForm((current) => ({
                ...current,
                server: current.server || overview.preferredCA || 'letsencrypt',
                keyLength: current.keyLength || overview.defaultKeyLength || 'ec-256',
                challenge: current.challenge || overview.defaultChallenge || 'dns',
                webroot: current.webroot || overview.defaultWebroot || '',
                dnsProvider: current.dnsProvider || overview.defaultDnsProvider || '',
            }));
        }
    }, [issueVisible, overview]);

    useEffect(() => {
        if (!issueVisible || issueForm.certificateType !== 'ip') {
            return;
        }

        loadIssueIPOptions();
    }, [issueForm.certificateType, issueVisible]);

    useEffect(() => {
        if (issueForm.certificateType !== 'ip' || issueForm.challenge === 'standalone' || issueForm.challenge === 'alpn') {
            return;
        }

        setIssueForm((current) => {
            if (current.certificateType !== 'ip') {
                return current;
            }
            if (current.challenge === 'standalone' || current.challenge === 'alpn') {
                return current;
            }

            return {
                ...current,
                challenge: 'standalone',
            };
        });
    }, [issueForm.certificateType, issueForm.challenge]);

    useEffect(() => {
        if (issueForm.certificateType !== 'ip' || normalizeCAValue(issueForm.server) === 'letsencrypt') {
            return;
        }

        setIssueForm((current) => {
            if (current.certificateType !== 'ip' || normalizeCAValue(current.server) === 'letsencrypt') {
                return current;
            }

            return {
                ...current,
                server: 'letsencrypt',
            };
        });
    }, [issueForm.certificateType, issueForm.server]);

    useEffect(() => {
        if (issueForm.certificateType === 'ip') {
            if (issueForm.acmeAccountId === 0) {
                return;
            }

            setIssueForm((current) => {
                if (current.certificateType !== 'ip' || current.acmeAccountId === 0) {
                    return current;
                }

                return {
                    ...current,
                    acmeAccountId: 0,
                };
            });

            return;
        }

        if (issueForm.acmeAccountId === 0) {
            return;
        }
        if (availableIssueAcmeAccounts.some((item) => item.id === issueForm.acmeAccountId)) {
            return;
        }

        setIssueForm((current) => {
            if (current.acmeAccountId === 0) {
                return current;
            }

            return {
                ...current,
                acmeAccountId: 0,
            };
        });
    }, [availableIssueAcmeAccounts, issueForm.acmeAccountId, issueForm.certificateType]);

    useEffect(() => {
        if (issueForm.certificateType === 'ip' || issueForm.acmeAccountId <= 0) {
            return;
        }

        const account = availableIssueAcmeAccounts.find((item) => item.id === issueForm.acmeAccountId);
        if (!account) {
            return;
        }

        setIssueForm((current) => {
            if (current.certificateType === 'ip' || current.acmeAccountId !== account.id) {
                return current;
            }

            const nextServer = account.server || current.server;
            const nextKeyLength = account.keyLength || current.keyLength;
            if (current.server === nextServer && current.keyLength === nextKeyLength) {
                return current;
            }

            return {
                ...current,
                server: nextServer,
                keyLength: nextKeyLength,
            };
        });
    }, [availableIssueAcmeAccounts, issueForm.acmeAccountId, issueForm.certificateType]);

    useEffect(() => {
        if (issueForm.challenge !== 'dns' || issueForm.dnsAccountId <= 0) {
            return;
        }

        const account = (overview?.dnsAccounts || []).find((item) => item.id === issueForm.dnsAccountId);
        if (!account || account.providerCode === issueForm.dnsProvider) {
            return;
        }

        setIssueForm((current) => {
            if (current.challenge !== 'dns' || current.dnsAccountId !== account.id) {
                return current;
            }

            return {
                ...current,
                dnsProvider: account.providerCode,
            };
        });
    }, [issueForm.challenge, issueForm.dnsAccountId, issueForm.dnsProvider, overview]);

    useEffect(() => {
        const closeMenu = () => setActiveMenuId(null);
        if (activeMenuId !== null) {
            document.addEventListener('click', closeMenu);
        }

        return () => document.removeEventListener('click', closeMenu);
    }, [activeMenuId]);

    const runAction = async (
        key: string,
        action: () => Promise<any>,
        options: { refresh?: boolean; successMessage?: string } = {},
    ) => {
        setBusyKey(key);
        try {
            const result = await action();
            dispatch(addSuccessToast(result?.message || options.successMessage || '操作成功'));

            if (options.refresh !== false) {
                await loadOverview();
            }

            return result;
        } catch (error) {
            dispatch(addErrorToast({ error }));
            return null;
        } finally {
            setBusyKey('');
        }
    };

    const saveRuntimeEmail = async () => {
        const normalized = normalizeEmail(runtimeEmail);
        const current = normalizeEmail(overview?.contactEmail || '');

        if (normalized === current) {
            return;
        }
        if (normalized !== '' && !isLikelyEmail(normalized)) {
            dispatch(addErrorToast({ error: '联系邮箱格式不正确' }));
            setRuntimeEmail(current);
            return;
        }

        await runAction('save-email', () => apiClient.saveCertificateManagerContactEmail({ email: normalized }), {
            successMessage: '联系邮箱已保存',
        });
    };

    const installAcme = async () => {
        await runAction('install-acme', () => apiClient.installCertificateManagerAcme({
            email: normalizeEmail(runtimeEmail),
            version: selectedInstallVersion,
        }));
    };

    const checkUpdate = async () => {
        await runAction('check-update', () => apiClient.getCertificateManagerUpdateInfo() as Promise<VersionCheckResult>, {
            refresh: true,
        });
    };

    const removeAcme = async () => {
        if (!overview?.supported) {
            return;
        }
        if (!window.confirm('确认删除 acme.sh 运行时？')) {
            return;
        }

        const removeCertificates = window.confirm('如需同时删除证书库存，请点击“确定”；点击“取消”则只删除 acme.sh 运行时。');
        await runAction('remove-acme', () => apiClient.removeCertificateManagerAcme({ removeCertificates }));
    };

    const openIssueDialog = () => {
        if (!overview) {
            return;
        }

        const defaultChallenge = overview.defaultChallenge || 'dns';

        setIssueError('');
        setIssueIPOptionsLoaded(false);
        setIssueForm({
            certificateType: 'domain',
            domainsText: '',
            ipAddresses: [],
            challenge: defaultChallenge === 'alpn' ? 'alpn' : defaultChallenge,
            webroot: overview.defaultWebroot || '',
            dnsProvider: overview.defaultDnsProvider || overview.dnsProviders?.[0]?.providerCode || '',
            dnsAccountId: 0,
            dnsEnvText: '',
            server: overview.preferredCA || 'letsencrypt',
            keyLength: overview.defaultKeyLength || 'ec-256',
            customArgs: '',
            acmeAccountId: 0,
            autoRenew: true,
            remark: '',
            pushDir: '',
        });
        setIssueVisible(true);
    };

    const submitIssue = async () => {
        const issueIPs = normalizeCertificateManagerIPList(issueForm.ipAddresses, certManagerIPCertificateMaxIPs + 1);
        const issueDomains = issueForm.domainsText.trim();

        if (issueForm.certificateType === 'ip' && issueIPs.length === 0) {
            setIssueError('请至少选择或输入一个 IP。');
            return;
        }
        if (issueForm.certificateType === 'ip' && issueIPs.length > certManagerIPCertificateMaxIPs) {
            setIssueError(`IP 证书最多可选择 ${certManagerIPCertificateMaxIPs} 个 IP。`);
            return;
        }
        if (issueForm.certificateType === 'domain' && issueDomains === '') {
            setIssueError('请填写要申请的域名列表。');
            return;
        }
        if (issueForm.certificateType === 'domain' && issueForm.acmeAccountId === 0) {
            setIssueError('域名证书请先选择 ACME 账号。');
            return;
        }
        if (issueForm.challenge === 'webroot' && issueForm.webroot.trim() === '') {
            setIssueError('HTTP Webroot 验证必须填写站点目录。');
            return;
        }
        if (issueForm.challenge === 'dns' && issueForm.dnsProvider.trim() === '') {
            setIssueError('DNS 验证必须选择 DNS Provider。');
            return;
        }
        if (issueForm.challenge === 'dns' && issueMergedEnv.invalidLine !== '') {
            setIssueError(`DNS 扩展环境变量格式错误：${issueMergedEnv.invalidLine}`);
            return;
        }

        setIssueError('');
        const result = await runAction('issue-certificate', () => apiClient.issueCertificateManagerCertificate({
            domains: issueForm.certificateType === 'ip'
                ? serializeCertificateManagerIPList(issueIPs.slice(0, certManagerIPCertificateMaxIPs))
                : issueDomains,
            certificateType: issueForm.certificateType,
            challenge: issueForm.challenge,
            webroot: issueForm.challenge === 'webroot' ? issueForm.webroot : '',
            dnsProvider: issueForm.challenge === 'dns' ? issueForm.dnsProvider : '',
            dnsEnv: issueForm.challenge === 'dns' ? issueForm.dnsEnvText : '',
            server: issueForm.certificateType === 'ip' ? 'letsencrypt' : issueForm.server,
            keyLength: issueForm.keyLength,
            customArgs: issueForm.customArgs,
            acmeAccountId: issueForm.certificateType === 'domain' ? issueForm.acmeAccountId : 0,
            dnsAccountId: issueForm.challenge === 'dns' ? issueForm.dnsAccountId : 0,
            autoRenew: issueForm.autoRenew,
            remark: issueForm.remark,
            pushDir: issueForm.pushDir,
        }));

        if (result) {
            setIssueVisible(false);
        }
    };

    const openAcmeDialog = () => {
        setAcmeSearch('');
        setAcmeDialogVisible(true);
    };

    const openDnsDialog = () => {
        setDnsSearch('');
        setDnsDialogVisible(true);
    };

    const openAcmeForm = (account?: AcmeAccount) => {
        setAcmeError('');
        if (account) {
            setAcmeForm({
                id: account.id,
                name: account.name,
                email: account.email,
                server: account.server,
                keyLength: account.keyLength,
                remark: account.remark,
            });
        } else {
            setAcmeForm({
                ...createAcmeAccountForm(),
                server: overview?.preferredCA || 'letsencrypt',
                keyLength: overview?.defaultKeyLength || 'ec-256',
            });
        }
        setAcmeFormVisible(true);
    };

    const saveAcmeAccount = async () => {
        if (!isLikelyEmail(acmeForm.email)) {
            setAcmeError('请填写有效的 ACME 邮箱。');
            return;
        }

        setAcmeError('');
        const result = await runAction('save-acme-account', () => apiClient.saveCertificateManagerAcmeAccount({
            id: acmeForm.id,
            name: acmeForm.name,
            email: acmeForm.email,
            server: acmeForm.server,
            keyLength: acmeForm.keyLength,
            remark: acmeForm.remark,
        }));

        if (result) {
            setAcmeFormVisible(false);
            setAcmeDialogVisible(true);
        }
    };

    const deleteAcmeAccount = async (account: AcmeAccount) => {
        if (!window.confirm(`确认删除 ACME 账号“${account.name}”？`)) {
            return;
        }

        await runAction('delete-acme-account', () => apiClient.deleteCertificateManagerAcmeAccount({ id: account.id }));
    };

    const openDnsForm = (account?: DnsAccount, providerCode?: string) => {
        const provider = dnsProviders.find((item) => item.providerCode === (providerCode || account?.providerCode)) || dnsProviders[0] || null;

        setDnsError('');
        if (account) {
            setDnsForm({
                id: account.id,
                name: account.name,
                providerCode: account.providerCode,
                env: { ...account.env },
                extraEnvText: buildExtraEnvText(provider, account.env),
                remark: account.remark,
            });
        } else {
            setDnsForm(createDnsAccountForm(provider?.providerCode || dnsProviders[0]?.providerCode || ''));
        }
        setDnsFormVisible(true);
    };

    const saveDnsAccount = async () => {
        if (dnsMergedEnv.error !== '') {
            setDnsError(dnsMergedEnv.error);
            return;
        }

        setDnsError('');
        const result = await runAction('save-dns-account', () => apiClient.saveCertificateManagerDnsAccount({
            id: dnsForm.id,
            name: dnsForm.name,
            providerCode: dnsForm.providerCode,
            env: dnsMergedEnv.env,
            remark: dnsForm.remark,
        }));

        if (result) {
            setDnsFormVisible(false);
            setDnsDialogVisible(true);
        }
    };

    const deleteDnsAccount = async (account: DnsAccount) => {
        if (!window.confirm(`确认删除 DNS 账号“${account.name}”？`)) {
            return;
        }

        await runAction('delete-dns-account', () => apiClient.deleteCertificateManagerDnsAccount({ id: account.id }));
    };

    const viewCertificate = async (certificateId: number) => {
        setMaterialLoading(true);
        setMaterialVisible(true);
        setMaterial(null);
        setActiveMenuId(null);

        try {
            const result = await apiClient.getCertificateManagerMaterial({ id: certificateId });
            setMaterial(result);
        } catch (error) {
            dispatch(addErrorToast({ error }));
            setMaterialVisible(false);
        } finally {
            setMaterialLoading(false);
        }
    };

    const renewCertificate = async (certificateId: number, force: boolean) => {
        setActiveMenuId(null);
        await runAction(force ? 'force-renew' : 'renew', () => apiClient.renewCertificateManagerCertificate({
            id: certificateId,
            force,
        }));
    };

    const toggleAutoRenew = async (record: CertificateRecord) => {
        setActiveMenuId(null);
        await runAction('toggle-auto-renew', () => apiClient.setCertificateManagerAutoRenew({
            id: record.id,
            autoRenew: !record.autoRenew,
        }));
    };

    const openPushDialog = (record: CertificateRecord) => {
        setPushCertificateId(record.id);
        setPushTargetDir(record.pushDir || '');
        setPushVisible(true);
        setActiveMenuId(null);
    };

    const submitPush = async () => {
        if (pushCertificateId === 0 || pushTargetDir.trim() === '') {
            dispatch(addErrorToast({ error: '请输入推送目录。' }));
            return;
        }

        const result = await runAction('push-certificate', () => apiClient.pushCertificateManagerCertificate({
            id: pushCertificateId,
            targetDir: pushTargetDir,
        }));

        if (result) {
            setPushVisible(false);
        }
    };

    const deleteCertificate = async (record: CertificateRecord) => {
        if (!window.confirm(`确认删除证书“${record.mainDomain}”？`)) {
            return;
        }

        setActiveMenuId(null);
        await runAction('delete-certificate', () => apiClient.deleteCertificateManagerCertificate({ id: record.id }));
    };

    const applyCertificateToTarget = async (record: CertificateRecord, target: 'panel' | 'dns') => {
        setActiveMenuId(null);
        await runAction(`apply-certificate-${target}`, () => apiClient.applyCertificateManagerCertificate({
            id: record.id,
            target,
        }), {
            successMessage: target === 'panel' ? '证书已应用到面板。' : '证书已应用到 DNS 加密。',
        });
    };

    const unapplyCertificateFromTarget = async (record: CertificateRecord, target: 'panel' | 'dns') => {
        setActiveMenuId(null);
        await runAction(`unapply-certificate-${target}`, () => apiClient.unapplyCertificateManagerCertificate({
            id: record.id,
            target,
        }), {
            successMessage: target === 'panel' ? '已取消应用到面板。' : '已取消应用到 DNS 加密。',
        });
    };

    if (loading) {
        return (
            <div className="settings">
                <PageTitle title="证书管理" subtitle="正在加载 ACME 与证书库存..." />
            </div>
        );
    }

    const runtimeStatusLabel = overview?.managedInstalled
        ? '受管 acme.sh 已安装'
        : overview?.installed
            ? '已检测本地 acme.sh'
            : 'acme.sh 未安装';
    const runtimeSourceLabel = overview?.managedInstalled
        ? '当前项目受管运行时'
        : overview?.installed
            ? '本地脚本 + 当前项目工作目录'
            : '尚未接入运行时';
    const installButtonLabel = overview?.managedInstalled
        ? '下载 / 重装'
        : overview?.installed
            ? '下载安装 / 接管'
            : '下载安装';

    const metrics = [
        {
            label: '证书数',
            value: overview?.certificates?.length || 0,
            hint: '默认证书内容会保存在本地证书数据库与托管目录中，便于后续查看与推送。',
        },
        {
            label: 'ACME 账号',
            value: overview?.acmeAccounts?.length || 0,
            hint: overview?.acmeAccounts?.length ? '已配置，可直接在申请时复用。' : '按需创建',
        },
        {
            label: 'DNS 账号',
            value: overview?.dnsAccounts?.length || 0,
            hint: overview?.dnsAccounts?.length ? '统一托管常见 DNS Provider 凭据。' : '统一托管',
        },
        {
            label: '自动续签窗口',
            value: '>40天:30天',
            hint: '<=40 天按证书有效期的 1/3 触发，最少 1 天。',
        },
    ];

    let materialBody: React.ReactNode = null;
    if (materialLoading) {
        materialBody = (
            <div className="certificate-manager__empty-state">
                <div className="certificate-manager__empty-title">正在加载证书内容...</div>
            </div>
        );
    } else if (material) {
        materialBody = (
            <>
                <div className="certificate-manager__form-section">
                    <div className="certificate-manager__runtime-rows">
                        <div className="certificate-manager__runtime-row">
                            <span>托管目录</span>
                            <strong className="certificate-manager__code">{material.fullchainPath || '-'}</strong>
                        </div>
                        <div className="certificate-manager__runtime-row">
                            <span>证书指纹</span>
                            <strong className="certificate-manager__code">{material.fingerprint || '-'}</strong>
                        </div>
                        <div className="certificate-manager__runtime-row">
                            <span>密钥算法</span>
                            <strong>{material.issuedKeyAlgorithm || '-'}</strong>
                        </div>
                        <div className="certificate-manager__runtime-row">
                            <span>签名算法</span>
                            <strong>{material.issuedSignatureAlgorithm || '-'}</strong>
                        </div>
                    </div>
                </div>

                <div className="certificate-manager__form-section">
                    <label className="certificate-manager__field certificate-manager__field--full">
                        <span className="certificate-manager__field-label">Fullchain PEM</span>
                        <textarea
                            className="form-control certificate-manager__textarea certificate-manager__textarea--material"
                            value={material.fullchainPem}
                            readOnly
                            rows={10}
                        />
                    </label>
                </div>

                <div className="certificate-manager__form-section">
                    <label className="certificate-manager__field certificate-manager__field--full">
                        <span className="certificate-manager__field-label">Private Key PEM</span>
                        <textarea
                            className="form-control certificate-manager__textarea certificate-manager__textarea--material"
                            value={material.keyPem}
                            readOnly
                            rows={10}
                        />
                    </label>
                </div>
            </>
        );
    }

    return (
        <div className="settings certificate-manager">
            <PageTitle title="证书管理" subtitle="基于 acme.sh 的证书管理中心，支持账号、DNS Provider 与证书库存统一管理。" />

            <div className="content">
                <div className="certificate-manager__hero">
                    <div className="certificate-manager__hero-grid" />
                    <div className="certificate-manager__hero-content">
                        <div className="certificate-manager__hero-top">
                            <div className="certificate-manager__hero-heading">
                                <div className="certificate-manager__hero-icon">
                                    <Icon name="lock" />
                                </div>

                                <div>
                                    <div className="certificate-manager__eyebrow">ACME CERTIFICATE CENTER</div>
                                    <h2 className="certificate-manager__title">证书管理中心</h2>
                                    <p className="certificate-manager__description">
                                        参照原项目的 ACME 管理设计，已接入当前项目的工作目录、数据目录与证书库存逻辑。
                                    </p>
                                </div>
                            </div>

                            <div className="certificate-manager__toolbar">
                                <button
                                    type="button"
                                    className="certificate-manager__hero-button certificate-manager__hero-button--secondary certificate-manager__hero-button--interactive"
                                    disabled={busyKey !== '' || !overview}
                                    onClick={openIssueDialog}>
                                    <Icon name="plus" />
                                    申请证书
                                </button>

                                <button
                                    type="button"
                                    className="certificate-manager__hero-button certificate-manager__hero-button--secondary certificate-manager__hero-button--interactive"
                                    onClick={openAcmeDialog}>
                                    <Icon name="settings" />
                                    ACME 账号
                                </button>

                                <button
                                    type="button"
                                    className="certificate-manager__hero-button certificate-manager__hero-button--secondary certificate-manager__hero-button--interactive"
                                    onClick={openDnsDialog}>
                                    <Icon name="network" />
                                    DNS 账号
                                </button>
                            </div>
                        </div>

                        <div className="certificate-manager__chips">
                            <span className={`certificate-manager__chip ${overview?.supported ? 'certificate-manager__chip--info' : 'certificate-manager__chip--preview'}`}>
                                {overview?.supported ? '当前系统支持 ACME' : '当前系统仅支持 UI 预览'}
                            </span>
                            <span className={`certificate-manager__chip ${overview?.installed ? 'certificate-manager__chip--success' : 'certificate-manager__chip--primary'}`}>
                                {runtimeStatusLabel}
                            </span>
                            <span className="certificate-manager__chip certificate-manager__chip--primary">
                                版本: {overview?.version ? `v${overview.version}` : '-'}
                            </span>
                            <span className="certificate-manager__chip certificate-manager__chip--teal">
                                默认 CA: {caLabel(overview?.preferredCA || '')}
                            </span>
                            <span className="certificate-manager__chip certificate-manager__chip--preview">
                                运行时: {runtimeSourceLabel}
                            </span>
                            <span className="certificate-manager__chip certificate-manager__chip--preview">
                                UI 已接入真实后端
                            </span>
                        </div>

                        <div className="certificate-manager__metrics">
                            {metrics.map((item) => (
                                <div key={item.label} className="certificate-manager__metric">
                                    <div className="certificate-manager__metric-label">{item.label}</div>
                                    <div className="certificate-manager__metric-value">{item.value}</div>
                                    <div className="certificate-manager__metric-hint">{item.hint}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="certificate-manager__panel certificate-manager__runtime">
                    <div className="certificate-manager__panel-title">acme.sh 运行时</div>
                    <div className="certificate-manager__panel-body">
                        <div className="certificate-manager__control">
                            <input
                                className="form-control"
                                value={runtimeEmail}
                                placeholder="联系邮箱（可选）"
                                onChange={(event) => setRuntimeEmail(event.target.value)}
                                onBlur={saveRuntimeEmail}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        saveRuntimeEmail();
                                    }
                                }}
                            />
                        </div>

                        <div className="certificate-manager__runtime-actions">
                            <div className="certificate-manager__select">
                                <select
                                    className="form-control custom-select"
                                    value={selectedInstallVersion}
                                    onFocus={() => {
                                        void ensureVersionsLoaded();
                                    }}
                                    onChange={(event) => {
                                        void handleInstallVersionChange(event.target.value);
                                    }}>
                                    <option value="">
                                        {versionsLoading ? '正在加载版本...' : versionsLoaded ? '安装版本' : '安装版本（聚焦时懒加载）'}
                                    </option>
                                    {installVersionOptions.map((item) => (
                                        <option key={item.version} value={item.version}>
                                            {item.displayName}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="certificate-manager__runtime-buttons">
                                <button
                                    type="button"
                                    className="btn btn-primary certificate-manager__runtime-button"
                                    disabled={busyKey !== '' || !overview?.supported}
                                    onClick={installAcme}>
                                    <Icon name="update" />
                                    {installButtonLabel}
                                </button>

                                <button
                                    type="button"
                                    className="btn btn-outline-primary certificate-manager__runtime-button certificate-manager__runtime-button--check"
                                    disabled={busyKey !== '' || !overview?.supported}
                                    onClick={checkUpdate}>
                                    <Icon name="update" />
                                    检测更新
                                </button>

                                <button
                                    type="button"
                                    className="btn btn-outline-danger certificate-manager__runtime-button certificate-manager__runtime-button--danger"
                                    disabled={busyKey !== '' || !overview?.supported || !overview?.managedInstalled}
                                    onClick={removeAcme}>
                                    <Icon name="delete" />
                                    删除 ACME.SH
                                </button>
                            </div>
                        </div>

                        <div className="certificate-manager__runtime-rows">
                            <div className="certificate-manager__runtime-row">
                                <span>当前版本</span>
                                <strong>{overview?.version ? `v${overview.version}` : '-'}</strong>
                            </div>
                            <div className="certificate-manager__runtime-row">
                                <span>脚本路径</span>
                                <strong className="certificate-manager__code">{overview?.scriptPath || '-'}</strong>
                            </div>
                            <div className="certificate-manager__runtime-row">
                                <span>工作目录</span>
                                <strong className="certificate-manager__code">{overview?.homeDir || '-'}</strong>
                            </div>
                            <div className="certificate-manager__runtime-row">
                                <span>运行时来源</span>
                                <strong>{runtimeSourceLabel}</strong>
                            </div>
                            <div className="certificate-manager__runtime-row">
                                <span>默认验证方式</span>
                                <strong>{challengeLabel(overview?.defaultChallenge || 'standalone')}</strong>
                            </div>
                            <div className="certificate-manager__runtime-row">
                                <span>更新状态</span>
                                <strong>{overview?.updateStatus || '未检测更新'}</strong>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="certificate-manager__panel certificate-manager__table-card">
                    <div className="certificate-manager__table-toolbar">
                        <div>
                            <div className="certificate-manager__panel-title certificate-manager__panel-title--inline">证书列表</div>
                            <div className="certificate-manager__subtitle">
                                默认证书内容保存在 `data/cert/{'{数据库文件}'}` 与托管目录中，同时可以按证书 ID 应用到面板或 DNS 加密。
                            </div>
                        </div>

                        <div className="certificate-manager__search-wrap">
                            <div className="certificate-manager__search">
                                <Icon name="magnifier" />
                                <input
                                    className="form-control certificate-manager__search-control"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="搜索域名 / 账号 / 备注"
                                />
                            </div>
                            <span className="certificate-manager__count">证书数量 {filteredCertificates.length}</span>
                        </div>
                    </div>

                    <div className="certificate-manager__table-wrap">
                        <table className="table table-hover table-vcenter certificate-manager__table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>主域名</th>
                                    <th>申请方式</th>
                                    <th>CA 平台</th>
                                    <th>账号</th>
                                    <th>状态</th>
                                    <th>到期时间</th>
                                    <th>自动续签</th>
                                    <th>备注</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCertificates.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="text-center certificate-manager__muted">
                                            暂无证书记录
                                        </td>
                                    </tr>
                                ) : (
                                    filteredCertificates.map((item) => (
                                        <tr key={item.id}>
                                            <td className="certificate-manager__id">{item.displayId || item.id}</td>
                                            <td>
                                                <div className="certificate-manager__strong">{item.mainDomain}</div>
                                                <div className="certificate-manager__muted">
                                                    其他域名：{item.domains.length > 1 ? item.domains.slice(1).join(', ') : '无'}
                                                </div>
                                            </td>
                                            <td>
                                                <div>{challengeLabel(item.challenge)}</div>
                                                <div className="certificate-manager__muted">请求密钥：{item.keyLength || '-'}</div>
                                                <div className="certificate-manager__muted">实际签名：{item.issuedSignatureAlgorithm || '-'}</div>
                                                <div className="certificate-manager__code">指纹：{item.fingerprint || '-'}</div>
                                            </td>
                                            <td>{caLabel(item.caServer)}</td>
                                            <td>
                                                <div>ACME：{item.acmeAccountName || '-'}</div>
                                                <div className="certificate-manager__muted">DNS：{item.dnsAccountName || '-'}</div>
                                            </td>
                                            <td>
                                                <span className={statusClassName(item.statusTone)}>{item.statusLabel}</span>
                                                {item.lastError && (
                                                    <div className="certificate-manager__field-note text-danger mt-2">
                                                        {item.lastError}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <div>{formatTime(item.notAfter)}</div>
                                                <div className="certificate-manager__muted">{formatExpiresText(item.expiresInDays)}</div>
                                            </td>
                                            <td>
                                                <div>
                                                    <span className="certificate-manager__renew">{item.autoRenew ? '开启' : '关闭'}</span>
                                                </div>
                                                <div className="certificate-manager__muted mt-2">{item.usageLabel}</div>
                                            </td>
                                            <td>{item.remark || '-'}</td>
                                            <td>
                                                <div className="certificate-manager__menu" onClick={(event) => event.stopPropagation()}>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-secondary btn-sm certificate-manager__menu-trigger"
                                                        onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}>
                                                        ...
                                                    </button>

                                                    {activeMenuId === item.id && (
                                                        <div className="certificate-manager__menu-popover">
                                                            <button type="button" className="dropdown-item" onClick={() => viewCertificate(item.id)}>
                                                                查看证书
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="dropdown-item"
                                                                disabled={!overview?.supported || !overview?.installed}
                                                                onClick={() => renewCertificate(item.id, false)}>
                                                                手动续签
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="dropdown-item"
                                                                disabled={!overview?.supported || !overview?.installed}
                                                                onClick={() => renewCertificate(item.id, true)}>
                                                                强制续签
                                                            </button>
                                                            <button type="button" className="dropdown-item" onClick={() => toggleAutoRenew(item)}>
                                                                {item.autoRenew ? '关闭自动续签' : '开启自动续签'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="dropdown-item"
                                                                onClick={() => (item.inUseByPanel
                                                                    ? unapplyCertificateFromTarget(item, 'panel')
                                                                    : applyCertificateToTarget(item, 'panel'))}>
                                                                {item.inUseByPanel ? '取消应用到面板' : '应用到面板'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="dropdown-item"
                                                                onClick={() => (item.inUseByDNS
                                                                    ? unapplyCertificateFromTarget(item, 'dns')
                                                                    : applyCertificateToTarget(item, 'dns'))}>
                                                                {item.inUseByDNS ? '取消应用到 DNS 加密' : '应用到 DNS 加密'}
                                                            </button>
                                                            <button type="button" className="dropdown-item" onClick={() => openPushDialog(item)}>
                                                                推送到目录
                                                            </button>
                                                            <button type="button" className="dropdown-item text-danger" onClick={() => deleteCertificate(item)}>
                                                                删除证书
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <ReactModal
                className="Modal__Bootstrap modal-dialog modal-dialog-centered certificate-manager__modal-dialog certificate-manager__modal-dialog--issue"
                closeTimeoutMS={0}
                isOpen={issueVisible}
                portalClassName={CERTIFICATE_MODAL_PORTAL_CLASS}
                onRequestClose={() => setIssueVisible(false)}>
                <div className="modal-content certificate-manager__modal-content certificate-manager__modal-content--issue">
                    <div className="modal-header certificate-manager__modal-header">
                        <div>
                            <div className="certificate-manager__modal-eyebrow">ISSUE CERTIFICATE</div>
                            <h4 className="modal-title">申请证书</h4>
                            <div className="certificate-manager__modal-subtitle">
                                按原项目的 ACME 思路重做为真实后端流程，签发后可直接应用到面板或 DNS 加密。
                            </div>
                        </div>

                        <div className="certificate-manager__modal-header-actions">
                            <button type="button" className="close" onClick={() => setIssueVisible(false)}>
                                <span className="sr-only">Close</span>
                            </button>
                        </div>
                    </div>

                    <div className="modal-body certificate-manager__modal-body">
                        {issueDialogNotice && (
                            <div className="certificate-manager__preview-box certificate-manager__preview-box--warning certificate-manager__issue-notice">
                                <div className="certificate-manager__section-title">{issueDialogNotice.title}</div>
                                <div className="certificate-manager__preview-text">{issueDialogNotice.text}</div>
                            </div>
                        )}

                        <div className="certificate-manager__form-section">
                            <div className="certificate-manager__section-head">
                                <div className="certificate-manager__section-title">基础信息</div>
                                <div className="certificate-manager__section-caption">支持域名证书与 IP 证书；IP 证书仅保留原项目里相对安全的 challenge 选项。</div>
                            </div>

                            <div className="certificate-manager__form-grid certificate-manager__form-grid--triple">
                                <label className="certificate-manager__field">
                                    <span className="certificate-manager__field-label">证书类型</span>
                                    <select
                                        className="form-control custom-select"
                                        value={issueForm.certificateType}
                                        onChange={(event) => setIssueForm((current) => {
                                            const nextCertificateType = event.target.value as 'domain' | 'ip';

                                            return {
                                                ...current,
                                                certificateType: nextCertificateType,
                                                challenge: nextCertificateType === 'ip'
                                                    ? (current.challenge === 'alpn' ? 'alpn' : 'standalone')
                                                    : current.challenge,
                                                server: nextCertificateType === 'ip'
                                                    ? 'letsencrypt'
                                                    : (current.server || overview?.preferredCA || 'letsencrypt'),
                                                acmeAccountId: nextCertificateType === 'ip' ? 0 : current.acmeAccountId,
                                            };
                                        })}>
                                        {certificateModeOptions.map((item) => (
                                            <option key={item.value} value={item.value}>
                                                {item.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="certificate-manager__field">
                                    <span className="certificate-manager__field-label">验证方式</span>
                                    <select
                                        className="form-control custom-select"
                                        value={issueForm.challenge}
                                        onChange={(event) => setIssueForm((current) => ({ ...current, challenge: event.target.value }))}>
                                        {(issueForm.certificateType === 'ip' ? ipChallengeOptions : challengeOptions).map((item) => (
                                            <option key={item.value} value={item.value}>
                                                {item.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="certificate-manager__field">
                                    <span className="certificate-manager__field-label">CA 平台</span>
                                    <select
                                        className="form-control custom-select"
                                        value={issueForm.server}
                                        disabled={issueForm.certificateType === 'ip'}
                                        onChange={(event) => setIssueForm((current) => ({ ...current, server: event.target.value }))}>
                                        {issueCAOptions.map((item) => (
                                            <option key={item.value} value={item.value}>
                                                {item.name}
                                            </option>
                                        ))}
                                    </select>
                                    {issueForm.certificateType === 'ip' && (
                                        <div className="certificate-manager__field-note">
                                            IP 证书当前固定使用 Let&apos;s Encrypt。
                                        </div>
                                    )}
                                </label>
                            </div>

                            {issueForm.certificateType === 'ip' ? (
                                <div className="certificate-manager__field certificate-manager__field--full mt-3">
                                    <div className="certificate-manager__field-head">
                                        <span className="certificate-manager__field-label">IP 列表</span>
                                        <div className="certificate-manager__field-head-actions">
                                            <span className="certificate-manager__select-note">
                                                <strong>{issueForm.ipAddresses.length}/{certManagerIPCertificateMaxIPs}</strong>
                                                <span>已选择</span>
                                            </span>
                                            <button
                                                type="button"
                                                className="certificate-manager__inline-button"
                                                disabled={issueIPOptionsLoading}
                                                onClick={() => loadIssueIPOptions(true)}>
                                                <Icon name="update" />
                                                {issueIPOptionsLoading ? '刷新中...' : '刷新候选 IP'}
                                            </button>
                                        </div>
                                    </div>

                                    <CreatableSelect
                                        className="certificate-manager__ip-select"
                                        classNamePrefix="certificate-manager__ip-select"
                                        formatCreateLabel={(inputValue) => `使用输入值：${inputValue}`}
                                        formatOptionLabel={(option, meta) => {
                                            const currentOption = issueIPOptionMap.get(option.value);

                                            if (meta.context === 'value' || !currentOption) {
                                                return option.value;
                                            }

                                            return (
                                                <div className="certificate-manager__ip-option">
                                                    <div className="certificate-manager__ip-option-value">{option.value}</div>
                                                    <div className="certificate-manager__ip-option-meta">
                                                        {currentOption.family.toUpperCase()} · {ipOptionSourceLabel(currentOption.source)}
                                                    </div>
                                                </div>
                                            );
                                        }}
                                        isClearable
                                        isLoading={issueIPOptionsLoading}
                                        isMulti
                                        isValidNewOption={(inputValue) => normalizeCertificateManagerIPList([inputValue], 1).length > 0}
                                        loadingMessage={() => '正在获取候选 IP...'}
                                        menuPlacement="auto"
                                        noOptionsMessage={() => issueIPOptionsLoading ? '正在获取候选 IP...' : '暂无候选 IP，可直接输入公网 IP'}
                                        onChange={(value) => updateIssueIPAddresses(value)}
                                        options={issueIPSelectOptions}
                                        placeholder="选择或输入公网 IP，支持逗号、空格或换行批量粘贴"
                                        styles={certificateManagerIPSelectStyles}
                                        value={issueIPSelectedOptions}
                                    />

                                    <div className="certificate-manager__field-note">
                                        优先展示自动探测到的公网出口与网卡地址，也支持手动输入。最多 {certManagerIPCertificateMaxIPs} 个 IP。
                                    </div>
                                </div>
                            ) : (
                                <label className="certificate-manager__field certificate-manager__field--full mt-3">
                                    <div className="certificate-manager__field-head">
                                        <span className="certificate-manager__field-label">域名列表</span>
                                    </div>
                                    <textarea
                                        className="form-control certificate-manager__textarea"
                                        value={issueForm.domainsText}
                                        onChange={(event) => setIssueForm((current) => ({ ...current, domainsText: event.target.value }))}
                                        placeholder={'每行或逗号分隔一个域名，例如：\nexample.com\n*.example.com'}
                                        rows={4}
                                    />
                                    <div className="certificate-manager__field-note">
                                        主域名与附加域名统一填写，支持每行或逗号分隔。
                                    </div>
                                </label>
                            )}

                            <div className="certificate-manager__form-grid mt-3">
                                <label className="certificate-manager__field">
                                    <span className="certificate-manager__field-label">证书密钥算法</span>
                                    <select
                                        className="form-control custom-select"
                                        value={issueForm.keyLength}
                                        onChange={(event) => setIssueForm((current) => ({ ...current, keyLength: event.target.value }))}>
                                        {keyLengthOptions.map((item) => (
                                            <option key={item.value} value={item.value}>
                                                {item.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="certificate-manager__field">
                                    <span className="certificate-manager__field-label">签名算法</span>
                                    <input className="form-control" value={issueSignatureAlgorithmText} readOnly />
                                </label>
                            </div>
                        </div>

                        {issueForm.challenge === 'webroot' && (
                            <div className="certificate-manager__form-section">
                                <div className="certificate-manager__section-head">
                                    <div className="certificate-manager__section-title">Webroot 设置</div>
                                </div>

                                <label className="certificate-manager__field certificate-manager__field--full">
                                    <span className="certificate-manager__field-label">站点目录</span>
                                    <input
                                        className="form-control"
                                        value={issueForm.webroot}
                                        onChange={(event) => setIssueForm((current) => ({ ...current, webroot: event.target.value }))}
                                        placeholder="例如：/var/www/html"
                                    />
                                </label>
                            </div>
                        )}

                        {issueForm.challenge === 'dns' && (
                            <div className="certificate-manager__form-section">
                                <div className="certificate-manager__section-head">
                                    <div className="certificate-manager__section-title">DNS 验证设置</div>
                                    <div className="certificate-manager__section-caption">可直接选托管的 DNS 账号，也可额外补充环境变量。</div>
                                </div>

                                <div className="certificate-manager__form-grid">
                                    <label className="certificate-manager__field">
                                        <span className="certificate-manager__field-label">DNS Provider</span>
                                        <select
                                            className="form-control custom-select"
                                            value={issueForm.dnsProvider}
                                            onChange={(event) => {
                                                const providerCode = event.target.value;

                                                setIssueForm((current) => {
                                                    const selectedAccount = (overview?.dnsAccounts || []).find((item) => item.id === current.dnsAccountId);
                                                    const nextDNSAccountID = selectedAccount && selectedAccount.providerCode !== providerCode
                                                        ? 0
                                                        : current.dnsAccountId;

                                                    return {
                                                        ...current,
                                                        dnsProvider: providerCode,
                                                        dnsAccountId: nextDNSAccountID,
                                                    };
                                                });
                                            }}>
                                            <option value="">请选择 Provider</option>
                                            {dnsProviders.map((item) => (
                                                <option key={item.providerCode} value={item.providerCode}>
                                                    {item.name} ({item.providerCode})
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <label className="certificate-manager__field">
                                        <span className="certificate-manager__field-label">DNS 账号</span>
                                        <select
                                            className="form-control custom-select"
                                            value={issueForm.dnsAccountId}
                                            onChange={(event) => setIssueForm((current) => ({ ...current, dnsAccountId: Number(event.target.value) }))}>
                                            <option value={0}>不使用托管账号</option>
                                            {(overview?.dnsAccounts || []).map((item) => (
                                                <option key={item.id} value={item.id}>
                                                    {item.name} ({item.providerName})
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </div>

                                <label className="certificate-manager__field certificate-manager__field--full mt-3">
                                    <span className="certificate-manager__field-label">扩展环境变量（可选）</span>
                                    <textarea
                                        className="form-control certificate-manager__textarea"
                                        value={issueForm.dnsEnvText}
                                        onChange={(event) => setIssueForm((current) => ({ ...current, dnsEnvText: event.target.value }))}
                                        placeholder={'每行一个 KEY=VALUE，例如：\nCF_Zone_ID=xxxx\nCUSTOM_ENDPOINT=https://api.example.com'}
                                        rows={4}
                                    />
                                </label>

                                {selectedIssueDnsProvider && (
                                    <div className="certificate-manager__provider-helper mt-3">
                                        <Icon name="info" />
                                        <div>
                                            <div className="certificate-manager__provider-helper-title">
                                                {selectedIssueDnsProvider.name} 鉴权说明
                                            </div>
                                            <div className="certificate-manager__provider-helper-text">
                                                {selectedIssueDnsProvider.helper}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="certificate-manager__form-section">
                            <div className="certificate-manager__section-head">
                                <div className="certificate-manager__section-title">账号与附加项</div>
                            </div>

                            <div className={`certificate-manager__form-grid ${issueForm.certificateType === 'domain' ? 'certificate-manager__form-grid--triple' : ''}`}>
                                {issueForm.certificateType === 'domain' && (
                                    <label className="certificate-manager__field">
                                        <span className="certificate-manager__field-label">ACME 账号</span>
                                        <select
                                            className="form-control custom-select"
                                            value={issueForm.acmeAccountId}
                                            onChange={(event) => setIssueForm((current) => ({ ...current, acmeAccountId: Number(event.target.value) }))}>
                                            <option value={0}>请选择 ACME 账号</option>
                                            {availableIssueAcmeAccounts.map((item) => (
                                                <option key={item.id} value={item.id}>
                                                    {item.name} ({item.email})
                                                </option>
                                            ))}
                                        </select>
                                        {availableIssueAcmeAccounts.length === 0 && (
                                            <div className="certificate-manager__field-note">
                                                当前 CA 平台下暂无可用 ACME 账号，请先在“ACME 账号”中创建。
                                            </div>
                                        )}
                                    </label>
                                )}

                                <label className="certificate-manager__field">
                                    <span className="certificate-manager__field-label">推送目录（可选）</span>
                                    <input
                                        className="form-control"
                                        value={issueForm.pushDir}
                                        onChange={(event) => setIssueForm((current) => ({ ...current, pushDir: event.target.value }))}
                                        placeholder="例如：/etc/nginx/ssl/example"
                                    />
                                </label>

                                <label className="certificate-manager__field">
                                    <span className="certificate-manager__field-label">自动续签</span>
                                    <div className="certificate-manager__checkbox-row">
                                        <input
                                            type="checkbox"
                                            checked={issueForm.autoRenew}
                                            onChange={(event) => setIssueForm((current) => ({ ...current, autoRenew: event.target.checked }))}
                                        />
                                        <span>创建后立即纳入自动续签窗口</span>
                                    </div>
                                </label>
                            </div>

                            {issueForm.certificateType === 'ip' && (
                                <div className="certificate-manager__field-note">
                                    IP 证书不单独指定 ACME 账号，将按运行时联系邮箱自动注册或复用 Let&apos;s Encrypt 账号。
                                </div>
                            )}

                            <label className="certificate-manager__field certificate-manager__field--full mt-3">
                                <span className="certificate-manager__field-label">自定义参数（可选）</span>
                                <input
                                    className="form-control"
                                    value={issueForm.customArgs}
                                    onChange={(event) => setIssueForm((current) => ({ ...current, customArgs: event.target.value }))}
                                    placeholder="例如：--dnssleep 20"
                                />
                            </label>

                            <label className="certificate-manager__field certificate-manager__field--full mt-3">
                                <span className="certificate-manager__field-label">备注</span>
                                <textarea
                                    className="form-control certificate-manager__textarea"
                                    value={issueForm.remark}
                                    onChange={(event) => setIssueForm((current) => ({ ...current, remark: event.target.value }))}
                                    placeholder="记录证书用途、部署位置或注意事项"
                                    rows={3}
                                />
                            </label>
                        </div>

                        {issueError && <div className="certificate-manager__form-error">{issueError}</div>}
                    </div>

                    <div className="modal-footer certificate-manager__modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={() => setIssueVisible(false)}>
                            取消
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            disabled={issueSubmitDisabled}
                            onClick={submitIssue}>
                            {issueSubmitLabel}
                        </button>
                    </div>
                </div>
            </ReactModal>

            <ReactModal
                className="Modal__Bootstrap modal-dialog modal-dialog-centered certificate-manager__modal-dialog certificate-manager__modal-dialog--acme"
                closeTimeoutMS={0}
                isOpen={acmeDialogVisible}
                portalClassName={CERTIFICATE_MODAL_PORTAL_CLASS}
                onRequestClose={() => setAcmeDialogVisible(false)}>
                <div className="modal-content certificate-manager__modal-content">
                    <div className="modal-header certificate-manager__modal-header">
                        <div>
                            <div className="certificate-manager__modal-eyebrow">ACME ACCOUNT CENTER</div>
                            <h4 className="modal-title">ACME 账号</h4>
                            <div className="certificate-manager__modal-subtitle">
                                保存 CA 平台、注册邮箱与默认密钥算法，供申请与续签流程复用。
                            </div>
                        </div>

                        <div className="certificate-manager__modal-header-actions">
                            <button type="button" className="btn btn-primary certificate-manager__dialog-button" onClick={() => openAcmeForm()}>
                                <Icon name="plus" />
                                新增账号
                            </button>
                            <button type="button" className="close" onClick={() => setAcmeDialogVisible(false)}>
                                <span className="sr-only">Close</span>
                            </button>
                        </div>
                    </div>

                    <div className="modal-body certificate-manager__modal-body">
                        <div className="certificate-manager__dns-summary">
                            <div className="certificate-manager__dns-summary-card">
                                <span className="certificate-manager__dns-summary-label">账号总数</span>
                                <strong className="certificate-manager__dns-summary-value">{overview?.acmeAccounts?.length || 0}</strong>
                            </div>
                            <div className="certificate-manager__dns-summary-card">
                                <span className="certificate-manager__dns-summary-label">默认 CA</span>
                                <strong className="certificate-manager__dns-summary-value">{caLabel(overview?.preferredCA || '')}</strong>
                            </div>
                            <div className="certificate-manager__dns-summary-card">
                                <span className="certificate-manager__dns-summary-label">默认算法</span>
                                <strong className="certificate-manager__dns-summary-value">{overview?.defaultKeyLength || '-'}</strong>
                            </div>
                        </div>

                        <div className="certificate-manager__dns-toolbar">
                            <div className="certificate-manager__search certificate-manager__search--modal">
                                <Icon name="magnifier" />
                                <input
                                    className="form-control certificate-manager__search-control"
                                    value={acmeSearch}
                                    onChange={(event) => setAcmeSearch(event.target.value)}
                                    placeholder="搜索账号名称 / 邮箱 / 备注"
                                />
                            </div>
                        </div>

                        <div className="certificate-manager__subtable-wrap">
                            <table className="table table-hover table-vcenter certificate-manager__subtable">
                                <thead>
                                    <tr>
                                        <th>名称</th>
                                        <th>邮箱</th>
                                        <th>CA 平台</th>
                                        <th>密钥算法</th>
                                        <th>备注</th>
                                        <th>更新时间</th>
                                        <th className="text-right">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAcmeAccounts.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center certificate-manager__muted">
                                                暂无 ACME 账号
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredAcmeAccounts.map((item) => (
                                            <tr key={item.id}>
                                                <td className="certificate-manager__strong">{item.name}</td>
                                                <td>{item.email}</td>
                                                <td>{caLabel(item.server)}</td>
                                                <td>{item.keyLength}</td>
                                                <td>{item.remark || '-'}</td>
                                                <td className="certificate-manager__code">{formatTime(item.updatedAt)}</td>
                                                <td className="text-right">
                                                    <div className="certificate-manager__subtable-actions">
                                                        <button type="button" className="btn btn-icon btn-outline-primary btn-sm" onClick={() => openAcmeForm(item)}>
                                                            <Icon name="edit" />
                                                        </button>
                                                        <button type="button" className="btn btn-icon btn-outline-danger btn-sm" onClick={() => deleteAcmeAccount(item)}>
                                                            <Icon name="delete" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="modal-footer certificate-manager__modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={() => setAcmeDialogVisible(false)}>
                            关闭
                        </button>
                    </div>
                </div>
            </ReactModal>

            <ReactModal
                className="Modal__Bootstrap modal-dialog modal-dialog-centered certificate-manager__modal-dialog certificate-manager__modal-dialog--dns"
                closeTimeoutMS={0}
                isOpen={dnsDialogVisible}
                portalClassName={CERTIFICATE_MODAL_PORTAL_CLASS}
                onRequestClose={() => setDnsDialogVisible(false)}>
                <div className="modal-content certificate-manager__modal-content">
                    <div className="modal-header certificate-manager__modal-header">
                        <div>
                            <div className="certificate-manager__modal-eyebrow">DNS ACCOUNT CENTER</div>
                            <h4 className="modal-title">DNS 账号</h4>
                            <div className="certificate-manager__modal-subtitle">
                                统一托管 DNS API 凭据，供后续 ACME DNS 验证、证书申请与续签流程复用。
                            </div>
                        </div>

                        <div className="certificate-manager__modal-header-actions">
                            <button type="button" className="btn btn-primary certificate-manager__dialog-button" onClick={() => openDnsForm()}>
                                <Icon name="plus" />
                                新增账号
                            </button>
                            <button type="button" className="close" onClick={() => setDnsDialogVisible(false)}>
                                <span className="sr-only">Close</span>
                            </button>
                        </div>
                    </div>

                    <div className="modal-body certificate-manager__modal-body">
                        <div className="certificate-manager__dns-summary">
                            <div className="certificate-manager__dns-summary-card">
                                <span className="certificate-manager__dns-summary-label">账号总数</span>
                                <strong className="certificate-manager__dns-summary-value">{overview?.dnsAccounts?.length || 0}</strong>
                            </div>
                            <div className="certificate-manager__dns-summary-card">
                                <span className="certificate-manager__dns-summary-label">已用 Provider</span>
                                <strong className="certificate-manager__dns-summary-value">
                                    {new Set((overview?.dnsAccounts || []).map((item) => item.providerCode)).size}
                                </strong>
                            </div>
                            <div className="certificate-manager__dns-summary-card">
                                <span className="certificate-manager__dns-summary-label">模板数量</span>
                                <strong className="certificate-manager__dns-summary-value">{dnsProviders.length}</strong>
                            </div>
                        </div>

                        <div className="certificate-manager__dns-toolbar">
                            <div className="certificate-manager__search certificate-manager__search--modal">
                                <Icon name="magnifier" />
                                <input
                                    className="form-control certificate-manager__search-control"
                                    value={dnsSearch}
                                    onChange={(event) => setDnsSearch(event.target.value)}
                                    placeholder="搜索账号名称 / Provider / 备注"
                                />
                            </div>
                        </div>

                        <div className="certificate-manager__subtable-wrap">
                            <table className="table table-hover table-vcenter certificate-manager__subtable">
                                <thead>
                                    <tr>
                                        <th>名称</th>
                                        <th>Provider</th>
                                        <th>参数摘要</th>
                                        <th>备注</th>
                                        <th>更新时间</th>
                                        <th className="text-right">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredDnsAccounts.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center certificate-manager__muted">
                                                暂无 DNS 账号
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredDnsAccounts.map((item) => (
                                            <tr key={item.id}>
                                                <td className="certificate-manager__strong">{item.name}</td>
                                                <td>
                                                    <div>{item.providerName}</div>
                                                    <div className="certificate-manager__muted">{item.providerCode}</div>
                                                </td>
                                                <td>{envSummary(item.env)}</td>
                                                <td>{item.remark || '-'}</td>
                                                <td className="certificate-manager__code">{formatTime(item.updatedAt)}</td>
                                                <td className="text-right">
                                                    <div className="certificate-manager__subtable-actions">
                                                        <button type="button" className="btn btn-icon btn-outline-primary btn-sm" onClick={() => openDnsForm(item)}>
                                                            <Icon name="edit" />
                                                        </button>
                                                        <button type="button" className="btn btn-icon btn-outline-danger btn-sm" onClick={() => deleteDnsAccount(item)}>
                                                            <Icon name="delete" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="modal-footer certificate-manager__modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={() => setDnsDialogVisible(false)}>
                            关闭
                        </button>
                    </div>
                </div>
            </ReactModal>

            <ReactModal
                className="Modal__Bootstrap modal-dialog modal-dialog-centered certificate-manager__modal-dialog certificate-manager__modal-dialog--acme-form"
                closeTimeoutMS={0}
                isOpen={acmeFormVisible}
                portalClassName={CERTIFICATE_MODAL_PORTAL_CLASS}
                onRequestClose={() => setAcmeFormVisible(false)}>
                <div className="modal-content certificate-manager__modal-content certificate-manager__modal-content--form">
                    <div className="modal-header certificate-manager__modal-header">
                        <div>
                            <div className="certificate-manager__modal-eyebrow">ACME ACCOUNT FORM</div>
                            <h4 className="modal-title">{acmeForm.id > 0 ? '编辑 ACME 账号' : '新增 ACME 账号'}</h4>
                            <div className="certificate-manager__modal-subtitle">账号将与证书申请、续签流程关联。</div>
                        </div>

                        <div className="certificate-manager__modal-header-actions">
                            <button type="button" className="close" onClick={() => setAcmeFormVisible(false)}>
                                <span className="sr-only">Close</span>
                            </button>
                        </div>
                    </div>

                    <div className="modal-body certificate-manager__modal-body">
                        <div className="certificate-manager__form-section">
                            <div className="certificate-manager__form-grid">
                                <label className="certificate-manager__field">
                                    <span className="certificate-manager__field-label">账号名称</span>
                                    <input className="form-control" value={acmeForm.name} onChange={(event) => setAcmeForm((current) => ({ ...current, name: event.target.value }))} />
                                </label>

                                <label className="certificate-manager__field">
                                    <span className="certificate-manager__field-label">邮箱</span>
                                    <input className="form-control" value={acmeForm.email} onChange={(event) => setAcmeForm((current) => ({ ...current, email: event.target.value }))} />
                                </label>

                                <label className="certificate-manager__field">
                                    <span className="certificate-manager__field-label">CA 平台</span>
                                    <select className="form-control custom-select" value={acmeForm.server} onChange={(event) => setAcmeForm((current) => ({ ...current, server: event.target.value }))}>
                                        {(overview?.caOptions || []).map((item) => (
                                            <option key={item.value} value={item.value}>{item.name}</option>
                                        ))}
                                    </select>
                                </label>

                                <label className="certificate-manager__field">
                                    <span className="certificate-manager__field-label">默认密钥算法</span>
                                    <select className="form-control custom-select" value={acmeForm.keyLength} onChange={(event) => setAcmeForm((current) => ({ ...current, keyLength: event.target.value }))}>
                                        {keyLengthOptions.map((item) => (
                                            <option key={item.value} value={item.value}>{item.label}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                        </div>

                        <div className="certificate-manager__form-section">
                            <label className="certificate-manager__field certificate-manager__field--full">
                                <span className="certificate-manager__field-label">备注</span>
                                <textarea className="form-control certificate-manager__textarea" value={acmeForm.remark} onChange={(event) => setAcmeForm((current) => ({ ...current, remark: event.target.value }))} rows={3} />
                            </label>
                        </div>

                        {acmeError && <div className="certificate-manager__form-error">{acmeError}</div>}
                    </div>

                    <div className="modal-footer certificate-manager__modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={() => setAcmeFormVisible(false)}>取消</button>
                        <button type="button" className="btn btn-primary" disabled={busyKey !== ''} onClick={saveAcmeAccount}>保存</button>
                    </div>
                </div>
            </ReactModal>

            <ReactModal
                className="Modal__Bootstrap modal-dialog modal-dialog-centered certificate-manager__modal-dialog certificate-manager__modal-dialog--dns-form"
                closeTimeoutMS={0}
                isOpen={dnsFormVisible}
                portalClassName={CERTIFICATE_MODAL_PORTAL_CLASS}
                onRequestClose={() => setDnsFormVisible(false)}>
                <div className="modal-content certificate-manager__modal-content certificate-manager__modal-content--form">
                    <div className="modal-header certificate-manager__modal-header">
                        <div>
                            <div className="certificate-manager__modal-eyebrow">DNS ACCOUNT FORM</div>
                            <h4 className="modal-title">{dnsForm.id > 0 ? '编辑 DNS 账号' : '新增 DNS 账号'}</h4>
                            <div className="certificate-manager__modal-subtitle">
                                Provider 字段结构与原项目的 ACME DNS 目录保持一致。
                            </div>
                        </div>

                        <div className="certificate-manager__modal-header-actions">
                            {selectedDnsProvider && <span className="certificate-manager__provider-pill">{selectedDnsProvider.name}</span>}
                            <button type="button" className="close" onClick={() => setDnsFormVisible(false)}>
                                <span className="sr-only">Close</span>
                            </button>
                        </div>
                    </div>

                    <div className="modal-body certificate-manager__modal-body">
                        <div className="certificate-manager__form-section">
                            <div className="certificate-manager__form-grid">
                                <label className="certificate-manager__field">
                                    <span className="certificate-manager__field-label">账号名称</span>
                                    <input className="form-control" value={dnsForm.name} onChange={(event) => setDnsForm((current) => ({ ...current, name: event.target.value }))} />
                                </label>

                                <label className="certificate-manager__field">
                                    <span className="certificate-manager__field-label">DNS Provider</span>
                                    <select className="form-control custom-select" value={dnsForm.providerCode} onChange={(event) => setDnsForm((current) => ({ ...current, providerCode: event.target.value, env: {} }))}>
                                        {dnsProviders.map((item) => (
                                            <option key={item.providerCode} value={item.providerCode}>
                                                {item.name} ({item.providerCode})
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                        </div>

                        {selectedDnsProvider && (
                            <div className="certificate-manager__provider-helper">
                                <Icon name="info" />
                                <div>
                                    <div className="certificate-manager__provider-helper-title">{selectedDnsProvider.name} 鉴权说明</div>
                                    <div className="certificate-manager__provider-helper-text">{selectedDnsProvider.helper}</div>
                                </div>
                            </div>
                        )}

                        <div className="certificate-manager__form-section">
                            <div className="certificate-manager__section-head">
                                <div className="certificate-manager__section-title">鉴权参数</div>
                                <div className="certificate-manager__section-caption">带 * 的字段为 Provider 的强制要求。</div>
                            </div>

                            <div className="certificate-manager__form-grid certificate-manager__form-grid--env">
                                {(selectedDnsProvider?.fields || []).map((field) => (
                                    <label className="certificate-manager__field" key={field.key}>
                                        <span className="certificate-manager__field-label">
                                            {field.label}
                                            {field.required && <span className="certificate-manager__field-required"> *</span>}
                                        </span>
                                        <input
                                            className="form-control"
                                            value={dnsForm.env[field.key] || ''}
                                            onChange={(event) => setDnsForm((current) => ({
                                                ...current,
                                                env: { ...current.env, [field.key]: event.target.value },
                                            }))}
                                            placeholder={field.placeholder || ''}
                                            autoComplete="off"
                                        />
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="certificate-manager__form-section">
                            <div className="certificate-manager__section-head">
                                <div className="certificate-manager__section-title">扩展参数</div>
                                <div className="certificate-manager__section-caption">每行一个 KEY=VALUE，可选。</div>
                            </div>

                            <label className="certificate-manager__field certificate-manager__field--full">
                                <textarea
                                    className="form-control certificate-manager__textarea"
                                    value={dnsForm.extraEnvText}
                                    onChange={(event) => setDnsForm((current) => ({ ...current, extraEnvText: event.target.value }))}
                                    rows={4}
                                    placeholder={'例如：\nCF_Zone_ID=xxxx\nCUSTOM_ENDPOINT=https://api.example.com'}
                                />
                            </label>
                        </div>

                        <div className="certificate-manager__form-section">
                            <label className="certificate-manager__field certificate-manager__field--full">
                                <span className="certificate-manager__field-label">备注</span>
                                <textarea className="form-control certificate-manager__textarea" value={dnsForm.remark} onChange={(event) => setDnsForm((current) => ({ ...current, remark: event.target.value }))} rows={3} />
                            </label>
                        </div>

                        {dnsError && <div className="certificate-manager__form-error">{dnsError}</div>}
                    </div>

                    <div className="modal-footer certificate-manager__modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={() => setDnsFormVisible(false)}>取消</button>
                        <button type="button" className="btn btn-primary" disabled={busyKey !== ''} onClick={saveDnsAccount}>保存</button>
                    </div>
                </div>
            </ReactModal>

            <ReactModal
                className="Modal__Bootstrap modal-dialog modal-dialog-centered certificate-manager__modal-dialog certificate-manager__modal-dialog--acme-form"
                closeTimeoutMS={0}
                isOpen={materialVisible}
                portalClassName={CERTIFICATE_MODAL_PORTAL_CLASS}
                onRequestClose={() => setMaterialVisible(false)}>
                <div className="modal-content certificate-manager__modal-content certificate-manager__modal-content--form">
                    <div className="modal-header certificate-manager__modal-header">
                        <div>
                            <div className="certificate-manager__modal-eyebrow">CERTIFICATE MATERIAL</div>
                            <h4 className="modal-title">{material?.mainDomain || '查看证书'}</h4>
                            <div className="certificate-manager__modal-subtitle">
                                展示当前库存中保存的证书材料与托管路径。
                            </div>
                        </div>

                        <div className="certificate-manager__modal-header-actions">
                            <button type="button" className="close" onClick={() => setMaterialVisible(false)}>
                                <span className="sr-only">Close</span>
                            </button>
                        </div>
                    </div>

                    <div className="modal-body certificate-manager__modal-body">{materialBody}</div>

                    <div className="modal-footer certificate-manager__modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={() => setMaterialVisible(false)}>关闭</button>
                    </div>
                </div>
            </ReactModal>

            <ReactModal
                className="Modal__Bootstrap modal-dialog modal-dialog-centered certificate-manager__modal-dialog certificate-manager__modal-dialog--acme-form"
                closeTimeoutMS={0}
                isOpen={pushVisible}
                portalClassName={CERTIFICATE_MODAL_PORTAL_CLASS}
                onRequestClose={() => setPushVisible(false)}>
                <div className="modal-content certificate-manager__modal-content certificate-manager__modal-content--form">
                    <div className="modal-header certificate-manager__modal-header">
                        <div>
                            <div className="certificate-manager__modal-eyebrow">PUSH CERTIFICATE</div>
                            <h4 className="modal-title">推送到目录</h4>
                            <div className="certificate-manager__modal-subtitle">
                                将当前库存中的证书材料写入目标目录，生成 `cert.pem`、`key.pem`、`fullchain.pem`、`chain.pem`。
                            </div>
                        </div>

                        <div className="certificate-manager__modal-header-actions">
                            <button type="button" className="close" onClick={() => setPushVisible(false)}>
                                <span className="sr-only">Close</span>
                            </button>
                        </div>
                    </div>

                    <div className="modal-body certificate-manager__modal-body">
                        <div className="certificate-manager__form-section">
                            <label className="certificate-manager__field certificate-manager__field--full">
                                <span className="certificate-manager__field-label">目标目录</span>
                                <input className="form-control" value={pushTargetDir} onChange={(event) => setPushTargetDir(event.target.value)} placeholder="例如：/etc/nginx/ssl/example" />
                            </label>
                        </div>
                    </div>

                    <div className="modal-footer certificate-manager__modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={() => setPushVisible(false)}>取消</button>
                        <button type="button" className="btn btn-primary" disabled={busyKey !== ''} onClick={submitPush}>开始推送</button>
                    </div>
                </div>
            </ReactModal>
        </div>
    );
};

export default CertificateManager;

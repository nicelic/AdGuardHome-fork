import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { debounce } from 'lodash';
import { DEBOUNCE_TIMEOUT, ENCRYPTION_SOURCE } from '../../../helpers/constants';
import { Form } from './Form';
import Card from '../../ui/Card';
import PageTitle from '../../ui/PageTitle';
import Loading from '../../ui/Loading';
export const Encryption = ({ encryption, setTlsConfig, validateTlsConfig }) => {
    const { t } = useTranslation();
    const getPathPairs = useCallback((pairs, certificatePath = '', privateKeyPath = '') => {
        if (pairs.length > 0) {
            return pairs;
        }
        if (certificatePath || privateKeyPath) {
            return [
                {
                    certificate_path: certificatePath,
                    private_key_path: privateKeyPath,
                },
            ];
        }
        return [
            {
                certificate_path: '',
                private_key_path: '',
            },
        ];
    }, []);
    const normalizeTLSBlockSubmitValues = useCallback((config, block) => {
        const { certificateSource, keySource, privateKeySaved, certificateKeyPairs, prefix = '' } = block;
        const certificateChainField = `${prefix}certificate_chain`;
        const certificatePathField = `${prefix}certificate_path`;
        const privateKeyField = `${prefix}private_key`;
        const privateKeyPathField = `${prefix}private_key_path`;
        const certificateKeyPairsField = `${prefix}certificate_key_pairs`;
        const privateKeySavedField = `${prefix}private_key_saved`;
        const normalizedPathPairs = certificateKeyPairs.filter((pair) => pair.certificate_path.trim() || pair.private_key_path.trim());
        const usePathPairs = certificateSource === ENCRYPTION_SOURCE.PATH && keySource === ENCRYPTION_SOURCE.PATH;
        config[certificateKeyPairsField] = usePathPairs ? normalizedPathPairs : [];
        if (certificateSource === ENCRYPTION_SOURCE.PATH) {
            config[certificateChainField] = '';
            config[certificatePathField] = usePathPairs
                ? normalizedPathPairs[0]?.certificate_path || ''
                : config[certificatePathField];
        }
        else {
            config[certificatePathField] = '';
            config[certificateKeyPairsField] = [];
        }
        if (keySource === ENCRYPTION_SOURCE.PATH) {
            config[privateKeyField] = '';
            config[privateKeyPathField] = usePathPairs
                ? normalizedPathPairs[0]?.private_key_path || ''
                : config[privateKeyPathField];
        }
        else {
            config[privateKeyPathField] = '';
            if (privateKeySaved) {
                config[privateKeyField] = '';
                config[privateKeySavedField] = privateKeySaved;
            }
        }
    }, []);
    const initialValues = useMemo(() => {
        const { enabled, serve_plain_dns, panel_server_name, panel_server_url_path, panel_server_port, server_name, dns_over_quic_url_path, force_https, port_https, port_dns_over_tls, port_dns_over_quic, port_dnscrypt, certificate_chain, private_key, certificate_path, certificate_key_pairs, private_key_path, private_key_saved, panel_certificate_chain, panel_private_key, panel_certificate_path, panel_certificate_key_pairs, panel_private_key_path, panel_private_key_saved, } = encryption;
        const certificate_source = certificate_chain ? ENCRYPTION_SOURCE.CONTENT : ENCRYPTION_SOURCE.PATH;
        const key_source = private_key || private_key_saved ? ENCRYPTION_SOURCE.CONTENT : ENCRYPTION_SOURCE.PATH;
        const panel_certificate_source = panel_certificate_chain ? ENCRYPTION_SOURCE.CONTENT : ENCRYPTION_SOURCE.PATH;
        const panel_key_source = panel_private_key || panel_private_key_saved
            ? ENCRYPTION_SOURCE.CONTENT
            : ENCRYPTION_SOURCE.PATH;
        const pathPairs = getPathPairs(certificate_key_pairs, certificate_path, private_key_path);
        const panelPathPairs = getPathPairs(panel_certificate_key_pairs, panel_certificate_path, panel_private_key_path);
        return {
            enabled,
            serve_plain_dns,
            panel_server_name: panel_server_name || '',
            panel_server_url_path: panel_server_url_path || '/',
            panel_server_port: panel_server_port || undefined,
            server_name,
            dns_over_quic_url_path: dns_over_quic_url_path || '/dns-query',
            force_https,
            port_https,
            port_dns_over_tls,
            port_dns_over_quic,
            port_dnscrypt,
            certificate_chain,
            private_key,
            certificate_path,
            certificate_key_pairs: pathPairs,
            private_key_path,
            private_key_saved,
            panel_certificate_chain,
            panel_private_key,
            panel_certificate_path,
            panel_certificate_key_pairs: panelPathPairs,
            panel_private_key_path,
            panel_private_key_saved,
            certificate_source,
            key_source,
            panel_certificate_source,
            panel_key_source,
        };
    }, [encryption, getPathPairs]);
    const getSubmitValues = useCallback((values) => {
        const { certificate_source, key_source, private_key_saved, certificate_key_pairs = [], panel_certificate_source, panel_key_source, panel_private_key_saved, panel_certificate_key_pairs = [], ...config } = values;
        normalizeTLSBlockSubmitValues(config, {
            certificateSource: certificate_source,
            keySource: key_source,
            privateKeySaved: private_key_saved,
            certificateKeyPairs: certificate_key_pairs,
        });
        normalizeTLSBlockSubmitValues(config, {
            certificateSource: panel_certificate_source,
            keySource: panel_key_source,
            privateKeySaved: panel_private_key_saved,
            certificateKeyPairs: panel_certificate_key_pairs,
            prefix: 'panel_',
        });
        return config;
    }, [normalizeTLSBlockSubmitValues]);
    const handleFormSubmit = useCallback(async (values) => {
        const submitValues = getSubmitValues(values);
        if (!submitValues.enabled) {
            await setTlsConfig(submitValues);
            return;
        }
        const validation = await validateTlsConfig(submitValues);
        if (!validation) {
            return;
        }
        const dnsCertificateRequired = Boolean(submitValues.enabled
            && (submitValues.port_https || submitValues.port_dns_over_tls || submitValues.port_dns_over_quic));
        const panelCertificateRequired = Boolean(submitValues.enabled);
        const dnsCanApply = !dnsCertificateRequired || (validation.can_apply
            && validation.valid_key
            && validation.valid_cert
            && validation.valid_pair);
        const panelCanApply = !panelCertificateRequired || (validation.panel_can_apply
            && validation.panel_valid_key
            && validation.panel_valid_cert
            && validation.panel_valid_pair);
        if (!dnsCanApply || !panelCanApply) {
            return;
        }
        await setTlsConfig(submitValues);
    }, [getSubmitValues, setTlsConfig, validateTlsConfig]);
    const validateConfig = useCallback((values) => {
        const submitValues = getSubmitValues(values);
        if (submitValues.enabled) {
            validateTlsConfig(submitValues);
        }
    }, [getSubmitValues, validateTlsConfig]);
    const debouncedConfigValidation = useMemo(() => debounce(validateConfig, DEBOUNCE_TIMEOUT), [validateConfig]);
    return (React.createElement("div", { className: "encryption" },
        React.createElement(PageTitle, { title: t('encryption_settings') }),
        encryption.processing ? (React.createElement(Loading, null)) : (React.createElement(Card, { title: t('encryption_title'), subtitle: t('encryption_desc'), bodyType: "card-body box-body--settings" },
            React.createElement(Form, { initialValues: initialValues, onSubmit: handleFormSubmit, debouncedConfigValidation: debouncedConfigValidation, setTlsConfig: setTlsConfig, validateTlsConfig: validateTlsConfig, encryption: encryption })))));
};

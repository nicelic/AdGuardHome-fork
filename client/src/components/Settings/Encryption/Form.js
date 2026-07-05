import React, { useEffect } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import i18next from 'i18next';
import { validateServerName, validateIsSafePort, validateInstallPort, validatePort, validatePortQuic, validatePortTLS, validatePlainDns, validateAbsolutePath, validateURLPathPrefix, validatePairedValue, } from '../../../helpers/validators';
import KeyStatus from './KeyStatus';
import CertificateStatus from './CertificateStatus';
import { DNS_OVER_QUIC_PORT, DNS_OVER_TLS_PORT, STANDARD_HTTPS_PORT, ENCRYPTION_SOURCE, } from '../../../helpers/constants';
import { Checkbox } from '../../ui/Controls/Checkbox';
import { Radio } from '../../ui/Controls/Radio';
import { Input } from '../../ui/Controls/Input';
import { Textarea } from '../../ui/Controls/Textarea';
import { toNumber } from '../../../helpers/form';
const certificateSourceOptions = [
    {
        label: i18next.t('encryption_certificates_source_path'),
        value: ENCRYPTION_SOURCE.PATH,
    },
    {
        label: i18next.t('encryption_certificates_source_content'),
        value: ENCRYPTION_SOURCE.CONTENT,
    },
];
const keySourceOptions = [
    {
        label: i18next.t('encryption_key_source_path'),
        value: ENCRYPTION_SOURCE.PATH,
    },
    {
        label: i18next.t('encryption_key_source_content'),
        value: ENCRYPTION_SOURCE.CONTENT,
    },
];
const validationMessage = (warningValidation, isWarning) => {
    if (!warningValidation) {
        return null;
    }
    if (isWarning) {
        return (React.createElement("div", { className: "col-12" },
            React.createElement("p", null,
                React.createElement(Trans, null, "encryption_warning"),
                ": ",
                warningValidation)));
    }
    return (React.createElement("div", { className: "col-12" },
        React.createElement("p", { className: "text-danger" }, warningValidation)));
};
const buildPathPairStatusMap = (statuses) => new Map(statuses.map((pairStatus) => [
    `${pairStatus.certificate_path}\n${pairStatus.private_key_path}`,
    pairStatus,
]));
const getPathPairStatus = (pathPairStatusMap, pair) => {
    if (!pair) {
        return undefined;
    }
    return pathPairStatusMap.get(`${pair.certificate_path}\n${pair.private_key_path}`);
};
const defaultValues = {
    enabled: false,
    serve_plain_dns: true,
    panel_server_name: '',
    panel_server_url_path: '/',
    panel_server_port: undefined,
    server_name: '',
    dns_over_quic_url_path: '/dns-query',
    force_https: false,
    port_https: STANDARD_HTTPS_PORT,
    port_dns_over_tls: DNS_OVER_TLS_PORT,
    port_dns_over_quic: DNS_OVER_QUIC_PORT,
    port_dnscrypt: 0,
    certificate_chain: '',
    private_key: '',
    certificate_path: '',
    certificate_key_pairs: [{ certificate_path: '', private_key_path: '' }],
    private_key_path: '',
    certificate_source: ENCRYPTION_SOURCE.PATH,
    key_source: ENCRYPTION_SOURCE.PATH,
    private_key_saved: false,
    panel_certificate_chain: '',
    panel_private_key: '',
    panel_certificate_path: '',
    panel_certificate_key_pairs: [{ certificate_path: '', private_key_path: '' }],
    panel_private_key_path: '',
    panel_certificate_source: ENCRYPTION_SOURCE.PATH,
    panel_key_source: ENCRYPTION_SOURCE.PATH,
    panel_private_key_saved: false,
};
export const Form = ({ initialValues, encryption, onSubmit, setTlsConfig, debouncedConfigValidation, validateTlsConfig, }) => {
    const { t } = useTranslation();
    const { not_after, valid_chain, valid_key, valid_cert, valid_pair, dns_names, key_type, issuer, subject, warning_validation, can_apply, panel_not_after, panel_valid_chain, panel_valid_key, panel_valid_cert, panel_valid_pair, panel_dns_names, panel_key_type, panel_issuer, panel_subject, panel_warning_validation, panel_can_apply, processingConfig, processingValidate, dns_assigned_certificate_ids, panel_assigned_certificate_ids, } = encryption;
    const { control, handleSubmit, watch, reset, setValue, getValues, trigger, formState: { isSubmitting, isValid }, } = useForm({
        defaultValues: {
            ...defaultValues,
            ...initialValues,
        },
        mode: 'onBlur',
    });
    const { fields: certificateKeyPairFields, append: appendCertificatePathPair, remove: removeCertificatePathPair, } = useFieldArray({
        control,
        name: 'certificate_key_pairs',
    });
    const { fields: panelCertificateKeyPairFields, append: appendPanelCertificatePathPair, remove: removePanelCertificatePathPair, } = useFieldArray({
        control,
        name: 'panel_certificate_key_pairs',
    });
    const { enabled: isEnabled, serve_plain_dns: servePlainDns, panel_server_port: panelServerPort, port_https: portHTTPS, port_dns_over_tls: portDNSOverTLS, port_dns_over_quic: portDNSOverQUIC, certificate_chain: certificateChain, private_key: privateKey, certificate_key_pairs: certificateKeyPairs = [], private_key_path: privateKeyPath, key_source: privateKeySource, private_key_saved: privateKeySaved, certificate_path: certificatePath, certificate_source: certificateSource, panel_certificate_chain: panelCertificateChain, panel_private_key: panelPrivateKey, panel_certificate_key_pairs: panelCertificateKeyPairs = [], panel_private_key_path: panelPrivateKeyPath, panel_key_source: panelPrivateKeySource, panel_private_key_saved: panelPrivateKeySaved, panel_certificate_path: panelCertificatePath, panel_certificate_source: panelCertificateSource, } = watch();
    const dnsUsePathPairs = certificateSource === ENCRYPTION_SOURCE.PATH && privateKeySource === ENCRYPTION_SOURCE.PATH;
    const panelUsePathPairs = panelCertificateSource === ENCRYPTION_SOURCE.PATH
        && panelPrivateKeySource === ENCRYPTION_SOURCE.PATH;
    const dnsManaged = dns_assigned_certificate_ids.length > 0;
    const panelManaged = panel_assigned_certificate_ids.length > 0;
    const dnsCertificatesRequired = Boolean(isEnabled && (portHTTPS || portDNSOverTLS || portDNSOverQUIC));
    const panelCertificatesRequired = Boolean(isEnabled);
    const dnsIsWarning = can_apply && valid_key && valid_cert && valid_pair;
    const panelIsWarning = panel_can_apply && panel_valid_key && panel_valid_cert && panel_valid_pair;
    const dnsPathPairStatusMap = buildPathPairStatusMap(encryption.certificate_key_pair_statuses);
    const panelPathPairStatusMap = buildPathPairStatusMap(encryption.panel_certificate_key_pair_statuses);
    useEffect(() => {
        void trigger(['panel_server_port', 'port_https', 'port_dns_over_tls']);
    }, [isEnabled, panelServerPort, portHTTPS, portDNSOverTLS, trigger]);
    const validatePathPairField = (fieldArrayName, index, value, siblingField) => validatePairedValue(value, getValues(`${fieldArrayName}.${index}.${siblingField}`));
    const handleBlur = () => {
        debouncedConfigValidation(getValues());
    };
    const validatePanelServerPortValue = (value) => {
        if (!isEnabled) {
            return true;
        }
        if (!value) {
            return '启用加密后，必须单独设置面板 HTTPS 端口。';
        }
        if (portHTTPS && value === portHTTPS) {
            return '面板 HTTPS 端口不能与 DNS-over-HTTPS 端口相同。';
        }
        if (portDNSOverTLS && value === portDNSOverTLS) {
            return '面板 HTTPS 端口不能与 DNS-over-TLS 端口相同。';
        }
        return true;
    };
    const validateHTTPSPortValue = (value) => {
        if (panelServerPort && value && value === panelServerPort) {
            return 'DNS-over-HTTPS 端口不能与面板 HTTPS 端口相同。';
        }
        if (portDNSOverTLS && value && value === portDNSOverTLS) {
            return i18next.t('form_error_equal');
        }
        return true;
    };
    const validateTLSPortValue = (value) => {
        if (panelServerPort && value && value === panelServerPort) {
            return 'DNS-over-TLS 端口不能与面板 HTTPS 端口相同。';
        }
        if (portHTTPS && value && value === portHTTPS) {
            return i18next.t('form_error_equal');
        }
        return true;
    };
    const isSavingDisabled = () => {
        const processing = isSubmitting || processingConfig || processingValidate;
        const dnsCanSave = !dnsCertificatesRequired || (valid_key && valid_cert && valid_pair && can_apply);
        const panelCanSave = !panelCertificatesRequired
            || (panel_valid_key && panel_valid_cert && panel_valid_pair && panel_can_apply);
        if (servePlainDns && !isEnabled) {
            return !isValid || processing;
        }
        return !isValid || processing || !dnsCanSave || !panelCanSave;
    };
    const clearFields = () => {
        if (window.confirm(t('encryption_reset'))) {
            debouncedConfigValidation.cancel();
            reset(defaultValues);
            setTlsConfig(defaultValues);
            validateTlsConfig(defaultValues);
        }
    };
    const removePathPair = (fieldName, fieldLength, removeField, index) => {
        if (fieldLength === 1) {
            setValue(`${fieldName}.0.certificate_path`, '');
            setValue(`${fieldName}.0.private_key_path`, '');
            return;
        }
        removeField(index);
    };
    const renderPathPairActions = (index, usePathPairs, onAppend, onRemove, disabled) => (React.createElement("span", { className: "input-group-append" },
        usePathPairs && (React.createElement("button", { type: "button", className: "btn btn-secondary btn-icon", onClick: onAppend, disabled: disabled },
            React.createElement("svg", { className: "icon icon--24" },
                React.createElement("use", { xlinkHref: "#plus" })))),
        React.createElement("button", { type: "button", className: "btn btn-secondary btn-icon", onClick: onRemove, disabled: disabled },
            React.createElement("svg", { className: "icon icon--24" },
                React.createElement("use", { xlinkHref: "#delete" })))));
    const renderManagedPathPairs = (statuses, assignedIDs, warningMessage, isWarning) => (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "form__desc form__desc--top" },
            "\u5F53\u524D\u7531\u8BC1\u4E66\u7BA1\u7406\u63A5\u7BA1\uFF1A\u8BC1\u4E66 ID ",
            assignedIDs.join(', '),
            "\u3002\u624B\u52A8\u8BC1\u4E66\u4E0E\u79C1\u94A5\u5DF2\u9501\u5B9A\uFF0C\u4F46\u539F\u6709\u624B\u52A8\u914D\u7F6E\u4ECD\u4F1A\u4FDD\u7559\u3002"),
        statuses.length === 0 ? (React.createElement("div", { className: "form__desc" }, "\u6682\u672A\u8BFB\u53D6\u5230\u6258\u7BA1\u8BC1\u4E66\u8DEF\u5F84\uFF0C\u8BF7\u68C0\u67E5\u8BC1\u4E66\u5E93\u5B58\u6216\u91CD\u65B0\u9A8C\u8BC1\u5F53\u524D\u914D\u7F6E\u3002")) : (statuses.map((pairStatus, index) => (React.createElement("div", { key: `${pairStatus.certificate_path}\n${pairStatus.private_key_path}\n${index}`, className: "mb-3" },
            React.createElement(Input, { type: "text", value: pairStatus.certificate_path || '', placeholder: `证书路径 ${index + 1}`, disabled: true, readOnly: true }),
            pairStatus.certificate_path && (React.createElement("div", { className: "form__status" },
                React.createElement(CertificateStatus, { validChain: pairStatus.valid_chain, validCert: pairStatus.valid_cert, subject: pairStatus.subject, issuer: pairStatus.issuer, notAfter: pairStatus.not_after, dnsNames: pairStatus.dns_names || [] }))),
            React.createElement(Input, { type: "text", value: pairStatus.private_key_path || '', placeholder: `私钥路径 ${index + 1}`, disabled: true, readOnly: true }),
            pairStatus.private_key_path && (React.createElement("div", { className: "form__status" },
                React.createElement(KeyStatus, { validKey: pairStatus.valid_key, keyType: pairStatus.key_type }))),
            pairStatus.warning_validation && (React.createElement("div", { className: "form__desc text-danger mt-2" }, pairStatus.warning_validation)))))),
        validationMessage(warningMessage, isWarning)));
    const renderCertificateInput = (target) => {
        const isPanel = target === 'panel';
        const managed = isPanel ? panelManaged : dnsManaged;
        const usePathPairs = isPanel ? panelUsePathPairs : dnsUsePathPairs;
        const currentCertificateSource = isPanel ? panelCertificateSource : certificateSource;
        const fields = isPanel ? panelCertificateKeyPairFields : certificateKeyPairFields;
        const pathPairs = isPanel ? panelCertificateKeyPairs : certificateKeyPairs;
        const pathPairStatusMap = isPanel ? panelPathPairStatusMap : dnsPathPairStatusMap;
        const assignedIDs = isPanel ? panel_assigned_certificate_ids : dns_assigned_certificate_ids;
        const warningMessage = isPanel ? panel_warning_validation : warning_validation;
        const isWarning = isPanel ? panelIsWarning : dnsIsWarning;
        const pairFieldName = isPanel ? 'panel_certificate_key_pairs' : 'certificate_key_pairs';
        if (managed) {
            return renderManagedPathPairs(isPanel ? encryption.panel_certificate_key_pair_statuses : encryption.certificate_key_pair_statuses, assignedIDs, warningMessage, isWarning);
        }
        if (currentCertificateSource === ENCRYPTION_SOURCE.CONTENT) {
            return (React.createElement(Controller, { name: isPanel ? 'panel_certificate_chain' : 'certificate_chain', control: control, render: ({ field, fieldState }) => {
                    var _a;
                    return (React.createElement(Textarea, { ...field, placeholder: t('encryption_certificates_input'), disabled: !isEnabled, error: (_a = fieldState.error) === null || _a === void 0 ? void 0 : _a.message, onBlur: handleBlur }));
                } }));
        }
        if (usePathPairs) {
            return fields.map((pathPairField, index) => {
                var _a;
                const pairStatus = getPathPairStatus(pathPairStatusMap, pathPairs[index]);
                const onAppend = isPanel
                    ? () => appendPanelCertificatePathPair({ certificate_path: '', private_key_path: '' })
                    : () => appendCertificatePathPair({ certificate_path: '', private_key_path: '' });
                const onRemove = () => removePathPair(pairFieldName, fields.length, isPanel ? removePanelCertificatePathPair : removeCertificatePathPair, index);
                return (React.createElement("div", { key: pathPairField.id, className: "mb-2" },
                    React.createElement(Controller, { name: `${pairFieldName}.${index}.certificate_path`, control: control, rules: {
                            validate: {
                                validateAbsolutePath,
                                validatePairedValue: (value) => validatePathPairField(pairFieldName, index, value, 'private_key_path'),
                            },
                        }, render: ({ field, fieldState }) => {
                            var _a;
                            return (React.createElement(Input, { ...field, type: "text", placeholder: `${t('encryption_certificate_path')} ${index + 1}`, error: (_a = fieldState.error) === null || _a === void 0 ? void 0 : _a.message, disabled: !isEnabled, trimOnBlur: true, rightAddon: renderPathPairActions(index, usePathPairs, onAppend, onRemove, !isEnabled), onBlur: handleBlur }));
                        } }),
                    ((_a = pathPairs[index]) === null || _a === void 0 ? void 0 : _a.certificate_path) && pairStatus && (React.createElement("div", { className: "form__status" },
                        React.createElement(CertificateStatus, { validChain: pairStatus.valid_chain, validCert: pairStatus.valid_cert, subject: pairStatus.subject, issuer: pairStatus.issuer, notAfter: pairStatus.not_after, dnsNames: pairStatus.dns_names || [] })))));
            });
        }
        return (React.createElement(Controller, { name: isPanel ? 'panel_certificate_path' : 'certificate_path', control: control, rules: { validate: validateAbsolutePath }, render: ({ field, fieldState }) => {
                var _a;
                return (React.createElement(Input, { ...field, type: "text", placeholder: t('encryption_certificate_path'), error: (_a = fieldState.error) === null || _a === void 0 ? void 0 : _a.message, disabled: !isEnabled, trimOnBlur: true, onBlur: handleBlur }));
            } }));
    };
    const renderPrivateKeyInput = (target) => {
        const isPanel = target === 'panel';
        const managed = isPanel ? panelManaged : dnsManaged;
        const usePathPairs = isPanel ? panelUsePathPairs : dnsUsePathPairs;
        const currentPrivateKeySource = isPanel ? panelPrivateKeySource : privateKeySource;
        const fields = isPanel ? panelCertificateKeyPairFields : certificateKeyPairFields;
        const pathPairs = isPanel ? panelCertificateKeyPairs : certificateKeyPairs;
        const pathPairStatusMap = isPanel ? panelPathPairStatusMap : dnsPathPairStatusMap;
        const pairFieldName = isPanel ? 'panel_certificate_key_pairs' : 'certificate_key_pairs';
        const currentPrivateKeySaved = isPanel ? panelPrivateKeySaved : privateKeySaved;
        if (managed) {
            return null;
        }
        if (currentPrivateKeySource === ENCRYPTION_SOURCE.CONTENT) {
            return (React.createElement(React.Fragment, null,
                React.createElement(Controller, { name: isPanel ? 'panel_private_key_saved' : 'private_key_saved', control: control, render: ({ field }) => (React.createElement(Checkbox, { ...field, title: t('use_saved_key'), disabled: !isEnabled, onChange: (checked) => {
                            if (checked) {
                                setValue(isPanel ? 'panel_private_key' : 'private_key', '');
                            }
                            field.onChange(checked);
                        }, onBlur: handleBlur })) }),
                React.createElement(Controller, { name: isPanel ? 'panel_private_key' : 'private_key', control: control, render: ({ field, fieldState }) => {
                        var _a;
                        return (React.createElement(Textarea, { ...field, placeholder: t('encryption_key_input'), disabled: !isEnabled || currentPrivateKeySaved, error: (_a = fieldState.error) === null || _a === void 0 ? void 0 : _a.message, onBlur: handleBlur }));
                    } })));
        }
        if (usePathPairs) {
            return fields.map((pathPairField, index) => {
                var _a;
                const pairStatus = getPathPairStatus(pathPairStatusMap, pathPairs[index]);
                const onAppend = isPanel
                    ? () => appendPanelCertificatePathPair({ certificate_path: '', private_key_path: '' })
                    : () => appendCertificatePathPair({ certificate_path: '', private_key_path: '' });
                const onRemove = () => removePathPair(pairFieldName, fields.length, isPanel ? removePanelCertificatePathPair : removeCertificatePathPair, index);
                return (React.createElement("div", { key: pathPairField.id, className: "mb-2" },
                    React.createElement(Controller, { name: `${pairFieldName}.${index}.private_key_path`, control: control, rules: {
                            validate: {
                                validateAbsolutePath,
                                validatePairedValue: (value) => validatePathPairField(pairFieldName, index, value, 'certificate_path'),
                            },
                        }, render: ({ field, fieldState }) => {
                            var _a;
                            return (React.createElement(Input, { ...field, type: "text", placeholder: `${t('encryption_private_key_path')} ${index + 1}`, error: (_a = fieldState.error) === null || _a === void 0 ? void 0 : _a.message, disabled: !isEnabled, trimOnBlur: true, rightAddon: renderPathPairActions(index, usePathPairs, onAppend, onRemove, !isEnabled), onBlur: handleBlur }));
                        } }),
                    ((_a = pathPairs[index]) === null || _a === void 0 ? void 0 : _a.private_key_path) && pairStatus && (React.createElement("div", { className: "form__status" },
                        React.createElement(KeyStatus, { validKey: pairStatus.valid_key, keyType: pairStatus.key_type })))));
            });
        }
        return (React.createElement(Controller, { name: isPanel ? 'panel_private_key_path' : 'private_key_path', control: control, rules: { validate: validateAbsolutePath }, render: ({ field, fieldState }) => {
                var _a;
                return (React.createElement(Input, { ...field, type: "text", placeholder: t('encryption_private_key_path'), error: (_a = fieldState.error) === null || _a === void 0 ? void 0 : _a.message, disabled: !isEnabled, trimOnBlur: true, onBlur: handleBlur }));
            } }));
    };
    const renderSingleStatus = (target) => {
        const isPanel = target === 'panel';
        const managed = isPanel ? panelManaged : dnsManaged;
        const usePathPairs = isPanel ? panelUsePathPairs : dnsUsePathPairs;
        const currentCertificateChain = isPanel ? panelCertificateChain : certificateChain;
        const currentCertificatePath = isPanel ? panelCertificatePath : certificatePath;
        const currentPrivateKey = isPanel ? panelPrivateKey : privateKey;
        const currentPrivateKeyPath = isPanel ? panelPrivateKeyPath : privateKeyPath;
        const currentValidChain = isPanel ? panel_valid_chain : valid_chain;
        const currentValidCert = isPanel ? panel_valid_cert : valid_cert;
        const currentSubject = isPanel ? panel_subject : subject;
        const currentIssuer = isPanel ? panel_issuer : issuer;
        const currentNotAfter = isPanel ? panel_not_after : not_after;
        const currentDNSNames = isPanel ? panel_dns_names : dns_names;
        const currentValidKey = isPanel ? panel_valid_key : valid_key;
        const currentKeyType = isPanel ? panel_key_type : key_type;
        return (React.createElement(React.Fragment, null,
            !managed && !usePathPairs && (currentCertificateChain || currentCertificatePath) && (React.createElement("div", { className: "form__status" },
                React.createElement(CertificateStatus, { validChain: currentValidChain, validCert: currentValidCert, subject: currentSubject, issuer: currentIssuer, notAfter: currentNotAfter, dnsNames: currentDNSNames || [] }))),
            !managed && !usePathPairs && (currentPrivateKey || currentPrivateKeyPath) && (React.createElement("div", { className: "form__status" },
                React.createElement(KeyStatus, { validKey: currentValidKey, keyType: currentKeyType })))));
    };
    const onFormSubmit = async (data) => {
        debouncedConfigValidation.cancel();
        await onSubmit(data);
    };
    const isDisabled = isSavingDisabled();
    return (React.createElement("form", { onSubmit: handleSubmit(onFormSubmit) },
        React.createElement("div", { className: "row" },
            React.createElement("div", { className: "col-12" },
                React.createElement("div", { className: "form__group form__group--settings mb-3" },
                    React.createElement(Controller, { name: "enabled", control: control, render: ({ field }) => (React.createElement(Checkbox, { ...field, title: t('encryption_enable'), onBlur: handleBlur })) })),
                React.createElement("div", { className: "form__desc" },
                    React.createElement(Trans, null, "encryption_enable_desc")),
                React.createElement("div", { className: "form__group mb-3 mt-5" },
                    React.createElement(Controller, { name: "serve_plain_dns", control: control, rules: {
                            validate: (value) => validatePlainDns(value, getValues()),
                        }, render: ({ field }) => React.createElement(Checkbox, { ...field, title: t('encryption_plain_dns_enable') }) })),
                React.createElement("div", { className: "form__desc" },
                    React.createElement(Trans, null, "encryption_plain_dns_desc")),
                React.createElement("div", { className: "form__group form__group--settings mt-4" },
                    React.createElement(Controller, { name: "force_https", control: control, render: ({ field }) => (React.createElement(Checkbox, { ...field, title: t('encryption_redirect'), disabled: !isEnabled })) }),
                    React.createElement("div", { className: "form__desc" },
                        React.createElement(Trans, null, "encryption_redirect_desc"))),
                React.createElement("hr", null))),
        React.createElement("div", { className: "row" },
            React.createElement("div", { className: "col-lg-6" },
                React.createElement("div", { className: "form__group form__group--settings" },
                    React.createElement("label", { className: "form__label", htmlFor: "panel_server_name" },
                        React.createElement(Trans, null, "encryption_panel_server_name")),
                    React.createElement(Controller, { name: "panel_server_name", control: control, rules: { validate: validateServerName }, render: ({ field, fieldState }) => {
                            var _a;
                            return (React.createElement(Input, { ...field, type: "text", placeholder: t('encryption_panel_server_name_enter'), error: (_a = fieldState.error) === null || _a === void 0 ? void 0 : _a.message, disabled: !isEnabled, onBlur: handleBlur }));
                        } }),
                    React.createElement("div", { className: "form__desc" },
                        React.createElement(Trans, null, "encryption_panel_server_name_desc")))),
            React.createElement("div", { className: "col-lg-6" },
                React.createElement("div", { className: "form__group form__group--settings" },
                    React.createElement("label", { className: "form__label", htmlFor: "panel_server_url_path" },
                        React.createElement(Trans, null, "encryption_panel_server_url_path")),
                    React.createElement(Controller, { name: "panel_server_url_path", control: control, rules: { validate: validateURLPathPrefix }, render: ({ field, fieldState }) => {
                            var _a;
                            return (React.createElement(Input, { ...field, type: "text", placeholder: t('encryption_panel_server_url_path_placeholder'), error: (_a = fieldState.error) === null || _a === void 0 ? void 0 : _a.message, disabled: !isEnabled, trimOnBlur: true, onBlur: handleBlur }));
                        } }),
                    React.createElement("div", { className: "form__desc" },
                        React.createElement(Trans, null, "encryption_panel_server_url_path_desc")))),
            React.createElement("div", { className: "col-lg-6" },
                React.createElement("div", { className: "form__group form__group--settings" },
                    React.createElement("label", { className: "form__label", htmlFor: "panel_server_port" },
                        React.createElement(Trans, null, "encryption_panel_server_port")),
                    React.createElement(Controller, { name: "panel_server_port", control: control, rules: {
                            validate: {
                                validateInstallPort,
                                validateIsSafePort,
                                validatePanelServerPortValue,
                            },
                        }, render: ({ field, fieldState }) => {
                            var _a;
                            return (React.createElement(Input, { ...field, type: "number", placeholder: t('encryption_panel_server_port_placeholder'), error: (_a = fieldState.error) === null || _a === void 0 ? void 0 : _a.message, disabled: !isEnabled, onChange: (e) => {
                                    const { value } = e.target;
                                    field.onChange(toNumber(value));
                                }, onBlur: handleBlur }));
                        } }),
                    React.createElement("div", { className: "form__desc" }, "\u542F\u7528\u52A0\u5BC6\u540E\uFF0C\u9762\u677F\u4E0E DNS \u52A0\u5BC6\u5FC5\u987B\u4F7F\u7528\u4E0D\u540C\u7AEF\u53E3\uFF1B\u68C0\u6D4B\u5230\u91CD\u590D\u7AEF\u53E3\u65F6\u5C06\u7981\u6B62\u4FDD\u5B58\u3002")))),
        React.createElement("div", { className: "row" },
            React.createElement("div", { className: "col-lg-6" },
                React.createElement("div", { className: "form__group form__group--settings" },
                    React.createElement("label", { className: "form__label", htmlFor: "server_name" },
                        React.createElement(Trans, null, "encryption_server")),
                    React.createElement(Controller, { name: "server_name", control: control, rules: { validate: validateServerName }, render: ({ field, fieldState }) => {
                            var _a;
                            return (React.createElement(Input, { ...field, type: "text", placeholder: t('encryption_server_enter'), error: (_a = fieldState.error) === null || _a === void 0 ? void 0 : _a.message, disabled: !isEnabled, onBlur: handleBlur }));
                        } }),
                    React.createElement("div", { className: "form__desc" },
                        React.createElement(Trans, null, "encryption_server_desc")))),
            React.createElement("div", { className: "col-lg-6" },
                React.createElement("div", { className: "form__group form__group--settings" },
                    React.createElement("label", { className: "form__label", htmlFor: "dns_over_quic_url_path" },
                        React.createElement(Trans, null, "encryption_doq_path")),
                    React.createElement(Controller, { name: "dns_over_quic_url_path", control: control, rules: { validate: validateURLPathPrefix }, render: ({ field, fieldState }) => {
                            var _a;
                            return (React.createElement(Input, { ...field, type: "text", placeholder: t('encryption_doq_path_placeholder'), error: (_a = fieldState.error) === null || _a === void 0 ? void 0 : _a.message, disabled: !isEnabled, trimOnBlur: true, onBlur: handleBlur }));
                        } }),
                    React.createElement("div", { className: "form__desc" },
                        React.createElement(Trans, null, "encryption_doq_path_desc"))))),
        React.createElement("div", { className: "row" },
            React.createElement("div", { className: "col-lg-6" },
                React.createElement("div", { className: "form__group form__group--settings" },
                    React.createElement("label", { className: "form__label", htmlFor: "port_https" },
                        React.createElement(Trans, null, "encryption_https")),
                    React.createElement(Controller, { name: "port_https", control: control, rules: {
                            validate: {
                                validatePort,
                                validateIsSafePort,
                                validateHTTPSPortValue,
                            },
                        }, render: ({ field, fieldState }) => {
                            var _a;
                            return (React.createElement(Input, { ...field, type: "number", placeholder: t('encryption_https'), error: (_a = fieldState.error) === null || _a === void 0 ? void 0 : _a.message, disabled: !isEnabled, onChange: (e) => {
                                    const { value } = e.target;
                                    field.onChange(toNumber(value));
                                }, onBlur: handleBlur }));
                        } }),
                    React.createElement("div", { className: "form__desc" },
                        React.createElement(Trans, null, "encryption_https_desc"))),
                React.createElement("div", { className: "form__group form__group--settings" },
                    React.createElement("label", { className: "form__label", htmlFor: "port_dns_over_quic" },
                        React.createElement(Trans, null, "encryption_doq")),
                    React.createElement(Controller, { name: "port_dns_over_quic", control: control, rules: { validate: validatePortQuic }, render: ({ field, fieldState }) => {
                            var _a;
                            return (React.createElement(Input, { ...field, type: "number", placeholder: t('encryption_doq'), error: (_a = fieldState.error) === null || _a === void 0 ? void 0 : _a.message, disabled: !isEnabled, onChange: (e) => {
                                    const { value } = e.target;
                                    field.onChange(toNumber(value));
                                }, onBlur: handleBlur }));
                        } }),
                    React.createElement("div", { className: "form__desc" },
                        React.createElement(Trans, null, "encryption_doq_desc"))),
                React.createElement("div", { className: "form__group form__group--settings" },
                    React.createElement("label", { className: "form__label", htmlFor: "port_dns_over_tls" },
                        React.createElement(Trans, null, "encryption_dot")),
                    React.createElement(Controller, { name: "port_dns_over_tls", control: control, rules: {
                            validate: {
                                validatePortTLS,
                                validateTLSPortValue,
                            },
                        }, render: ({ field, fieldState }) => {
                            var _a;
                            return (React.createElement(Input, { ...field, type: "number", placeholder: t('encryption_dot'), error: (_a = fieldState.error) === null || _a === void 0 ? void 0 : _a.message, disabled: !isEnabled, onChange: (e) => {
                                    const { value } = e.target;
                                    field.onChange(toNumber(value));
                                }, onBlur: handleBlur }));
                        } }),
                    React.createElement("div", { className: "form__desc" },
                        React.createElement(Trans, null, "encryption_dot_desc"))))),
        React.createElement("div", { className: "row" },
            React.createElement("div", { className: "col-12" },
                React.createElement("hr", null),
                React.createElement("div", { className: "form__group form__group--settings" },
                    React.createElement("label", { className: "form__label form__label--bold" }, "\u9762\u677F\u8BC1\u4E66"),
                    React.createElement("div", { className: "form__desc form__desc--top" }, "\u7528\u4E8E\u9762\u677F HTTPS\u3002\u8FD9\u91CC\u4E0E DNS \u52A0\u5BC6\u8BC1\u4E66\u5F7B\u5E95\u5206\u5F00\uFF0C\u8BC1\u4E66\u7BA1\u7406\u63A5\u7BA1\u540E\u5C06\u81EA\u52A8\u9501\u5B9A\u624B\u52A8\u8F93\u5165\u3002"),
                    !panelManaged && (React.createElement("div", { className: "form__inline mb-2" },
                        React.createElement("div", { className: "custom-controls-stacked" },
                            React.createElement(Controller, { name: "panel_certificate_source", control: control, render: ({ field }) => (React.createElement(Radio, { ...field, options: certificateSourceOptions, disabled: !isEnabled })) })))),
                    renderCertificateInput('panel'),
                    renderSingleStatus('panel')),
                !panelManaged && (React.createElement("div", { className: "form__group form__group--settings mt-3" },
                    React.createElement("label", { className: "form__label form__label--bold", htmlFor: "panel_private_key" }, "\u9762\u677F\u79C1\u94A5"),
                    React.createElement("div", { className: "form__inline mb-2" },
                        React.createElement("div", { className: "custom-controls-stacked" },
                            React.createElement(Controller, { name: "panel_key_source", control: control, render: ({ field }) => (React.createElement(Radio, { ...field, options: keySourceOptions, disabled: !isEnabled })) }))),
                    renderPrivateKeyInput('panel'))),
                !panelManaged && validationMessage(panel_warning_validation, panelIsWarning))),
        React.createElement("div", { className: "row" },
            React.createElement("div", { className: "col-12" },
                React.createElement("hr", null),
                React.createElement("div", { className: "form__group form__group--settings" },
                    React.createElement("label", { className: "form__label form__label--with-desc form__label--bold", htmlFor: "certificate_chain" }, "DNS \u52A0\u5BC6\u8BC1\u4E66"),
                    React.createElement("div", { className: "form__desc form__desc--top" }, "\u7528\u4E8E DNS-over-HTTPS\u3001DNS-over-TLS\u3001DNS-over-QUIC\u3002"),
                    !dnsManaged && (React.createElement("div", { className: "form__inline mb-2" },
                        React.createElement("div", { className: "custom-controls-stacked" },
                            React.createElement(Controller, { name: "certificate_source", control: control, render: ({ field }) => (React.createElement(Radio, { ...field, options: certificateSourceOptions, disabled: !isEnabled })) })))),
                    renderCertificateInput('dns'),
                    renderSingleStatus('dns')),
                !dnsManaged && (React.createElement("div", { className: "form__group form__group--settings mt-3" },
                    React.createElement("label", { className: "form__label form__label--bold", htmlFor: "private_key" },
                        React.createElement(Trans, null, "encryption_key")),
                    React.createElement("div", { className: "form__inline mb-2" },
                        React.createElement("div", { className: "custom-controls-stacked" },
                            React.createElement(Controller, { name: "key_source", control: control, render: ({ field }) => (React.createElement(Radio, { ...field, options: keySourceOptions, disabled: !isEnabled })) }))),
                    renderPrivateKeyInput('dns'))),
                !dnsManaged && validationMessage(warning_validation, dnsIsWarning))),
        React.createElement("div", { className: "btn-list mt-2" },
            React.createElement("button", { type: "submit", disabled: isDisabled, className: "btn btn-success btn-standart" },
                React.createElement(Trans, null, "save_config")),
            React.createElement("button", { type: "button", className: "btn btn-secondary btn-standart", disabled: isSubmitting || processingConfig, onClick: clearFields },
                React.createElement(Trans, null, "reset_settings")))));
};

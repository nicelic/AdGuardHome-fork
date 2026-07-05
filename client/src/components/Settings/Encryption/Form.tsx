import React from 'react';

import { Trans, useTranslation } from 'react-i18next';

import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { DebouncedFunc } from 'lodash';
import i18next from 'i18next';
import {
    validateServerName,
    validateIsSafePort,
    validateInstallPort,
    validatePort,
    validatePortQuic,
    validatePortTLS,
    validatePlainDns,
    validateAbsolutePath,
    validateURLPathPrefix,
    validatePairedValue,
} from '../../../helpers/validators';

import KeyStatus from './KeyStatus';

import CertificateStatus from './CertificateStatus';
import {
    DNS_OVER_QUIC_PORT,
    DNS_OVER_TLS_PORT,
    STANDARD_HTTPS_PORT,
    ENCRYPTION_SOURCE,
} from '../../../helpers/constants';
import { Checkbox } from '../../ui/Controls/Checkbox';
import { Radio } from '../../ui/Controls/Radio';
import { Input } from '../../ui/Controls/Input';
import { Textarea } from '../../ui/Controls/Textarea';
import type { EncryptionData, EncryptionPathPair, EncryptionPathPairStatus } from '../../../initialState';
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

const validationMessage = (warningValidation: string, isWarning: boolean) => {
    if (!warningValidation) {
        return null;
    }

    if (isWarning) {
        return (
            <div className="col-12">
                <p>
                    <Trans>encryption_warning</Trans>: {warningValidation}
                </p>
            </div>
        );
    }

    return (
        <div className="col-12">
            <p className="text-danger">{warningValidation}</p>
        </div>
    );
};

const buildPathPairStatusMap = (statuses: EncryptionPathPairStatus[]) => new Map<string, EncryptionPathPairStatus>(
    statuses.map((pairStatus) => [
        `${pairStatus.certificate_path}\n${pairStatus.private_key_path}`,
        pairStatus,
    ]),
);

const getPathPairStatus = (
    pathPairStatusMap: Map<string, EncryptionPathPairStatus>,
    pair?: EncryptionPathPair,
) => {
    if (!pair) {
        return undefined;
    }

    return pathPairStatusMap.get(`${pair.certificate_path}\n${pair.private_key_path}`);
};

export type EncryptionFormValues = {
    enabled?: boolean;
    serve_plain_dns?: boolean;
    panel_server_name?: string;
    panel_server_url_path?: string;
    panel_server_port?: number;
    server_name?: string;
    dns_over_quic_url_path?: string;
    force_https?: boolean;
    port_https?: number;
    port_dns_over_tls?: number;
    port_dns_over_quic?: number;
    port_dnscrypt?: number;
    certificate_chain?: string;
    private_key?: string;
    certificate_path?: string;
    certificate_key_pairs?: EncryptionPathPair[];
    private_key_path?: string;
    certificate_source?: string;
    key_source?: string;
    private_key_saved?: boolean;
    panel_certificate_chain?: string;
    panel_private_key?: string;
    panel_certificate_path?: string;
    panel_certificate_key_pairs?: EncryptionPathPair[];
    panel_private_key_path?: string;
    panel_certificate_source?: string;
    panel_key_source?: string;
    panel_private_key_saved?: boolean;
};

type Props = {
    initialValues: EncryptionFormValues;
    encryption: EncryptionData;
    onSubmit: (values: EncryptionFormValues) => Promise<void>;
    debouncedConfigValidation: DebouncedFunc<(values: EncryptionFormValues) => void>;
    setTlsConfig: (values: Partial<EncryptionData>) => void;
    validateTlsConfig: (values: Partial<EncryptionData>) => Promise<Partial<EncryptionData> | null>;
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

export const Form = ({
    initialValues,
    encryption,
    onSubmit,
    setTlsConfig,
    debouncedConfigValidation,
    validateTlsConfig,
}: Props) => {
    const { t } = useTranslation();

    const {
        not_after,
        valid_chain,
        valid_key,
        valid_cert,
        valid_pair,
        dns_names,
        key_type,
        issuer,
        subject,
        warning_validation,
        can_apply,
        panel_not_after,
        panel_valid_chain,
        panel_valid_key,
        panel_valid_cert,
        panel_valid_pair,
        panel_dns_names,
        panel_key_type,
        panel_issuer,
        panel_subject,
        panel_warning_validation,
        panel_can_apply,
        processingConfig,
        processingValidate,
        dns_assigned_certificate_ids,
        panel_assigned_certificate_ids,
    } = encryption;

    const {
        control,
        handleSubmit,
        watch,
        reset,
        setValue,
        getValues,
        trigger,
        formState: { isSubmitting },
    } = useForm<EncryptionFormValues>({
        defaultValues: {
            ...defaultValues,
            ...initialValues,
        },
        mode: 'onSubmit',
        reValidateMode: 'onBlur',
    });

    const {
        fields: certificateKeyPairFields,
        append: appendCertificatePathPair,
        remove: removeCertificatePathPair,
    } = useFieldArray<EncryptionFormValues>({
        control,
        name: 'certificate_key_pairs',
    });

    const {
        fields: panelCertificateKeyPairFields,
        append: appendPanelCertificatePathPair,
        remove: removePanelCertificatePathPair,
    } = useFieldArray<EncryptionFormValues>({
        control,
        name: 'panel_certificate_key_pairs',
    });

    const {
        enabled: isEnabled,
        panel_server_port: panelServerPort,
        port_https: portHTTPS,
        port_dns_over_tls: portDNSOverTLS,
        certificate_chain: certificateChain,
        private_key: privateKey,
        certificate_key_pairs: certificateKeyPairs = [],
        private_key_path: privateKeyPath,
        key_source: privateKeySource,
        private_key_saved: privateKeySaved,
        certificate_path: certificatePath,
        certificate_source: certificateSource,
        panel_certificate_chain: panelCertificateChain,
        panel_private_key: panelPrivateKey,
        panel_certificate_key_pairs: panelCertificateKeyPairs = [],
        panel_private_key_path: panelPrivateKeyPath,
        panel_key_source: panelPrivateKeySource,
        panel_private_key_saved: panelPrivateKeySaved,
        panel_certificate_path: panelCertificatePath,
        panel_certificate_source: panelCertificateSource,
    } = watch();

    const dnsUsePathPairs = certificateSource === ENCRYPTION_SOURCE.PATH && privateKeySource === ENCRYPTION_SOURCE.PATH;
    const panelUsePathPairs = panelCertificateSource === ENCRYPTION_SOURCE.PATH
        && panelPrivateKeySource === ENCRYPTION_SOURCE.PATH;
    const dnsManaged = dns_assigned_certificate_ids.length > 0;
    const panelManaged = panel_assigned_certificate_ids.length > 0;
    const dnsIsWarning = can_apply && valid_key && valid_cert && valid_pair;
    const panelIsWarning = panel_can_apply && panel_valid_key && panel_valid_cert && panel_valid_pair;
    const dnsPathPairStatusMap = buildPathPairStatusMap(encryption.certificate_key_pair_statuses);
    const panelPathPairStatusMap = buildPathPairStatusMap(encryption.panel_certificate_key_pair_statuses);

    const validatePathPairField = (
        fieldArrayName: 'certificate_key_pairs' | 'panel_certificate_key_pairs',
        index: number,
        value: string,
        siblingField: 'certificate_path' | 'private_key_path',
    ) => validatePairedValue(value, getValues(`${fieldArrayName}.${index}.${siblingField}` as any));

    const runImmediateCertificateValidation = async (fieldNames?: any) => {
        const isFieldValid = fieldNames ? await trigger(fieldNames) : true;
        if (isFieldValid) {
            debouncedConfigValidation(getValues());
        }
    };

    const composeImmediateCertificateBlurHandler = (
        fieldOnBlur?: (...args: any[]) => void,
        fieldNames?: any,
    ) => (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        fieldOnBlur?.(event);
        runImmediateCertificateValidation(fieldNames);
    };

    const validatePanelServerPortValue = (value?: number) => {
        if (!isEnabled) {
            return true;
        }

        if (!value) {
            return t('encryption_panel_server_port_required');
        }

        if (portHTTPS && value === portHTTPS) {
            return t('encryption_panel_server_port_conflict_https');
        }

        if (portDNSOverTLS && value === portDNSOverTLS) {
            return t('encryption_panel_server_port_conflict_tls');
        }

        return true;
    };

    const validateHTTPSPortValue = (value?: number) => {
        if (panelServerPort && value && value === panelServerPort) {
            return t('encryption_https_port_conflict_panel');
        }

        if (portDNSOverTLS && value && value === portDNSOverTLS) {
            return i18next.t('form_error_equal');
        }

        return true;
    };

    const validateTLSPortValue = (value?: number) => {
        if (panelServerPort && value && value === panelServerPort) {
            return t('encryption_dot_port_conflict_panel');
        }

        if (portHTTPS && value && value === portHTTPS) {
            return i18next.t('form_error_equal');
        }

        return true;
    };

    const isSavingDisabled = () => {
        return isSubmitting || processingConfig || processingValidate;
    };

    const clearFields = () => {
        if (window.confirm(t('encryption_reset'))) {
            debouncedConfigValidation.cancel();
            reset(defaultValues);
            setTlsConfig(defaultValues);
            validateTlsConfig(defaultValues);
        }
    };

    const removePathPair = (
        fieldName: 'certificate_key_pairs' | 'panel_certificate_key_pairs',
        fieldLength: number,
        removeField: (index?: number | number[]) => void,
        index: number,
    ) => {
        if (fieldLength === 1) {
            setValue(`${fieldName}.0.certificate_path` as any, '');
            setValue(`${fieldName}.0.private_key_path` as any, '');

            return;
        }

        removeField(index);
    };

    const renderPathPairActions = (
        index: number,
        usePathPairs: boolean,
        onAppend: () => void,
        onRemove: () => void,
        disabled: boolean,
    ) => (
        <span className="input-group-append">
            {usePathPairs && (
                <button
                    type="button"
                    className="btn btn-secondary btn-icon"
                    onClick={onAppend}
                    disabled={disabled}>
                    <svg className="icon icon--24">
                        <use xlinkHref="#plus" />
                    </svg>
                </button>
            )}
            <button type="button" className="btn btn-secondary btn-icon" onClick={onRemove} disabled={disabled}>
                <svg className="icon icon--24">
                    <use xlinkHref="#delete" />
                </svg>
            </button>
        </span>
    );

    const renderManagedPathPairs = (
        statuses: EncryptionPathPairStatus[],
        assignedIDs: number[],
        warningMessage: string,
        isWarning: boolean,
    ) => (
        <>
            <div className="form__desc form__desc--top">
                {t('encryption_managed_certificates_desc', {
                    ids: assignedIDs.join(', '),
                })}
            </div>

            {statuses.length === 0 ? (
                <div className="form__desc">
                    <Trans>encryption_managed_certificates_empty</Trans>
                </div>
            ) : (
                statuses.map((pairStatus, index) => (
                    <div key={`${pairStatus.certificate_path}\n${pairStatus.private_key_path}\n${index}`} className="mb-3">
                        <Input
                            type="text"
                            value={pairStatus.certificate_path || ''}
                            placeholder={t('encryption_certificate_path_indexed', { index: index + 1 })}
                            disabled
                            readOnly
                        />

                        {pairStatus.certificate_path && (
                            <div className="form__status">
                                <CertificateStatus
                                    validChain={pairStatus.valid_chain}
                                    validCert={pairStatus.valid_cert}
                                    subject={pairStatus.subject}
                                    issuer={pairStatus.issuer}
                                    notAfter={pairStatus.not_after}
                                    dnsNames={pairStatus.dns_names || []}
                                />
                            </div>
                        )}

                        <Input
                            type="text"
                            value={pairStatus.private_key_path || ''}
                            placeholder={t('encryption_private_key_path_indexed', { index: index + 1 })}
                            disabled
                            readOnly
                        />

                        {pairStatus.private_key_path && (
                            <div className="form__status">
                                <KeyStatus validKey={pairStatus.valid_key} keyType={pairStatus.key_type} />
                            </div>
                        )}

                        {pairStatus.warning_validation && (
                            <div className="form__desc text-danger mt-2">{pairStatus.warning_validation}</div>
                        )}
                    </div>
                ))
            )}

            {validationMessage(warningMessage, isWarning)}
        </>
    );

    const renderCertificateInput = (
        target: 'dns' | 'panel',
    ) => {
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
            return renderManagedPathPairs(
                isPanel ? encryption.panel_certificate_key_pair_statuses : encryption.certificate_key_pair_statuses,
                assignedIDs,
                warningMessage,
                isWarning,
            );
        }

        if (currentCertificateSource === ENCRYPTION_SOURCE.CONTENT) {
            return (
                <Controller
                    name={isPanel ? 'panel_certificate_chain' : 'certificate_chain'}
                    control={control}
                    render={({ field, fieldState }) => (
                            <Textarea
                                {...field}
                                placeholder={t('encryption_certificates_input')}
                                disabled={!isEnabled}
                                error={fieldState.error?.message}
                                onBlur={composeImmediateCertificateBlurHandler(
                                    field.onBlur,
                                    isPanel ? 'panel_certificate_chain' : 'certificate_chain',
                                )}
                            />
                        )}
                    />
            );
        }

        if (usePathPairs) {
            return fields.map((pathPairField, index) => {
                const pairStatus = getPathPairStatus(pathPairStatusMap, pathPairs[index]);
                const onAppend = isPanel
                    ? () => appendPanelCertificatePathPair({ certificate_path: '', private_key_path: '' })
                    : () => appendCertificatePathPair({ certificate_path: '', private_key_path: '' });
                const onRemove = () => removePathPair(
                    pairFieldName,
                    fields.length,
                    isPanel ? removePanelCertificatePathPair : removeCertificatePathPair,
                    index,
                );

                return (
                    <div key={pathPairField.id} className="mb-2">
                        <Controller
                            name={`${pairFieldName}.${index}.certificate_path` as any}
                            control={control}
                            rules={{
                                validate: {
                                    validateAbsolutePath,
                                    validatePairedValue: (value) => validatePathPairField(
                                        pairFieldName,
                                        index,
                                        value,
                                        'private_key_path',
                                    ),
                                },
                            }}
                            render={({ field, fieldState }) => (
                                <Input
                                    {...field}
                                    type="text"
                                    placeholder={`${t('encryption_certificate_path')} ${index + 1}`}
                                    error={fieldState.error?.message}
                                    disabled={!isEnabled}
                                    trimOnBlur
                                    rightAddon={renderPathPairActions(
                                        index,
                                        usePathPairs,
                                        onAppend,
                                        onRemove,
                                        !isEnabled,
                                    )}
                                    onBlur={composeImmediateCertificateBlurHandler(
                                        field.onBlur,
                                        `${pairFieldName}.${index}.certificate_path`,
                                    )}
                                />
                            )}
                        />
                        {pathPairs[index]?.certificate_path && pairStatus && (
                            <div className="form__status">
                                <CertificateStatus
                                    validChain={pairStatus.valid_chain}
                                    validCert={pairStatus.valid_cert}
                                    subject={pairStatus.subject}
                                    issuer={pairStatus.issuer}
                                    notAfter={pairStatus.not_after}
                                    dnsNames={pairStatus.dns_names || []}
                                />
                            </div>
                        )}
                    </div>
                );
            });
        }

        return (
            <Controller
                name={isPanel ? 'panel_certificate_path' : 'certificate_path'}
                control={control}
                rules={{ validate: validateAbsolutePath }}
                render={({ field, fieldState }) => (
                    <Input
                        {...field}
                        type="text"
                        placeholder={t('encryption_certificate_path')}
                        error={fieldState.error?.message}
                        disabled={!isEnabled}
                        trimOnBlur
                        onBlur={composeImmediateCertificateBlurHandler(
                            field.onBlur,
                            isPanel ? 'panel_certificate_path' : 'certificate_path',
                        )}
                    />
                )}
            />
        );
    };

    const renderPrivateKeyInput = (
        target: 'dns' | 'panel',
    ) => {
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
            return (
                <>
                    <Controller
                        name={isPanel ? 'panel_private_key_saved' : 'private_key_saved'}
                        control={control}
                        render={({ field }) => (
                            <Checkbox
                                {...field}
                                title={t('use_saved_key')}
                                disabled={!isEnabled}
                                onChange={(checked: boolean) => {
                                    if (checked) {
                                        setValue(isPanel ? 'panel_private_key' : 'private_key', '');
                                    }
                                    field.onChange(checked);
                                }}
                                onBlur={composeImmediateCertificateBlurHandler(field.onBlur)}
                            />
                        )}
                    />

                    <Controller
                        name={isPanel ? 'panel_private_key' : 'private_key'}
                        control={control}
                        render={({ field, fieldState }) => (
                            <Textarea
                                {...field}
                                placeholder={t('encryption_key_input')}
                                disabled={!isEnabled || currentPrivateKeySaved}
                                error={fieldState.error?.message}
                                onBlur={composeImmediateCertificateBlurHandler(
                                    field.onBlur,
                                    isPanel ? 'panel_private_key' : 'private_key',
                                )}
                            />
                        )}
                    />
                </>
            );
        }

        if (usePathPairs) {
            return fields.map((pathPairField, index) => {
                const pairStatus = getPathPairStatus(pathPairStatusMap, pathPairs[index]);
                const onAppend = isPanel
                    ? () => appendPanelCertificatePathPair({ certificate_path: '', private_key_path: '' })
                    : () => appendCertificatePathPair({ certificate_path: '', private_key_path: '' });
                const onRemove = () => removePathPair(
                    pairFieldName,
                    fields.length,
                    isPanel ? removePanelCertificatePathPair : removeCertificatePathPair,
                    index,
                );

                return (
                    <div key={pathPairField.id} className="mb-2">
                        <Controller
                            name={`${pairFieldName}.${index}.private_key_path` as any}
                            control={control}
                            rules={{
                                validate: {
                                    validateAbsolutePath,
                                    validatePairedValue: (value) => validatePathPairField(
                                        pairFieldName,
                                        index,
                                        value,
                                        'certificate_path',
                                    ),
                                },
                            }}
                            render={({ field, fieldState }) => (
                                <Input
                                    {...field}
                                    type="text"
                                    placeholder={`${t('encryption_private_key_path')} ${index + 1}`}
                                    error={fieldState.error?.message}
                                    disabled={!isEnabled}
                                    trimOnBlur
                                    rightAddon={renderPathPairActions(
                                        index,
                                        usePathPairs,
                                        onAppend,
                                        onRemove,
                                        !isEnabled,
                                    )}
                                    onBlur={composeImmediateCertificateBlurHandler(
                                        field.onBlur,
                                        `${pairFieldName}.${index}.private_key_path`,
                                    )}
                                />
                            )}
                        />
                        {pathPairs[index]?.private_key_path && pairStatus && (
                            <div className="form__status">
                                <KeyStatus validKey={pairStatus.valid_key} keyType={pairStatus.key_type} />
                            </div>
                        )}
                    </div>
                );
            });
        }

        return (
            <Controller
                name={isPanel ? 'panel_private_key_path' : 'private_key_path'}
                control={control}
                rules={{ validate: validateAbsolutePath }}
                render={({ field, fieldState }) => (
                    <Input
                        {...field}
                        type="text"
                        placeholder={t('encryption_private_key_path')}
                        error={fieldState.error?.message}
                        disabled={!isEnabled}
                        trimOnBlur
                        onBlur={composeImmediateCertificateBlurHandler(
                            field.onBlur,
                            isPanel ? 'panel_private_key_path' : 'private_key_path',
                        )}
                    />
                )}
            />
        );
    };

    const renderSingleStatus = (target: 'dns' | 'panel') => {
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

        return (
            <>
                {!managed && !usePathPairs && (currentCertificateChain || currentCertificatePath) && (
                    <div className="form__status">
                        <CertificateStatus
                            validChain={currentValidChain}
                            validCert={currentValidCert}
                            subject={currentSubject}
                            issuer={currentIssuer}
                            notAfter={currentNotAfter}
                            dnsNames={currentDNSNames || []}
                        />
                    </div>
                )}

                {!managed && !usePathPairs && (currentPrivateKey || currentPrivateKeyPath) && (
                    <div className="form__status">
                        <KeyStatus validKey={currentValidKey} keyType={currentKeyType} />
                    </div>
                )}
            </>
        );
    };

    const onFormSubmit = async (data: EncryptionFormValues) => {
        debouncedConfigValidation.cancel();
        await onSubmit(data);
    };

    const isDisabled = isSavingDisabled();

    return (
        <form onSubmit={handleSubmit(onFormSubmit)}>
            <div className="row">
                <div className="col-12">
                    <div className="form__group form__group--settings mb-3">
                        <Controller
                            name="enabled"
                            control={control}
                            render={({ field }) => (
                                <Checkbox
                                    {...field}
                                    title={t('encryption_enable')}
                                />
                            )}
                        />
                    </div>

                    <div className="form__desc">
                        <Trans>encryption_enable_desc</Trans>
                    </div>

                    <div className="form__group mb-3 mt-5">
                        <Controller
                            name="serve_plain_dns"
                            control={control}
                            rules={{
                                validate: (value) => validatePlainDns(value, getValues()),
                            }}
                            render={({ field }) => <Checkbox {...field} title={t('encryption_plain_dns_enable')} />}
                        />
                    </div>

                    <div className="form__desc">
                        <Trans>encryption_plain_dns_desc</Trans>
                    </div>

                    <div className="form__group form__group--settings mt-4">
                        <Controller
                            name="force_https"
                            control={control}
                            render={({ field }) => (
                                <Checkbox
                                    {...field}
                                    title={t('encryption_redirect')}
                                    disabled={!isEnabled}
                                />
                            )}
                        />

                        <div className="form__desc">
                            <Trans>encryption_redirect_desc</Trans>
                        </div>
                    </div>

                    <hr />
                </div>
            </div>

            <div className="row">
                <div className="col-lg-6">
                    <div className="form__group form__group--settings">
                        <label className="form__label" htmlFor="panel_server_name">
                            <Trans>encryption_panel_server_name</Trans>
                        </label>

                        <Controller
                            name="panel_server_name"
                            control={control}
                            rules={{ validate: validateServerName }}
                            render={({ field, fieldState }) => (
                                <Input
                                    {...field}
                                    type="text"
                                    placeholder={t('encryption_panel_server_name_enter')}
                                    error={fieldState.error?.message}
                                    disabled={!isEnabled}
                                />
                            )}
                        />

                        <div className="form__desc">
                            <Trans>encryption_panel_server_name_desc</Trans>
                        </div>
                    </div>
                </div>

                <div className="col-lg-6">
                    <div className="form__group form__group--settings">
                        <label className="form__label" htmlFor="panel_server_url_path">
                            <Trans>encryption_panel_server_url_path</Trans>
                        </label>

                        <Controller
                            name="panel_server_url_path"
                            control={control}
                            rules={{ validate: validateURLPathPrefix }}
                            render={({ field, fieldState }) => (
                                <Input
                                    {...field}
                                    type="text"
                                    placeholder={t('encryption_panel_server_url_path_placeholder')}
                                    error={fieldState.error?.message}
                                    disabled={!isEnabled}
                                    trimOnBlur
                                />
                            )}
                        />

                        <div className="form__desc">
                            <Trans>encryption_panel_server_url_path_desc</Trans>
                        </div>
                    </div>
                </div>

                <div className="col-lg-6">
                    <div className="form__group form__group--settings">
                        <label className="form__label" htmlFor="panel_server_port">
                            <Trans>encryption_panel_server_port</Trans>
                        </label>

                        <Controller
                            name="panel_server_port"
                            control={control}
                            rules={{
                                validate: {
                                    validateInstallPort,
                                    validateIsSafePort,
                                    validatePanelServerPortValue,
                                },
                            }}
                            render={({ field, fieldState }) => (
                                <Input
                                    {...field}
                                    type="number"
                                    placeholder={t('encryption_panel_server_port_placeholder')}
                                    error={fieldState.error?.message}
                                    disabled={!isEnabled}
                                    onChange={(e) => {
                                        const { value } = e.target;
                                        field.onChange(toNumber(value));
                                    }}
                                />
                            )}
                        />

                        <div className="form__desc">
                            <Trans>encryption_panel_server_port_desc</Trans>
                        </div>
                    </div>
                </div>
            </div>

            <div className="row">
                <div className="col-lg-6">
                    <div className="form__group form__group--settings">
                        <label className="form__label" htmlFor="server_name">
                            <Trans>encryption_server</Trans>
                        </label>

                        <Controller
                            name="server_name"
                            control={control}
                            rules={{ validate: validateServerName }}
                            render={({ field, fieldState }) => (
                                <Input
                                    {...field}
                                    type="text"
                                    placeholder={t('encryption_server_enter')}
                                    error={fieldState.error?.message}
                                    disabled={!isEnabled}
                                />
                            )}
                        />

                        <div className="form__desc">
                            <Trans>encryption_server_desc</Trans>
                        </div>
                    </div>
                </div>

                <div className="col-lg-6">
                    <div className="form__group form__group--settings">
                        <label className="form__label" htmlFor="dns_over_quic_url_path">
                            <Trans>encryption_doq_path</Trans>
                        </label>

                        <Controller
                            name="dns_over_quic_url_path"
                            control={control}
                            rules={{ validate: validateURLPathPrefix }}
                            render={({ field, fieldState }) => (
                                <Input
                                    {...field}
                                    type="text"
                                    placeholder={t('encryption_doq_path_placeholder')}
                                    error={fieldState.error?.message}
                                    disabled={!isEnabled}
                                    trimOnBlur
                                />
                            )}
                        />

                        <div className="form__desc">
                            <Trans>encryption_doq_path_desc</Trans>
                        </div>
                    </div>
                </div>
            </div>

            <div className="row">
                <div className="col-lg-6">
                    <div className="form__group form__group--settings">
                        <label className="form__label" htmlFor="port_https">
                            <Trans>encryption_https</Trans>
                        </label>

                        <Controller
                            name="port_https"
                            control={control}
                            rules={{
                                validate: {
                                    validatePort,
                                    validateIsSafePort,
                                    validateHTTPSPortValue,
                                },
                            }}
                            render={({ field, fieldState }) => (
                                <Input
                                    {...field}
                                    type="number"
                                    placeholder={t('encryption_https')}
                                    error={fieldState.error?.message}
                                    disabled={!isEnabled}
                                    onChange={(e) => {
                                        const { value } = e.target;
                                        field.onChange(toNumber(value));
                                    }}
                                />
                            )}
                        />

                        <div className="form__desc">
                            <Trans>encryption_https_desc</Trans>
                        </div>
                    </div>

                    <div className="form__group form__group--settings">
                        <label className="form__label" htmlFor="port_dns_over_quic">
                            <Trans>encryption_doq</Trans>
                        </label>

                        <Controller
                            name="port_dns_over_quic"
                            control={control}
                            rules={{ validate: validatePortQuic }}
                            render={({ field, fieldState }) => (
                                <Input
                                    {...field}
                                    type="number"
                                    placeholder={t('encryption_doq')}
                                    error={fieldState.error?.message}
                                    disabled={!isEnabled}
                                    onChange={(e) => {
                                        const { value } = e.target;
                                        field.onChange(toNumber(value));
                                    }}
                                />
                            )}
                        />

                        <div className="form__desc">
                            <Trans>encryption_doq_desc</Trans>
                        </div>
                    </div>

                    <div className="form__group form__group--settings">
                        <label className="form__label" htmlFor="port_dns_over_tls">
                            <Trans>encryption_dot</Trans>
                        </label>

                        <Controller
                            name="port_dns_over_tls"
                            control={control}
                            rules={{
                                validate: {
                                    validatePortTLS,
                                    validateTLSPortValue,
                                },
                            }}
                            render={({ field, fieldState }) => (
                                <Input
                                    {...field}
                                    type="number"
                                    placeholder={t('encryption_dot')}
                                    error={fieldState.error?.message}
                                    disabled={!isEnabled}
                                    onChange={(e) => {
                                        const { value } = e.target;
                                        field.onChange(toNumber(value));
                                    }}
                                />
                            )}
                        />

                        <div className="form__desc">
                            <Trans>encryption_dot_desc</Trans>
                        </div>
                    </div>
                </div>
            </div>

            <div className="row">
                <div className="col-12">
                    <hr />
                    <div className="form__group form__group--settings">
                        <label className="form__label form__label--bold">
                            <Trans>encryption_panel_certificates</Trans>
                        </label>
                        <div className="form__desc form__desc--top">
                            <Trans>encryption_panel_certificates_desc</Trans>
                        </div>

                        {!panelManaged && (
                            <div className="form__inline mb-2">
                                <div className="custom-controls-stacked">
                                    <Controller
                                        name="panel_certificate_source"
                                        control={control}
                                        render={({ field }) => (
                                            <Radio
                                                {...field}
                                                options={certificateSourceOptions}
                                                disabled={!isEnabled}
                                            />
                                        )}
                                    />
                                </div>
                            </div>
                        )}

                        {renderCertificateInput('panel')}
                        {renderSingleStatus('panel')}
                    </div>

                    {!panelManaged && (
                        <div className="form__group form__group--settings mt-3">
                            <label className="form__label form__label--bold" htmlFor="panel_private_key">
                                <Trans>encryption_panel_private_key</Trans>
                            </label>

                            <div className="form__inline mb-2">
                                <div className="custom-controls-stacked">
                                    <Controller
                                        name="panel_key_source"
                                        control={control}
                                        render={({ field }) => (
                                            <Radio {...field} options={keySourceOptions} disabled={!isEnabled} />
                                        )}
                                    />
                                </div>
                            </div>

                            {renderPrivateKeyInput('panel')}
                        </div>
                    )}

                    {!panelManaged && validationMessage(panel_warning_validation, panelIsWarning)}
                </div>
            </div>

            <div className="row">
                <div className="col-12">
                    <hr />
                    <div className="form__group form__group--settings">
                        <label
                            className="form__label form__label--with-desc form__label--bold"
                            htmlFor="certificate_chain">
                            <Trans>encryption_dns_certificates</Trans>
                        </label>

                        <div className="form__desc form__desc--top">
                            <Trans>encryption_dns_certificates_desc</Trans>
                        </div>

                        {!dnsManaged && (
                            <div className="form__inline mb-2">
                                <div className="custom-controls-stacked">
                                    <Controller
                                        name="certificate_source"
                                        control={control}
                                        render={({ field }) => (
                                            <Radio
                                                {...field}
                                                options={certificateSourceOptions}
                                                disabled={!isEnabled}
                                            />
                                        )}
                                    />
                                </div>
                            </div>
                        )}

                        {renderCertificateInput('dns')}
                        {renderSingleStatus('dns')}
                    </div>

                    {!dnsManaged && (
                        <div className="form__group form__group--settings mt-3">
                            <label className="form__label form__label--bold" htmlFor="private_key">
                                <Trans>encryption_key</Trans>
                            </label>

                            <div className="form__inline mb-2">
                                <div className="custom-controls-stacked">
                                    <Controller
                                        name="key_source"
                                        control={control}
                                        render={({ field }) => (
                                            <Radio {...field} options={keySourceOptions} disabled={!isEnabled} />
                                        )}
                                    />
                                </div>
                            </div>

                            {renderPrivateKeyInput('dns')}
                        </div>
                    )}

                    {!dnsManaged && validationMessage(warning_validation, dnsIsWarning)}
                </div>
            </div>

            <div className="btn-list mt-2">
                <button type="submit" disabled={isDisabled} className="btn btn-success btn-standart">
                    <Trans>save_config</Trans>
                </button>

                <button
                    type="button"
                    className="btn btn-secondary btn-standart"
                    disabled={isSubmitting || processingConfig}
                    onClick={clearFields}>
                    <Trans>reset_settings</Trans>
                </button>
            </div>
        </form>
    );
};

import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import i18next from 'i18next';
import cn from 'classnames';
import { getPathWithQueryString } from '../../../helpers/helpers';
import { CLIENT_ID_LINK, MOBILE_CONFIG_LINKS, STANDARD_HTTPS_PORT } from '../../../helpers/constants';
import { toNumber } from '../../../helpers/form';
import { validateConfigClientId, validateServerName, validatePort, validateIsSafePort, } from '../../../helpers/validators';
import { Input } from '../Controls/Input';
import { Select } from '../Controls/Select';
const getDownloadLink = (host, clientId, protocol, invalid) => {
    if (!host || invalid) {
        return (React.createElement("button", { type: "button", className: "btn btn-success btn-standard btn-large disabled" }, i18next.t('download_mobileconfig')));
    }
    const linkParams = { host };
    if (clientId) {
        linkParams.client_id = clientId;
    }
    return (React.createElement("a", { href: getPathWithQueryString(protocol, linkParams), className: cn('btn btn-success btn-standard btn-large'), download: true }, i18next.t('download_mobileconfig')));
};
const defaultFormValues = {
    host: '',
    clientId: '',
    protocol: MOBILE_CONFIG_LINKS.DOT,
    port: undefined,
};
export const MobileConfigForm = ({ initialValues }) => {
    const { t } = useTranslation();
    const { watch, control, formState: { isValid }, } = useForm({
        mode: 'onBlur',
        defaultValues: {
            ...defaultFormValues,
            ...initialValues,
        },
    });
    const protocol = watch('protocol');
    const host = watch('host');
    const clientId = watch('clientId');
    const port = watch('port');
    const getHostName = () => {
        if (port && port !== STANDARD_HTTPS_PORT && protocol === MOBILE_CONFIG_LINKS.DOH) {
            return `${host}:${port}`;
        }
        return host;
    };
    return (React.createElement("form", { onSubmit: (e) => e.preventDefault() },
        React.createElement("div", null,
            React.createElement("div", { className: "form__group form__group--settings" },
                React.createElement("div", { className: "row" },
                    React.createElement("div", { className: "col" },
                        React.createElement(Controller, { name: "host", control: control, rules: { validate: validateServerName }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "text", "data-testid": "mobile_config_host", label: t('dhcp_table_hostname'), placeholder: t('form_enter_hostname'), error: fieldState.error?.message })) })),
                    protocol === MOBILE_CONFIG_LINKS.DOH && (React.createElement("div", { className: "col" },
                        React.createElement(Controller, { name: "port", control: control, rules: {
                                validate: {
                                    range: (value) => validatePort(value) || true,
                                    safety: (value) => validateIsSafePort(value) || true,
                                },
                            }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "number", "data-testid": "mobile_config_port", label: t('encryption_https'), placeholder: t('encryption_https'), error: fieldState.error?.message, onChange: (e) => {
                                    const { value } = e.target;
                                    field.onChange(toNumber(value));
                                } })) }))))),
            React.createElement("div", { className: "form__group form__group--settings" },
                React.createElement("label", { htmlFor: "clientId", className: "form__label form__label--with-desc" }, t('client_id')),
                React.createElement("div", { className: "form__desc form__desc--top" },
                    React.createElement(Trans, { components: { a: React.createElement("a", { href: CLIENT_ID_LINK, target: "_blank", rel: "noopener noreferrer" }) } }, "client_id_desc")),
                React.createElement(Controller, { name: "clientId", control: control, rules: {
                        validate: validateConfigClientId,
                    }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "text", "data-testid": "mobile_config_client_id", placeholder: t('client_id_placeholder'), error: fieldState.error?.message })) })),
            React.createElement("div", { className: "form__group form__group--settings" },
                React.createElement(Controller, { name: "protocol", control: control, render: ({ field }) => (React.createElement(Select, { ...field, label: t('protocol'), "data-testid": "mobile_config_protocol" },
                        React.createElement("option", { value: MOBILE_CONFIG_LINKS.DOT }, t('dns_over_tls')),
                        React.createElement("option", { value: MOBILE_CONFIG_LINKS.DOH }, t('dns_over_https')))) }))),
        getDownloadLink(getHostName(), clientId, protocol, !isValid)));
};

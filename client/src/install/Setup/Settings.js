import React, { useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';
import i18n from 'i18next';
import Controls from './Controls';
import AddressList from './AddressList';
import { getInterfaceIp } from '../../helpers/helpers';
import { ALL_INTERFACES_IP, ADDRESS_IN_USE_TEXT, PORT_53_FAQ_LINK, STATUS_RESPONSE, STANDARD_DNS_PORT, STANDARD_WEB_PORT, MAX_PORT, MIN_PORT, } from '../../helpers/constants';
import { validateRequiredValue } from '../../helpers/validators';
import { Input } from '../../components/ui/Controls/Input';
import { Select } from '../../components/ui/Controls/Select';
import { toNumber } from '../../helpers/form';
const validateInstallPort = (value) => {
    if (value < MIN_PORT || value > MAX_PORT) {
        return i18n.t('form_error_port');
    }
    return undefined;
};
const renderInterfaces = (interfaces) => Object.values(interfaces).map((option) => {
    const { name, ip_addresses, flags } = option;
    if (option && ip_addresses?.length > 0) {
        const ip = getInterfaceIp(option);
        const isUp = flags?.includes('up');
        return (React.createElement("option", { value: ip, key: name, disabled: !isUp },
            name,
            " - ",
            ip,
            " ",
            !isUp && `(${i18n.t('down')})`));
    }
    return null;
});
export const Settings = ({ handleSubmit, handleFix, validateForm, config, interfaces }) => {
    const { t } = useTranslation();
    const defaultValues = {
        web: {
            ip: config.web.ip || ALL_INTERFACES_IP,
            port: config.web.port || STANDARD_WEB_PORT,
        },
        dns: {
            ip: config.dns.ip || ALL_INTERFACES_IP,
            port: config.dns.port || STANDARD_DNS_PORT,
        },
    };
    const { control, watch, handleSubmit: reactHookFormSubmit, formState: { isValid }, } = useForm({
        defaultValues,
        mode: 'onBlur',
    });
    const watchFields = watch();
    const { status: webStatus, can_autofix: isWebFixAvailable } = config.web;
    const { status: dnsStatus, can_autofix: isDnsFixAvailable } = config.dns;
    const { staticIp } = config;
    const webIpVal = watch('web.ip');
    const webPortVal = watch('web.port');
    const dnsIpVal = watch('dns.ip');
    const dnsPortVal = watch('dns.port');
    useEffect(() => {
        const webPortError = validateInstallPort(webPortVal);
        const dnsPortError = validateInstallPort(dnsPortVal);
        if (webPortError || dnsPortError) {
            return;
        }
        validateForm({
            web: {
                ip: webIpVal,
                port: webPortVal,
            },
            dns: {
                ip: dnsIpVal,
                port: dnsPortVal,
            },
        });
    }, [webIpVal, webPortVal, dnsIpVal, dnsPortVal]);
    const handleAutofix = (type) => {
        const web = {
            ip: watchFields.web?.ip,
            port: watchFields.web?.port,
            autofix: false,
        };
        const dns = {
            ip: watchFields.dns?.ip,
            port: watchFields.dns?.port,
            autofix: false,
        };
        const set_static_ip = false;
        if (type === 'web') {
            web.autofix = true;
        }
        else {
            dns.autofix = true;
        }
        handleFix(web, dns, set_static_ip);
    };
    const handleStaticIp = (ip) => {
        const web = {
            ip: watchFields.web?.ip,
            port: watchFields.web?.port,
            autofix: false,
        };
        const dns = {
            ip: watchFields.dns?.ip,
            port: watchFields.dns?.port,
            autofix: false,
        };
        const set_static_ip = true;
        if (window.confirm(t('confirm_static_ip', { ip }))) {
            handleFix(web, dns, set_static_ip);
        }
    };
    const getStaticIpMessage = useCallback((staticIp) => {
        const { static: status, ip } = staticIp;
        switch (status) {
            case STATUS_RESPONSE.NO:
                return (React.createElement(React.Fragment, null,
                    React.createElement("div", { className: "mb-2" },
                        React.createElement(Trans, { values: { ip }, components: [React.createElement("strong", { key: "0" }, "text")] }, "install_static_configure")),
                    React.createElement("button", { type: "button", className: "btn btn-outline-primary btn-sm", onClick: () => handleStaticIp(ip) },
                        React.createElement(Trans, null, "set_static_ip"))));
            case STATUS_RESPONSE.ERROR:
                return (React.createElement("div", { className: "text-danger" },
                    React.createElement(Trans, null, "install_static_error")));
            case STATUS_RESPONSE.YES:
                return (React.createElement("div", { className: "text-success" },
                    React.createElement(Trans, null, "install_static_ok")));
            default:
                return null;
        }
    }, [handleStaticIp]);
    const onSubmit = (data) => {
        validateForm(data);
        handleSubmit(data);
    };
    return (React.createElement("form", { className: "setup__step", onSubmit: reactHookFormSubmit(onSubmit) },
        React.createElement("div", { className: "setup__group" },
            React.createElement("div", { className: "setup__subtitle" },
                React.createElement(Trans, null, "install_settings_title")),
            React.createElement("div", { className: "row" },
                React.createElement("div", { className: "col-8" },
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", null,
                            React.createElement(Trans, null, "install_settings_listen")),
                        React.createElement(Controller, { name: "web.ip", control: control, render: ({ field }) => (React.createElement(Select, { ...field, "data-testid": "install_web_ip" },
                                React.createElement("option", { value: ALL_INTERFACES_IP }, t('install_settings_all_interfaces')),
                                renderInterfaces(interfaces))) }))),
                React.createElement("div", { className: "col-4" },
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", null,
                            React.createElement(Trans, null, "install_settings_port")),
                        React.createElement(Controller, { name: "web.port", control: control, rules: {
                                validate: {
                                    required: validateRequiredValue,
                                    installPort: validateInstallPort,
                                },
                            }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "number", "data-testid": "install_web_port", placeholder: STANDARD_WEB_PORT.toString(), error: fieldState.error?.message, onChange: (e) => {
                                    const { value } = e.target;
                                    field.onChange(toNumber(value));
                                } })) }))),
                React.createElement("div", { className: "col-12" },
                    webStatus && (React.createElement("div", { className: "setup__error text-danger" },
                        webStatus,
                        isWebFixAvailable && (React.createElement("button", { type: "button", "data-testid": "install_web_fix", className: "btn btn-secondary btn-sm ml-2", onClick: () => handleAutofix('web') },
                            React.createElement(Trans, null, "fix"))))),
                    React.createElement("hr", { className: "divider--small" }))),
            React.createElement("div", { className: "setup__desc" },
                React.createElement(Trans, null, "install_settings_interface_link"),
                React.createElement("div", { className: "mt-1" },
                    React.createElement(AddressList, { interfaces: interfaces, address: watchFields.web?.ip, port: watchFields.web?.port })))),
        React.createElement("div", { className: "setup__group" },
            React.createElement("div", { className: "setup__subtitle" },
                React.createElement(Trans, null, "install_settings_dns")),
            React.createElement("div", { className: "row" },
                React.createElement("div", { className: "col-8" },
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", null,
                            React.createElement(Trans, null, "install_settings_listen")),
                        React.createElement(Controller, { name: "dns.ip", control: control, render: ({ field }) => (React.createElement(Select, { ...field, "data-testid": "install_dns_ip" },
                                React.createElement("option", { value: ALL_INTERFACES_IP }, t('install_settings_all_interfaces')),
                                renderInterfaces(interfaces))) }))),
                React.createElement("div", { className: "col-4" },
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", null,
                            React.createElement(Trans, null, "install_settings_port")),
                        React.createElement(Controller, { name: "dns.port", control: control, rules: {
                                required: t('form_error_required'),
                                validate: {
                                    required: validateRequiredValue,
                                    installPort: validateInstallPort,
                                },
                            }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "number", "data-testid": "install_dns_port", error: fieldState.error?.message, placeholder: STANDARD_DNS_PORT.toString(), onChange: (e) => {
                                    const { value } = e.target;
                                    field.onChange(toNumber(value));
                                } })) }))),
                React.createElement("div", { className: "col-12" },
                    dnsStatus && (React.createElement(React.Fragment, null,
                        React.createElement("div", { className: "setup__error text-danger" },
                            dnsStatus,
                            isDnsFixAvailable && (React.createElement("button", { type: "button", "data-testid": "install_dns_fix", className: "btn btn-secondary btn-sm ml-2", onClick: () => handleAutofix('dns') },
                                React.createElement(Trans, null, "fix")))),
                        isDnsFixAvailable && (React.createElement("div", { className: "text-muted mb-2" },
                            React.createElement("p", { className: "mb-1" },
                                React.createElement(Trans, null, "autofix_warning_text")),
                            React.createElement(Trans, { components: [React.createElement("li", { key: "0" }, "text")] }, "autofix_warning_list"),
                            React.createElement("p", { className: "mb-1" },
                                React.createElement(Trans, null, "autofix_warning_result")))))),
                    watchFields.dns?.port === STANDARD_DNS_PORT &&
                        !isDnsFixAvailable &&
                        dnsStatus?.includes(ADDRESS_IN_USE_TEXT) && (React.createElement(Trans, { components: [
                            React.createElement("a", { href: PORT_53_FAQ_LINK, key: "0", target: "_blank", rel: "noopener noreferrer" }, "link"),
                        ] }, "port_53_faq_link")),
                    React.createElement("hr", { className: "divider--small" }))),
            React.createElement("div", { className: "setup__desc" },
                React.createElement(Trans, null, "install_settings_dns_desc"),
                React.createElement("div", { className: "mt-1" },
                    React.createElement(AddressList, { interfaces: interfaces, address: watchFields.dns?.ip, port: watchFields.dns?.port, isDns: true })))),
        React.createElement("div", { className: "setup__group" },
            React.createElement("div", { className: "setup__subtitle" },
                React.createElement(Trans, null, "static_ip")),
            React.createElement("div", { className: "mb-2" },
                React.createElement(Trans, null, "static_ip_desc")),
            getStaticIpMessage(staticIp)),
        React.createElement(Controls, { invalid: !isValid })));
};

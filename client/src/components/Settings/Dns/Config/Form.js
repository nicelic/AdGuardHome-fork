import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { validateIp, validateIpv4, validateIpv6, validateRequiredValue } from '../../../../helpers/validators';
import { BLOCKING_MODES, UINT32_RANGE } from '../../../../helpers/constants';
import { Checkbox } from '../../../ui/Controls/Checkbox';
import { Input } from '../../../ui/Controls/Input';
import { toNumber } from '../../../../helpers/form';
import { Textarea } from '../../../ui/Controls/Textarea';
import { Radio } from '../../../ui/Controls/Radio';
const Form = ({ processing, initialValues, onSubmit }) => {
    const { t } = useTranslation();
    const { handleSubmit, watch, control, formState: { isSubmitting }, } = useForm({
        mode: 'onBlur',
        defaultValues: initialValues,
    });
    const checkboxes = [
        {
            name: 'dnssec_enabled',
            placeholder: t('dnssec_enable'),
            subtitle: t('dnssec_enable_desc'),
        },
        {
            name: 'disable_ipv6',
            placeholder: t('disable_ipv6'),
            subtitle: t('disable_ipv6_desc'),
        },
        {
            name: 'disable_ipv4',
            placeholder: t('disable_ipv4'),
            subtitle: t('disable_ipv4_desc'),
        },
    ];
    const customIps = [
        {
            name: 'blocking_ipv4',
            label: t('blocking_ipv4'),
            description: t('blocking_ipv4_desc'),
            validateIp: validateIpv4,
        },
        {
            name: 'blocking_ipv6',
            label: t('blocking_ipv6'),
            description: t('blocking_ipv6_desc'),
            validateIp: validateIpv6,
        },
    ];
    const blockingModeOptions = [
        {
            value: BLOCKING_MODES.default,
            label: t('default'),
        },
        {
            value: BLOCKING_MODES.refused,
            label: t('refused'),
        },
        {
            value: BLOCKING_MODES.nxdomain,
            label: t('nxdomain'),
        },
        {
            value: BLOCKING_MODES.null_ip,
            label: t('null_ip'),
        },
        {
            value: BLOCKING_MODES.custom_ip,
            label: t('custom_ip'),
        },
    ];
    const blockingModeDescriptions = [
        t(`blocking_mode_default`),
        t(`blocking_mode_refused`),
        t(`blocking_mode_nxdomain`),
        t(`blocking_mode_null_ip`),
        t(`blocking_mode_custom_ip`),
    ];
    const blocking_mode = watch('blocking_mode');
    const edns_cs_enabled = watch('edns_cs_enabled');
    const edns_cs_use_custom = watch('edns_cs_use_custom');
    return (React.createElement("form", { onSubmit: handleSubmit(onSubmit) },
        React.createElement("div", { className: "row" },
            React.createElement("div", { className: "col-12 col-md-7" },
                React.createElement("div", { className: "form__group form__group--settings" },
                    React.createElement(Controller, { name: "ratelimit", control: control, rules: { validate: validateRequiredValue }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, "data-testid": "dns_config_ratelimit", type: "number", label: t('rate_limit'), desc: t('rate_limit_desc'), error: fieldState.error?.message, min: UINT32_RANGE.MIN, max: UINT32_RANGE.MAX, disabled: processing, onChange: (e) => {
                                const { value } = e.target;
                                field.onChange(toNumber(value));
                            } })) }))),
            React.createElement("div", { className: "col-12 col-md-7" },
                React.createElement("div", { className: "form__group form__group--settings" },
                    React.createElement(Controller, { name: "ratelimit_subnet_len_ipv4", control: control, rules: { validate: validateRequiredValue }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, "data-testid": "dns_config_subnet_ipv4", type: "number", label: t('rate_limit_subnet_len_ipv4'), desc: t('rate_limit_subnet_len_ipv4_desc'), error: fieldState.error?.message, min: 0, max: 32, disabled: processing, onChange: (e) => {
                                const { value } = e.target;
                                field.onChange(toNumber(value));
                            } })) }))),
            React.createElement("div", { className: "col-12 col-md-7" },
                React.createElement("div", { className: "form__group form__group--settings" },
                    React.createElement(Controller, { name: "ratelimit_subnet_len_ipv6", control: control, rules: { validate: validateRequiredValue }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, "data-testid": "dns_config_subnet_ipv6", type: "number", label: t('rate_limit_subnet_len_ipv6'), desc: t('rate_limit_subnet_len_ipv6_desc'), error: fieldState.error?.message, min: 0, max: 128, disabled: processing, onChange: (e) => {
                                const { value } = e.target;
                                field.onChange(toNumber(value));
                            } })) }))),
            React.createElement("div", { className: "col-12 col-md-7" },
                React.createElement("div", { className: "form__group form__group--settings" },
                    React.createElement(Controller, { name: "ratelimit_whitelist", control: control, render: ({ field, fieldState }) => (React.createElement(Textarea, { ...field, "data-testid": "dns_config_subnet_ipv6", label: t('rate_limit_whitelist'), desc: t('rate_limit_whitelist_desc'), error: fieldState.error?.message, disabled: processing, trimOnBlur: true })) }))),
            React.createElement("div", { className: "col-12" },
                React.createElement("div", { className: "form__group form__group--settings" },
                    React.createElement(Controller, { name: "edns_cs_enabled", control: control, render: ({ field }) => (React.createElement(Checkbox, { ...field, "data-testid": "dns_config_edns_cs_enabled", title: t('edns_enable'), disabled: processing })) }))),
            React.createElement("div", { className: "col-12 form__group form__group--inner" },
                React.createElement("div", { className: "form__group" },
                    React.createElement(Controller, { name: "edns_cs_use_custom", control: control, render: ({ field }) => (React.createElement(Checkbox, { ...field, "data-testid": "dns_config_edns_use_custom_ip", title: t('edns_use_custom_ip'), disabled: processing || !edns_cs_enabled })) })),
                edns_cs_use_custom && (React.createElement(Controller, { name: "edns_cs_custom_ip", control: control, rules: {
                        validate: {
                            required: validateRequiredValue,
                            id: validateIp,
                        },
                    }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, "data-testid": "dns_config_edns_cs_custom_ip", error: fieldState.error?.message, disabled: processing || !edns_cs_enabled })) }))),
            checkboxes.map(({ name, placeholder, subtitle }) => (React.createElement("div", { className: "col-12", key: name },
                React.createElement("div", { className: "form__group form__group--settings" },
                    React.createElement(Controller, { name: name, control: control, render: ({ field }) => (React.createElement(Checkbox, { ...field, "data-testid": `dns_config_${name}`, title: placeholder, subtitle: subtitle, disabled: processing })) }))))),
            React.createElement("div", { className: "col-12" },
                React.createElement("div", { className: "form__group form__group--settings mb-4" },
                    React.createElement("label", { className: "form__label form__label--with-desc" }, t('blocking_mode')),
                    React.createElement("div", { className: "form__desc form__desc--top" }, blockingModeDescriptions.map((desc) => (React.createElement("li", { key: desc }, desc)))),
                    React.createElement("div", { className: "custom-controls-stacked" },
                        React.createElement(Controller, { name: "blocking_mode", control: control, render: ({ field }) => (React.createElement(Radio, { ...field, options: blockingModeOptions, disabled: processing })) })))),
            blocking_mode === BLOCKING_MODES.custom_ip && (React.createElement(React.Fragment, null, customIps.map(({ label, description, name, validateIp }) => (React.createElement("div", { className: "col-12 col-sm-6", key: name },
                React.createElement("div", { className: "form__group form__group--settings" },
                    React.createElement(Controller, { name: name, control: control, rules: {
                            validate: {
                                required: validateRequiredValue,
                                ip: validateIp,
                            },
                        }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, "data-testid": "dns_config_blocked_response_ttl", type: "text", label: label, desc: description, error: fieldState.error?.message, disabled: processing })) }))))))),
            React.createElement("div", { className: "col-12 col-md-7" },
                React.createElement("div", { className: "form__group form__group--settings" },
                    React.createElement(Controller, { name: "blocked_response_ttl", control: control, rules: { validate: validateRequiredValue }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, "data-testid": "dns_config_blocked_response_ttl", type: "number", label: t('blocked_response_ttl'), desc: t('blocked_response_ttl_desc'), error: fieldState.error?.message, min: UINT32_RANGE.MIN, max: UINT32_RANGE.MAX, disabled: processing, onChange: (e) => {
                                const { value } = e.target;
                                field.onChange(toNumber(value));
                            } })) })))),
        React.createElement("button", { type: "submit", "data-testid": "dns_config_save", className: "btn btn-success btn-standard btn-large", disabled: isSubmitting || processing }, t('save_btn'))));
};
export default Form;

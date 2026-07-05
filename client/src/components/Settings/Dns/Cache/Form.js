import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import i18next from 'i18next';
import { clearDnsCache } from '../../../../actions/dnsConfig';
import { CACHE_CONFIG_FIELDS, UINT32_RANGE } from '../../../../helpers/constants';
import { replaceZeroWithEmptyString } from '../../../../helpers/helpers';
import { Checkbox } from '../../../ui/Controls/Checkbox';
const Form = ({ initialValues, onSubmit }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { processingSetConfig } = useSelector((state) => state.dnsConfig);
    const { register, handleSubmit, watch, control, formState: { isSubmitting }, } = useForm({
        mode: 'onBlur',
        defaultValues: {
            cache_enabled: initialValues?.cache_enabled || false,
            cache_size: initialValues?.cache_size || 0,
            cache_ttl_min: initialValues?.cache_ttl_min || 0,
            cache_ttl_max: initialValues?.cache_ttl_max || 0,
            cache_optimistic: initialValues?.cache_optimistic || false,
        },
    });
    const cache_enabled = watch('cache_enabled');
    const cache_size = watch('cache_size');
    const cache_ttl_min = watch('cache_ttl_min');
    const cache_ttl_max = watch('cache_ttl_max');
    const minExceedsMax = cache_ttl_min > 0 && cache_ttl_max > 0 && cache_ttl_min > cache_ttl_max;
    const cacheSizeZeroWhenEnabled = cache_enabled && cache_size === 0;
    const INPUTS_FIELDS = [
        {
            name: CACHE_CONFIG_FIELDS.cache_size,
            title: i18next.t('cache_size'),
            description: i18next.t('cache_size_desc'),
            placeholder: i18next.t('enter_cache_size'),
        },
        {
            name: CACHE_CONFIG_FIELDS.cache_ttl_min,
            title: i18next.t('cache_ttl_min_override'),
            description: i18next.t('cache_ttl_min_override_desc'),
            placeholder: i18next.t('enter_cache_ttl_min_override'),
        },
        {
            name: CACHE_CONFIG_FIELDS.cache_ttl_max,
            title: i18next.t('cache_ttl_max_override'),
            description: i18next.t('cache_ttl_max_override_desc'),
            placeholder: i18next.t('enter_cache_ttl_max_override'),
        },
    ];
    const handleClearCache = () => {
        if (window.confirm(t('confirm_dns_cache_clear'))) {
            dispatch(clearDnsCache());
        }
    };
    return (React.createElement("form", { onSubmit: handleSubmit(onSubmit) },
        React.createElement("div", { className: "row" },
            React.createElement("div", { className: "col-12 col-md-7" },
                React.createElement("div", { className: "form__group form__group--settings" },
                    React.createElement(Controller, { name: "cache_enabled", control: control, render: ({ field }) => (React.createElement(Checkbox, { ...field, "data-testid": "dns_cache_enabled", title: t('cache_enabled'), subtitle: t('cache_enabled_desc'), disabled: processingSetConfig })) }))),
            INPUTS_FIELDS.map(({ name, title, description, placeholder }) => (React.createElement("div", { className: "col-12", key: name },
                React.createElement("div", { className: "col-12 col-md-7 p-0" },
                    React.createElement("div", { className: "form__group form__group--settings" },
                        React.createElement("label", { htmlFor: name, className: "form__label form__label--with-desc" }, title),
                        React.createElement("div", { className: "form__desc form__desc--top" }, description),
                        React.createElement("input", { type: "number", "data-testid": `dns_${name}`, className: "form-control", placeholder: placeholder, disabled: processingSetConfig, min: 0, max: UINT32_RANGE.MAX, ...register(name, {
                                valueAsNumber: true,
                                setValueAs: (value) => replaceZeroWithEmptyString(value),
                            }) }),
                        name === CACHE_CONFIG_FIELDS.cache_size && cacheSizeZeroWhenEnabled && (React.createElement("span", { className: "form__message form__message--error" }, t('cache_size_validation')))))))),
            minExceedsMax && React.createElement("span", { className: "text-danger pl-3 pb-3" }, t('ttl_cache_validation'))),
        React.createElement("div", { className: "row" },
            React.createElement("div", { className: "col-12 col-md-7" },
                React.createElement("div", { className: "form__group form__group--settings" },
                    React.createElement(Controller, { name: "cache_optimistic", control: control, render: ({ field }) => (React.createElement(Checkbox, { ...field, "data-testid": "dns_cache_optimistic", title: t('cache_optimistic'), subtitle: t('cache_optimistic_desc'), disabled: processingSetConfig })) })))),
        React.createElement("button", { type: "submit", "data-testid": "dns_save", className: "btn btn-success btn-standard btn-large", disabled: isSubmitting || processingSetConfig || minExceedsMax || cacheSizeZeroWhenEnabled }, t('save_btn')),
        React.createElement("button", { type: "button", "data-testid": "dns_clear", className: "btn btn-outline-secondary btn-standard form__button", onClick: handleClearCache }, t('clear_cache'))));
};
export default Form;

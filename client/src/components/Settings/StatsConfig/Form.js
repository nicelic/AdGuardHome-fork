import React, { useEffect } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import i18next from 'i18next';
import { Controller, useForm } from 'react-hook-form';
import { STATS_INTERVALS_DAYS, DAY, RETENTION_CUSTOM, RETENTION_RANGE } from '../../../helpers/constants';
import '../FormButton.css';
import { Checkbox } from '../../ui/Controls/Checkbox';
import { Input } from '../../ui/Controls/Input';
import { toNumber } from '../../../helpers/form';
import { Textarea } from '../../ui/Controls/Textarea';
const getIntervalTitle = (interval) => {
    switch (interval) {
        case RETENTION_CUSTOM:
            return i18next.t('settings_custom');
        case DAY:
            return i18next.t('interval_24_hour');
        default:
            return i18next.t('interval_days', { count: interval / DAY });
    }
};
const defaultFormValues = {
    enabled: false,
    interval: DAY,
    customInterval: null,
    ignored: '',
    ignored_enabled: true,
};
export const Form = ({ initialValues, processing, processingReset, onSubmit, onReset }) => {
    const { t } = useTranslation();
    const { handleSubmit, watch, setValue, control, formState: { isSubmitting }, } = useForm({
        mode: 'onBlur',
        defaultValues: {
            ...defaultFormValues,
            ...initialValues,
        },
    });
    const intervalValue = watch('interval');
    const customIntervalValue = watch('customInterval');
    useEffect(() => {
        if (STATS_INTERVALS_DAYS.includes(intervalValue)) {
            setValue('customInterval', null);
        }
    }, [intervalValue]);
    const onSubmitForm = (data) => {
        onSubmit(data);
    };
    const disableSubmit = isSubmitting || processing || (intervalValue === RETENTION_CUSTOM && !customIntervalValue);
    return (React.createElement("form", { onSubmit: handleSubmit(onSubmitForm) },
        React.createElement("div", { className: "form__group form__group--settings" },
            React.createElement(Controller, { name: "enabled", control: control, render: ({ field }) => (React.createElement(Checkbox, { ...field, "data-testid": "stats_config_enabled", title: t('statistics_enable'), disabled: processing })) })),
        React.createElement("div", { className: "form__label form__label--with-desc" },
            React.createElement(Trans, null, "statistics_retention")),
        React.createElement("div", { className: "form__desc form__desc--top" },
            React.createElement(Trans, null, "statistics_retention_desc")),
        React.createElement("div", { className: "form__group form__group--settings mt-2" },
            React.createElement("div", { className: "custom-controls-stacked" },
                React.createElement("label", { className: "custom-control custom-radio" },
                    React.createElement("input", { type: "radio", "data-testid": "stats_config_interval", className: "custom-control-input", disabled: processing, checked: !STATS_INTERVALS_DAYS.includes(intervalValue), value: RETENTION_CUSTOM, onChange: (e) => {
                            setValue('interval', parseInt(e.target.value, 10));
                        } }),
                    React.createElement("span", { className: "custom-control-label" }, getIntervalTitle(RETENTION_CUSTOM))),
                !STATS_INTERVALS_DAYS.includes(intervalValue) && (React.createElement("div", { className: "form__group--input" },
                    React.createElement("div", { className: "form__desc form__desc--top" }, i18next.t('custom_retention_input')),
                    React.createElement(Controller, { name: "customInterval", control: control, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, "data-testid": "stats_config_custom_interval", disabled: processing, error: fieldState.error?.message, min: RETENTION_RANGE.MIN, max: RETENTION_RANGE.MAX, onChange: (e) => {
                                const { value } = e.target;
                                field.onChange(toNumber(value));
                            } })) }))),
                STATS_INTERVALS_DAYS.map((interval) => (React.createElement("label", { key: interval, className: "custom-control custom-radio" },
                    React.createElement("input", { type: "radio", className: "custom-control-input", disabled: processing, value: interval, checked: intervalValue === interval, onChange: (e) => {
                            setValue('interval', parseInt(e.target.value, 10));
                        } }),
                    React.createElement("span", { className: "custom-control-label" }, getIntervalTitle(interval))))))),
        React.createElement("div", { className: "form__group form__group--settings" },
            React.createElement(Controller, { name: "ignored_enabled", control: control, render: ({ field }) => (React.createElement(Checkbox, { ...field, "data-testid": "stats_config_ignored_enabled", title: t('ignore_domains_title'), subtitle: t('ignore_domains_desc_stats'), disabled: processing })) })),
        React.createElement("div", { className: "form__group form__group--settings" },
            React.createElement(Controller, { name: "ignored", control: control, render: ({ field, fieldState }) => (React.createElement(Textarea, { ...field, "data-testid": "stats_config_ignored", placeholder: t('ignore_domains'), className: "text-input", disabled: processing, error: fieldState.error?.message, trimOnBlur: true })) })),
        React.createElement("div", { className: "mt-5" },
            React.createElement("button", { type: "submit", "data-testid": "stats_config_save", className: "btn btn-success btn-standard btn-large", disabled: disableSubmit },
                React.createElement(Trans, null, "save_btn")),
            React.createElement("button", { type: "button", "data-testid": "stats_config_clear", className: "btn btn-outline-secondary btn-standard form__button", onClick: onReset, disabled: processingReset },
                React.createElement(Trans, null, "statistics_clear")))));
};

import React, { useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { UINT32_RANGE } from '../../../helpers/constants';
import { validateIpv6, validateRequiredValue } from '../../../helpers/validators';
import { Input } from '../../ui/Controls/Input';
import { toNumber } from '../../../helpers/form';
const FormDHCPv6 = ({ processingConfig, ipv6placeholders, interfaces, onSubmit }) => {
    const { t } = useTranslation();
    const { handleSubmit, formState: { isSubmitting, isValid }, control, watch, } = useFormContext();
    const interfaceName = watch('interface_name');
    const isInterfaceIncludesIpv6 = interfaces?.[interfaceName]?.ipv6_addresses;
    const formValues = watch('v6');
    const isEmptyConfig = !Object.values(formValues || {}).some(Boolean);
    const isDisabled = useMemo(() => {
        return isSubmitting || !isValid || processingConfig || !isInterfaceIncludesIpv6 || isEmptyConfig;
    }, [isSubmitting, isValid, processingConfig, isInterfaceIncludesIpv6, isEmptyConfig]);
    return (React.createElement("form", { onSubmit: handleSubmit(onSubmit) },
        React.createElement("div", { className: "row" },
            React.createElement("div", { className: "col-lg-6" },
                React.createElement("div", { className: "form__group mb-0" },
                    React.createElement("div", { className: "row" },
                        React.createElement("div", { className: "col-12" },
                            React.createElement("label", null, t('dhcp_form_range_title'))),
                        React.createElement("div", { className: "col" },
                            React.createElement(Controller, { name: "v6.range_start", control: control, rules: {
                                    validate: isInterfaceIncludesIpv6
                                        ? {
                                            ipv6: validateIpv6,
                                            required: validateRequiredValue,
                                        }
                                        : undefined,
                                }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "text", "data-testid": "v6_range_start", placeholder: t(ipv6placeholders.range_start), error: fieldState.error?.message, disabled: !isInterfaceIncludesIpv6 })) })),
                        React.createElement("div", { className: "col" },
                            React.createElement(Controller, { name: "v6.range_end", control: control, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "text", "data-testid": "v6_range_end", placeholder: t(ipv6placeholders.range_end), error: fieldState.error?.message, disabled: true })) })))))),
        React.createElement("div", { className: "row" },
            React.createElement("div", { className: "col-lg-6 form__group form__group--settings" },
                React.createElement(Controller, { name: "v6.lease_duration", control: control, rules: {
                        validate: isInterfaceIncludesIpv6
                            ? {
                                required: validateRequiredValue,
                            }
                            : undefined,
                    }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "number", "data-testid": "v6_lease_duration", label: t('dhcp_form_lease_title'), placeholder: t(ipv6placeholders.lease_duration), error: fieldState.error?.message, disabled: !isInterfaceIncludesIpv6, min: 1, max: UINT32_RANGE.MAX, onChange: (e) => {
                            const { value } = e.target;
                            field.onChange(toNumber(value));
                        } })) }))),
        React.createElement("div", { className: "btn-list" },
            React.createElement("button", { "data-testid": "v6_save", type: "submit", className: "btn btn-success btn-standard", disabled: isDisabled }, t('save_config')))));
};
export default FormDHCPv6;

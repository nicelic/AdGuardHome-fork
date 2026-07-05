import React, { useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { UINT32_RANGE } from '../../../helpers/constants';
import { validateGatewaySubnetMask, validateIpForGatewaySubnetMask, validateIpv4, validateIpv4RangeEnd, validateNotInRange, validateRequiredValue, } from '../../../helpers/validators';
import { Input } from '../../ui/Controls/Input';
import { toNumber } from '../../../helpers/form';
const FormDHCPv4 = ({ processingConfig, ipv4placeholders, interfaces, onSubmit }) => {
    const { t } = useTranslation();
    const { handleSubmit, formState: { errors, isSubmitting }, control, watch, } = useFormContext();
    const interfaceName = watch('interface_name');
    const isInterfaceIncludesIpv4 = interfaces?.[interfaceName]?.ipv4_addresses;
    const formValues = watch('v4');
    const isEmptyConfig = !Object.values(formValues || {}).some(Boolean);
    const hasV4Errors = errors.v4 && Object.keys(errors.v4).length > 0;
    const isDisabled = useMemo(() => {
        return isSubmitting || hasV4Errors || processingConfig || !isInterfaceIncludesIpv4 || isEmptyConfig;
    }, [isSubmitting, hasV4Errors, processingConfig, isInterfaceIncludesIpv4, isEmptyConfig]);
    return (React.createElement("form", { onSubmit: handleSubmit(onSubmit) },
        React.createElement("div", { className: "row" },
            React.createElement("div", { className: "col-lg-6" },
                React.createElement("div", { className: "form__group form__group--settings" },
                    React.createElement(Controller, { name: "v4.gateway_ip", control: control, rules: {
                            validate: {
                                ipv4: validateIpv4,
                                required: (value) => (isEmptyConfig ? undefined : validateRequiredValue(value)),
                                notInRange: validateNotInRange,
                            },
                        }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "text", "data-testid": "v4_gateway_ip", label: t('dhcp_form_gateway_input'), placeholder: t(ipv4placeholders.gateway_ip), error: fieldState.error?.message, disabled: !isInterfaceIncludesIpv4 })) })),
                React.createElement("div", { className: "form__group form__group--settings" },
                    React.createElement(Controller, { name: "v4.subnet_mask", control: control, rules: {
                            validate: {
                                required: (value) => (isEmptyConfig ? undefined : validateRequiredValue(value)),
                                subnet: validateGatewaySubnetMask,
                            },
                        }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "text", "data-testid": "v4_subnet_mask", label: t('dhcp_form_subnet_input'), placeholder: t(ipv4placeholders.subnet_mask), error: fieldState.error?.message, disabled: !isInterfaceIncludesIpv4 })) }))),
            React.createElement("div", { className: "col-lg-6" },
                React.createElement("div", { className: "form__group mb-0" },
                    React.createElement("div", { className: "row" },
                        React.createElement("div", { className: "col-12" },
                            React.createElement("label", null, t('dhcp_form_range_title'))),
                        React.createElement("div", { className: "col" },
                            React.createElement(Controller, { name: "v4.range_start", control: control, rules: {
                                    validate: {
                                        ipv4: validateIpv4,
                                        gateway: validateIpForGatewaySubnetMask,
                                    },
                                }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "text", "data-testid": "v4_range_start", placeholder: t(ipv4placeholders.range_start), error: fieldState.error?.message, disabled: !isInterfaceIncludesIpv4 })) })),
                        React.createElement("div", { className: "col" },
                            React.createElement(Controller, { name: "v4.range_end", control: control, rules: {
                                    validate: {
                                        ipv4: validateIpv4,
                                        rangeEnd: validateIpv4RangeEnd,
                                        gateway: validateIpForGatewaySubnetMask,
                                    },
                                }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "text", "data-testid": "v4_range_end", placeholder: t(ipv4placeholders.range_end), error: fieldState.error?.message, disabled: !isInterfaceIncludesIpv4 })) })))),
                React.createElement("div", { className: "form__group form__group--settings" },
                    React.createElement(Controller, { name: "v4.lease_duration", control: control, rules: {
                            validate: {
                                required: (value) => (isEmptyConfig ? undefined : validateRequiredValue(value)),
                            },
                        }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "number", "data-testid": "v4_lease_duration", label: t('dhcp_form_lease_title'), placeholder: t(ipv4placeholders.lease_duration), error: fieldState.error?.message, disabled: !isInterfaceIncludesIpv4, min: 1, max: UINT32_RANGE.MAX, value: field.value ?? '', onChange: (e) => {
                                const { value } = e.target;
                                field.onChange(toNumber(value));
                            } })) })))),
        React.createElement("div", { className: "btn-list" },
            React.createElement("button", { "data-testid": "v4_save", type: "submit", className: "btn btn-success btn-standard", disabled: isDisabled }, t('save_config')))));
};
export default FormDHCPv4;

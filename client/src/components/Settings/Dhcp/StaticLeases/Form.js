import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import { normalizeMac } from '../../../../helpers/form';
import { validateIpv4, validateMac, validateRequiredValue, validateIpv4InCidr, validateIpGateway, } from '../../../../helpers/validators';
import { toggleLeaseModal } from '../../../../actions';
import { Input } from '../../../ui/Controls/Input';
export const Form = ({ initialValues, processingAdding, cidr, isEdit, onSubmit }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const dynamicLease = useSelector((store) => store.dhcp.leaseModalConfig, shallowEqual);
    const { handleSubmit, control, reset, formState: { isSubmitting, isDirty }, } = useForm({
        defaultValues: initialValues,
        mode: 'onBlur',
    });
    const onClick = () => {
        reset();
        dispatch(toggleLeaseModal());
    };
    return (React.createElement("form", { onSubmit: handleSubmit(onSubmit) },
        React.createElement("div", { className: "modal-body" },
            React.createElement("div", { className: "form__group" },
                React.createElement(Controller, { name: "mac", control: control, rules: { validate: { required: validateRequiredValue, mac: validateMac } }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "text", "data-testid": "static_lease_mac", placeholder: t('form_enter_mac'), disabled: isEdit, error: fieldState.error?.message, onChange: (e) => field.onChange(normalizeMac(e.target.value)) })) })),
            React.createElement("div", { className: "form__group" },
                React.createElement(Controller, { name: "ip", control: control, rules: {
                        validate: {
                            required: validateRequiredValue,
                            ipv4: validateIpv4,
                            inCidr: validateIpv4InCidr,
                            gateway: validateIpGateway,
                        },
                    }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "text", "data-testid": "static_lease_ip", error: fieldState.error?.message, placeholder: t('form_enter_subnet_ip', { cidr }) })) })),
            React.createElement("div", { className: "form__group" },
                React.createElement(Controller, { name: "hostname", control: control, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "text", "data-testid": "static_lease_hostname", error: fieldState.error?.message, placeholder: t('form_enter_hostname') })) }))),
        React.createElement("div", { className: "modal-footer" },
            React.createElement("div", { className: "btn-list" },
                React.createElement("button", { type: "button", "data-testid": "static_lease_cancel", className: "btn btn-secondary btn-standard", disabled: isSubmitting, onClick: onClick },
                    React.createElement(Trans, null, "cancel_btn")),
                React.createElement("button", { type: "submit", "data-testid": "static_lease_save", className: "btn btn-success btn-standard", disabled: isSubmitting || processingAdding || (!isDirty && !dynamicLease) },
                    React.createElement(Trans, null, "save_btn"))))));
};

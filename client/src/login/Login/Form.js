import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Input } from '../../components/ui/Controls/Input';
import { validateRequiredValue } from '../../helpers/validators';
const Form = ({ onSubmit, processing }) => {
    const { t } = useTranslation();
    const { handleSubmit, control, formState: { isValid }, } = useForm({
        mode: 'onChange',
        defaultValues: {
            username: '',
            password: '',
        },
    });
    return (React.createElement("form", { onSubmit: handleSubmit(onSubmit), className: "card" },
        React.createElement("div", { className: "card-body p-6" },
            React.createElement("div", { className: "form__group form__group--settings" },
                React.createElement(Controller, { name: "username", control: control, rules: { validate: validateRequiredValue }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, "data-testid": "username", type: "text", label: t('username_label'), placeholder: t('username_placeholder'), error: fieldState.error?.message, autoComplete: "username", autoCapitalize: "none", disabled: processing })) })),
            React.createElement("div", { className: "form__group form__group--settings" },
                React.createElement(Controller, { name: "password", control: control, rules: { validate: validateRequiredValue }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, "data-testid": "password", type: "password", label: t('password_label'), placeholder: t('password_placeholder'), error: fieldState.error?.message, autoComplete: "current-password", disabled: processing })) })),
            React.createElement("div", { className: "form-footer" },
                React.createElement("button", { "data-testid": "sign_in", type: "submit", className: "btn btn-success btn-block", disabled: processing || !isValid }, t('sign_in'))))));
};
export default Form;

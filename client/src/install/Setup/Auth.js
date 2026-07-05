import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';
import Controls from './Controls';
import { validatePasswordLength, validateRequiredValue } from '../../helpers/validators';
import { Input } from '../../components/ui/Controls/Input';
export const Auth = ({ onAuthSubmit }) => {
    const { t } = useTranslation();
    const { handleSubmit, watch, control, formState: { isDirty, isValid }, } = useForm({
        mode: 'onBlur',
        defaultValues: {
            username: '',
            password: '',
            confirm_password: '',
        },
    });
    const password = watch('password');
    const validateConfirmPassword = (value) => {
        if (value !== password) {
            return t('form_error_password');
        }
        return undefined;
    };
    return (React.createElement("form", { className: "setup__step", onSubmit: handleSubmit(onAuthSubmit) },
        React.createElement("div", { className: "setup__group" },
            React.createElement("div", { className: "setup__subtitle" },
                React.createElement(Trans, null, "install_auth_title")),
            React.createElement("p", { className: "setup__desc" },
                React.createElement(Trans, null, "install_auth_desc")),
            React.createElement("div", { className: "form-group" },
                React.createElement(Controller, { name: "username", control: control, rules: { validate: validateRequiredValue }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "text", "data-testid": "install_username", label: t('install_auth_username'), placeholder: t('install_auth_username_enter'), error: fieldState.error?.message, autoComplete: "username" })) })),
            React.createElement("div", { className: "form-group" },
                React.createElement(Controller, { name: "password", control: control, rules: {
                        validate: {
                            required: validateRequiredValue,
                            passwordLength: validatePasswordLength,
                        },
                    }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "password", "data-testid": "install_password", label: t('install_auth_password'), placeholder: t('install_auth_password_enter'), error: fieldState.error?.message, autoComplete: "new-password" })) })),
            React.createElement("div", { className: "form-group" },
                React.createElement(Controller, { name: "confirm_password", control: control, rules: {
                        validate: {
                            required: validateRequiredValue,
                            confirmPassword: validateConfirmPassword,
                        },
                    }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "password", "data-testid": "install_confirm_password", label: t('install_auth_confirm'), placeholder: t('install_auth_confirm'), error: fieldState.error?.message, autoComplete: "new-password" })) }))),
        React.createElement(Controls, { isDirty: isDirty, isValid: isValid })));
};

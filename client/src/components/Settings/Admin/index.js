import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import apiClient from '../../../api/Api';
import { addErrorToast } from '../../../actions/toasts';
import { HTML_PAGES } from '../../../helpers/constants';
import { validatePasswordLength, validateRequiredValue } from '../../../helpers/validators';
import Card from '../../ui/Card';
import PageTitle from '../../ui/PageTitle';
import { Input } from '../../ui/Controls/Input';
const Admin = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const currentName = useSelector((state) => state.dashboard.name);
    const [processing, setProcessing] = useState(false);
    const { handleSubmit, control, watch, formState: { isValid }, } = useForm({
        mode: 'onChange',
        defaultValues: {
            current_name: '',
            current_password: '',
            new_name: '',
            new_password: '',
            confirm_new_password: '',
        },
    });
    const newPassword = watch('new_password');
    const validateConfirmPassword = (value) => {
        if (value !== newPassword) {
            return t('form_error_password');
        }
        return undefined;
    };
    const onSubmit = async (values) => {
        setProcessing(true);
        try {
            await apiClient.updateAdminCredentials({
                current_name: values.current_name,
                current_password: values.current_password,
                new_name: values.new_name,
                new_password: values.new_password,
            });
            window.location.replace(HTML_PAGES.LOGIN);
        }
        catch (error) {
            dispatch(addErrorToast({ error }));
        }
        finally {
            setProcessing(false);
        }
    };
    const submitClassName = processing ? 'btn btn-success btn-loading' : 'btn btn-success';
    return (React.createElement(React.Fragment, null,
        React.createElement(PageTitle, { title: t('admin_settings'), subtitle: t('admin_settings_description') }),
        React.createElement("div", { className: "content" },
            React.createElement("div", { className: "row" },
                React.createElement("div", { className: "col-md-12" },
                    React.createElement(Card, { title: t('admin_settings'), subtitle: t('admin_settings_plaintext_notice'), bodyType: "card-body box-body--settings" },
                        currentName && (React.createElement("div", { className: "form__desc mb-4" }, t('admin_current_account', { name: currentName }))),
                        React.createElement("form", { onSubmit: handleSubmit(onSubmit), autoComplete: "off" },
                            React.createElement("div", { className: "form__label--bold form__label--top form__label--bot" }, t('admin_current_credentials')),
                            React.createElement(Controller, { name: "current_name", control: control, rules: { validate: validateRequiredValue }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "text", label: t('admin_current_username'), error: fieldState.error?.message, autoComplete: "off", autoCapitalize: "none", spellCheck: false, trimOnBlur: true, disabled: processing })) }),
                            React.createElement(Controller, { name: "current_password", control: control, rules: { validate: validateRequiredValue }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "text", label: t('admin_current_password'), error: fieldState.error?.message, autoComplete: "off", spellCheck: false, disabled: processing })) }),
                            React.createElement("div", { className: "form__label--bold form__label--top form__label--bot mt-5" }, t('admin_new_credentials')),
                            React.createElement(Controller, { name: "new_name", control: control, rules: { validate: validateRequiredValue }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "text", label: t('admin_new_username'), error: fieldState.error?.message, autoComplete: "off", autoCapitalize: "none", spellCheck: false, trimOnBlur: true, disabled: processing })) }),
                            React.createElement(Controller, { name: "new_password", control: control, rules: {
                                    validate: {
                                        required: validateRequiredValue,
                                        passwordLength: validatePasswordLength,
                                    },
                                }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "text", label: t('admin_new_password'), error: fieldState.error?.message, autoComplete: "off", spellCheck: false, disabled: processing })) }),
                            React.createElement(Controller, { name: "confirm_new_password", control: control, rules: {
                                    validate: {
                                        required: validateRequiredValue,
                                        confirmPassword: validateConfirmPassword,
                                    },
                                }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "text", label: t('admin_confirm_new_password'), error: fieldState.error?.message, autoComplete: "off", spellCheck: false, disabled: processing })) }),
                            React.createElement("div", { className: "btn-list mt-4" },
                                React.createElement("button", { type: "submit", className: submitClassName, disabled: processing || !isValid }, t('save_btn'))))))))));
};
export default Admin;

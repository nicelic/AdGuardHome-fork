import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';
import { validateAnswer, validateDomain, validateRequiredValue } from '../../../helpers/validators';
import { Input } from '../../ui/Controls/Input';
const Form = ({ processingAdd, currentRewrite, toggleRewritesModal, onSubmit }) => {
    const { t } = useTranslation();
    const { handleSubmit, reset, control, formState: { isDirty, isSubmitting }, } = useForm({
        mode: 'onBlur',
        defaultValues: {
            domain: currentRewrite?.domain || '',
            answer: currentRewrite?.answer || '',
        },
    });
    const handleFormSubmit = async (data) => {
        if (onSubmit) {
            await onSubmit(data);
        }
    };
    return (React.createElement("form", { onSubmit: handleSubmit(handleFormSubmit) },
        React.createElement("div", { className: "modal-body" },
            React.createElement("div", { className: "form__desc form__desc--top" },
                React.createElement(Trans, null, "domain_desc")),
            React.createElement("div", { className: "form__group" },
                React.createElement(Controller, { name: "domain", control: control, rules: {
                        validate: {
                            validate: validateDomain,
                            required: validateRequiredValue,
                        },
                    }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "text", "data-testid": "rewrites_domain", placeholder: t('form_domain'), error: fieldState.error?.message })) })),
            React.createElement(Trans, null, "examples_title"),
            ":",
            React.createElement("ol", { className: "leading-loose" },
                React.createElement("li", null,
                    React.createElement("code", null, "example.org"),
                    " \u2013 ",
                    React.createElement(Trans, null, "example_rewrite_domain")),
                React.createElement("li", null,
                    React.createElement("code", null, "*.example.org"),
                    " \u2013\u00A0",
                    React.createElement("span", null,
                        React.createElement(Trans, { components: [React.createElement("code", { key: "0" }, "text")] }, "example_rewrite_wildcard")))),
            React.createElement("div", { className: "form__group" },
                React.createElement(Controller, { name: "answer", control: control, rules: {
                        validate: {
                            validate: validateAnswer,
                            required: validateRequiredValue,
                        },
                    }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "text", "data-testid": "rewrites_answer", placeholder: t('form_answer'), error: fieldState.error?.message })) }))),
        React.createElement("ul", null, ['rewrite_ip_address', 'rewrite_domain_name', 'rewrite_A', 'rewrite_AAAA'].map((str) => (React.createElement("li", { key: str },
            React.createElement(Trans, { components: [React.createElement("code", { key: "0" }, "text")] }, str))))),
        React.createElement("div", { className: "modal-footer" },
            React.createElement("div", { className: "btn-list" },
                React.createElement("button", { type: "button", "data-testid": "rewrites_cancel", className: "btn btn-secondary btn-standard", disabled: isSubmitting || processingAdd, onClick: () => {
                        reset();
                        toggleRewritesModal();
                    } },
                    React.createElement(Trans, null, "cancel_btn")),
                React.createElement("button", { type: "submit", "data-testid": "rewrites_save", className: "btn btn-success btn-standard", disabled: isSubmitting || !isDirty || processingAdd },
                    React.createElement(Trans, null, "save_btn"))))));
};
export default Form;

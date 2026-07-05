import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';
import { CLIENT_ID_LINK } from '../../../../helpers/constants';
import { removeEmptyLines, trimMultilineString } from '../../../../helpers/helpers';
import { Textarea } from '../../../ui/Controls/Textarea';
const Form = ({ initialValues, onSubmit, processingSet }) => {
    const { t } = useTranslation();
    const { control, handleSubmit, watch, formState: { isSubmitting }, } = useForm({
        mode: 'onBlur',
        defaultValues: {
            allowed_clients: initialValues?.allowed_clients || '',
            disallowed_clients: initialValues?.disallowed_clients || '',
            blocked_hosts: initialValues?.blocked_hosts || '',
        },
    });
    const allowedClients = watch('allowed_clients');
    const fields = [
        {
            id: 'allowed_clients',
            title: t('access_allowed_title'),
            subtitle: (React.createElement(Trans, { components: {
                    a: React.createElement("a", { href: CLIENT_ID_LINK, target: "_blank", rel: "noopener noreferrer" }),
                } }, "access_allowed_desc")),
            normalizeOnBlur: removeEmptyLines,
        },
        {
            id: 'disallowed_clients',
            title: t('access_disallowed_title'),
            subtitle: (React.createElement(Trans, { components: {
                    a: React.createElement("a", { href: CLIENT_ID_LINK, target: "_blank", rel: "noopener noreferrer" }),
                } }, "access_disallowed_desc")),
            normalizeOnBlur: trimMultilineString,
        },
        {
            id: 'blocked_hosts',
            title: t('access_blocked_title'),
            subtitle: t('access_blocked_desc'),
            normalizeOnBlur: removeEmptyLines,
        },
    ];
    const renderField = ({ id, title, subtitle, normalizeOnBlur, }) => {
        const disabled = allowedClients && id === 'disallowed_clients';
        return (React.createElement("div", { key: id, className: "form__group mb-5" },
            React.createElement("label", { className: "form__label form__label--with-desc", htmlFor: id },
                title,
                disabled && React.createElement(React.Fragment, null,
                    "\u00A0(",
                    t('disabled'),
                    ")")),
            React.createElement("div", { className: "form__desc form__desc--top" }, subtitle),
            React.createElement(Controller, { name: id, control: control, render: ({ field }) => (React.createElement(Textarea, { ...field, id: id, "data-testid": id, disabled: disabled || processingSet, onBlur: (e) => {
                        field.onChange(normalizeOnBlur(e.target.value));
                    } })) })));
    };
    return (React.createElement("form", { onSubmit: handleSubmit(onSubmit) },
        fields.map((f) => renderField(f)),
        React.createElement("div", { className: "card-actions" },
            React.createElement("div", { className: "btn-list" },
                React.createElement("button", { type: "submit", "data-testid": "access_save", className: "btn btn-success btn-standard", disabled: isSubmitting || processingSet }, t('save_config'))))));
};
export default Form;

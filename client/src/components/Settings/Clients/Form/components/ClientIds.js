import React from 'react';
import { Controller, useFieldArray, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Input } from '../../../../ui/Controls/Input';
import { validateClientId, validateRequiredValue } from '../../../../../helpers/validators';
export const ClientIds = () => {
    const { t } = useTranslation();
    const { control } = useFormContext();
    const { fields, append, remove } = useFieldArray({
        control,
        name: 'ids',
    });
    return (React.createElement("div", { className: "form__group" },
        fields.map((field, index) => (React.createElement("div", { key: field.id, className: "mb-1" },
            React.createElement(Controller, { name: `ids.${index}.name`, control: control, rules: {
                    validate: {
                        required: (value) => validateRequiredValue(value),
                        validId: (value) => validateClientId(value),
                    },
                }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "text", "data-testid": `clients_id_${index}`, placeholder: t('form_enter_id'), error: fieldState.error?.message, onBlur: (event) => {
                        const trimmedValue = event.target.value.trim();
                        field.onBlur();
                        field.onChange(trimmedValue);
                    }, rightAddon: index !== 0 && (React.createElement("span", { className: "input-group-append" },
                        React.createElement("button", { type: "button", "data-testid": `clients_id_remove_${index}`, className: "btn btn-secondary btn-icon btn-icon--green", onClick: () => remove(index) },
                            React.createElement("svg", { className: "icon icon--24" },
                                React.createElement("use", { xlinkHref: "#cross" }))))) })) })))),
        React.createElement("button", { type: "button", "data-testid": "clients_id_add", className: "btn btn-link btn-block btn-sm", onClick: () => append({ name: '' }), title: t('form_add_id') },
            React.createElement("svg", { className: "icon icon--24" },
                React.createElement("use", { xlinkHref: "#plus" })))));
};

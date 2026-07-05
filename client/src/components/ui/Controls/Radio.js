import React, { forwardRef } from 'react';
export const Radio = forwardRef(({ disabled, onChange, value, options, name, error, ...rest }, ref) => {
    const getId = (label) => (name ? `${label}_${name}` : label);
    return (React.createElement("div", null,
        options.map((o) => {
            const checked = value === o.value;
            return (React.createElement("label", { key: `${getId(o.label)}`, htmlFor: getId(o.label), className: "custom-control custom-radio" },
                React.createElement("input", { id: getId(o.label), "data-testid": o.value, type: "radio", className: "custom-control-input", onChange: () => onChange(o.value), checked: checked, disabled: disabled, ref: ref, ...rest }),
                React.createElement("span", { className: "custom-control-label" }, o.label),
                o.desc && React.createElement("span", { className: "checkbox__label-subtitle" }, o.desc)));
        }),
        !disabled && error && React.createElement("span", { className: "form__message form__message--error" }, error)));
});
Radio.displayName = 'Radio';

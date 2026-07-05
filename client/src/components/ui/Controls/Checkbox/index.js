import React, { forwardRef } from 'react';
import clsx from 'clsx';
import './checkbox.css';
export const Checkbox = forwardRef(({ title, subtitle, value, name, disabled, error, className = 'checkbox--form', onChange, onBlur, ...rest }, ref) => (React.createElement(React.Fragment, null,
    React.createElement("label", { className: clsx('checkbox', className) },
        React.createElement("span", { className: "checkbox__marker" }),
        React.createElement("input", { name: name, type: "checkbox", className: "checkbox__input", disabled: disabled, checked: value, onChange: (e) => onChange(e.target.checked), onBlur: onBlur, ref: ref, ...rest }),
        React.createElement("span", { className: "checkbox__label" },
            React.createElement("span", { className: "checkbox__label-text checkbox__label-text--long" },
                React.createElement("span", { className: "checkbox__label-title" }, title),
                subtitle && React.createElement("span", { className: "checkbox__label-subtitle" }, subtitle)))),
    error && React.createElement("div", { className: "form__message form__message--error" }, error))));
Checkbox.displayName = 'Checkbox';

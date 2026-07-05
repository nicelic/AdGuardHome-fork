import React from 'react';
import cn from 'classnames';
export const ServiceField = React.forwardRef(({ name, value, onChange, onBlur, placeholder, disabled, className, icon, error, ...rest }, ref) => (React.createElement(React.Fragment, null,
    React.createElement("label", { className: cn('service custom-switch', className) },
        React.createElement("input", { name: name, type: "checkbox", className: "custom-switch-input", checked: !!value, onChange: onChange, onBlur: onBlur, ref: ref, disabled: disabled, ...rest }),
        React.createElement("span", { className: "service__switch custom-switch-indicator" }),
        React.createElement("span", { className: "service__text", title: placeholder }, placeholder),
        icon && React.createElement("div", { dangerouslySetInnerHTML: { __html: window.atob(icon) }, className: "service__icon" })),
    !disabled && error && React.createElement("span", { className: "form__message form__message--error" }, error))));
ServiceField.displayName = 'ServiceField';

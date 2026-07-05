import React, { forwardRef } from 'react';
import clsx from 'clsx';
export const Select = forwardRef(({ name, label, className, error, children, ...rest }, ref) => (React.createElement("div", { className: clsx('form-group', { 'has-error': !!error }) },
    label && (React.createElement("label", { className: "form__label", htmlFor: name }, label)),
    React.createElement("div", { className: "input-group" },
        React.createElement("select", { className: clsx('form-control custom-select', className), ref: ref, ...rest }, children)),
    error && React.createElement("div", { className: "form__message form__message--error mt-1" }, error))));
Select.displayName = 'Select';

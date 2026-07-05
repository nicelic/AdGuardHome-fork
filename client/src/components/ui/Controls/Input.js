import React, { forwardRef } from 'react';
import clsx from 'clsx';
export const Input = forwardRef(({ name, label, desc, className, leftAddon, rightAddon, error, trimOnBlur, onBlur, ...rest }, ref) => (React.createElement("div", { className: clsx('form-group', { 'has-error': !!error }) },
    label && (React.createElement("label", { className: clsx('form__label', { 'form__label--with-desc': !!desc }), htmlFor: name }, label)),
    desc && React.createElement("div", { className: "form__desc form__desc--top" }, desc),
    React.createElement("div", { className: "input-group" },
        leftAddon && React.createElement("div", null, leftAddon),
        React.createElement("input", { className: clsx('form-control', { 'is-invalid': !!error }, className), ref: ref, onBlur: (e) => {
                if (trimOnBlur) {
                    e.target.value = e.target.value.trim();
                    rest.onChange(e);
                }
                if (onBlur) {
                    onBlur(e);
                }
            }, ...rest }),
        rightAddon && React.createElement("div", null, rightAddon)),
    error && React.createElement("div", { className: "form__message form__message--error mt-1" }, error))));
Input.displayName = 'Input';

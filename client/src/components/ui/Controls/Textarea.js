import React, { forwardRef } from 'react';
import clsx from 'clsx';
import { trimLinesAndRemoveEmpty } from '../../../helpers/helpers';
export const Textarea = forwardRef(({ name, label, desc, className, wrapperClassName, error, trimOnBlur, onBlur, ...rest }, ref) => (React.createElement("div", { className: clsx('form-group', wrapperClassName, { 'has-error': !!error }) },
    label && (React.createElement("label", { className: clsx('form__label', { 'form__label--with-desc': !!desc }), htmlFor: name }, label)),
    desc && React.createElement("div", { className: "form__desc form__desc--top" }, desc),
    React.createElement("textarea", { className: clsx('form-control form-control--textarea form-control--textarea-small font-monospace', className), ref: ref, onBlur: (e) => {
            if (trimOnBlur) {
                const normalizedValue = trimLinesAndRemoveEmpty(e.target.value);
                rest.onChange(normalizedValue);
            }
            if (onBlur) {
                onBlur(e);
            }
        }, ...rest }),
    error && React.createElement("div", { className: "form__message form__message--error" }, error))));
Textarea.displayName = 'Textarea';

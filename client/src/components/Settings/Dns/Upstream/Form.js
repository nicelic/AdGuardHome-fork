import React, { useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';
import { testUpstreamWithFormValues } from '../../../../actions';
import { DNS_REQUEST_OPTIONS, UINT32_RANGE, UPSTREAM_CONFIGURATION_WIKI_LINK } from '../../../../helpers/constants';
import { removeEmptyLines } from '../../../../helpers/helpers';
import { getTextareaCommentsHighlight, syncScroll } from '../../../../helpers/highlightTextareaComments';
import '../../../ui/texareaCommentsHighlight.css';
import Examples from './Examples';
import { Checkbox } from '../../../ui/Controls/Checkbox';
import { Textarea } from '../../../ui/Controls/Textarea';
import { Radio } from '../../../ui/Controls/Radio';
import { Input } from '../../../ui/Controls/Input';
import { validateRequiredValue } from '../../../../helpers/validators';
import { toNumber } from '../../../../helpers/form';
const UPSTREAM_DNS_NAME = 'upstream_dns';
const Form = ({ initialValues, onSubmit }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const textareaRef = useRef(null);
    const { control, handleSubmit, watch, formState: { isSubmitting }, } = useForm({
        mode: 'onBlur',
        defaultValues: {
            upstream_dns: initialValues?.upstream_dns || '',
            upstream_mode: initialValues?.upstream_mode || DNS_REQUEST_OPTIONS.LOAD_BALANCING,
            fallback_dns: initialValues?.fallback_dns || '',
            bootstrap_dns: initialValues?.bootstrap_dns || '',
            local_ptr_upstreams: initialValues?.local_ptr_upstreams || '',
            use_private_ptr_resolvers: initialValues?.use_private_ptr_resolvers || false,
            resolve_clients: initialValues?.resolve_clients || false,
            upstream_timeout: initialValues?.upstream_timeout || 0,
        },
    });
    const upstream_dns = watch('upstream_dns');
    const processingTestUpstream = useSelector((state) => state.settings.processingTestUpstream);
    const processingSetConfig = useSelector((state) => state.dnsConfig.processingSetConfig);
    const defaultLocalPtrUpstreams = useSelector((state) => state.dnsConfig.default_local_ptr_upstreams);
    const upstream_dns_file = useSelector((state) => state.dnsConfig.upstream_dns_file);
    const handleUpstreamTest = () => {
        const formValues = {
            bootstrap_dns: watch('bootstrap_dns'),
            upstream_dns: watch('upstream_dns'),
            local_ptr_upstreams: watch('local_ptr_upstreams'),
            fallback_dns: watch('fallback_dns'),
        };
        dispatch(testUpstreamWithFormValues(formValues));
    };
    const upstreamModeOptions = [
        {
            label: t('load_balancing'),
            desc: React.createElement(Trans, { components: { br: React.createElement("br", null), b: React.createElement("b", null) } }, "load_balancing_desc"),
            value: DNS_REQUEST_OPTIONS.LOAD_BALANCING,
        },
        {
            label: t('parallel_requests'),
            desc: React.createElement(Trans, { components: { br: React.createElement("br", null), b: React.createElement("b", null) } }, "upstream_parallel"),
            value: DNS_REQUEST_OPTIONS.PARALLEL,
        },
        {
            label: t('fastest_addr'),
            desc: React.createElement(Trans, { components: { br: React.createElement("br", null), b: React.createElement("b", null) } }, "fastest_addr_desc"),
            value: DNS_REQUEST_OPTIONS.FASTEST_ADDR,
        },
    ];
    return (React.createElement("form", { onSubmit: handleSubmit(onSubmit), className: "form--upstream" },
        React.createElement("div", { className: "row" },
            React.createElement("label", { className: "col form__label", htmlFor: "upstream_dns" },
                React.createElement(Trans, { components: {
                        a: React.createElement("a", { href: UPSTREAM_CONFIGURATION_WIKI_LINK, target: "_blank", rel: "noopener noreferrer" }),
                    } }, "upstream_dns_help"),
                ' ',
                React.createElement(Trans, { components: [
                        React.createElement("a", { href: "https://link.adtidy.org/forward.html?action=dns_kb_providers&from=ui&app=home", target: "_blank", rel: "noopener noreferrer", key: "0" }, "DNS providers"),
                    ] }, "dns_providers")),
            React.createElement("div", { className: "col-12 mb-4" },
                React.createElement("div", { className: "text-edit-container" },
                    React.createElement(Controller, { name: "upstream_dns", control: control, render: ({ field }) => (React.createElement(React.Fragment, null,
                            React.createElement(Textarea, { ...field, id: UPSTREAM_DNS_NAME, "data-testid": "upstream_dns", className: "form-control--textarea-large text-input", wrapperClassName: "mb-0", placeholder: t('upstream_dns'), disabled: !!upstream_dns_file || processingSetConfig || processingTestUpstream, onScroll: (e) => syncScroll(e, textareaRef), trimOnBlur: true }),
                            getTextareaCommentsHighlight(textareaRef, upstream_dns))) }))),
            React.createElement("div", { className: "col-12" },
                React.createElement(Examples, null),
                React.createElement("hr", null)),
            React.createElement("div", { className: "col-12 mb-4" },
                React.createElement(Controller, { name: "upstream_mode", control: control, render: ({ field }) => (React.createElement(Radio, { ...field, options: upstreamModeOptions, disabled: processingSetConfig || processingTestUpstream })) })),
            React.createElement("div", { className: "col-12" },
                React.createElement("label", { className: "form__label form__label--with-desc", htmlFor: "fallback_dns" }, t('fallback_dns_title')),
                React.createElement("div", { className: "form__desc form__desc--top" }, t('fallback_dns_desc')),
                React.createElement(Controller, { name: "fallback_dns", control: control, render: ({ field }) => (React.createElement(Textarea, { ...field, id: "fallback_dns", "data-testid": "fallback_dns", wrapperClassName: "mb-0", placeholder: t('fallback_dns_placeholder'), disabled: processingSetConfig, trimOnBlur: true })) })),
            React.createElement("div", { className: "col-12" },
                React.createElement("hr", null)),
            React.createElement("div", { className: "col-12" },
                React.createElement("label", { className: "form__label form__label--with-desc", htmlFor: "bootstrap_dns" }, t('bootstrap_dns')),
                React.createElement("div", { className: "form__desc form__desc--top" }, t('bootstrap_dns_desc')),
                React.createElement(Controller, { name: "bootstrap_dns", control: control, render: ({ field }) => (React.createElement(Textarea, { ...field, id: "bootstrap_dns", "data-testid": "bootstrap_dns", placeholder: t('bootstrap_dns'), wrapperClassName: "mb-0", disabled: processingSetConfig, onBlur: (e) => {
                            const value = removeEmptyLines(e.target.value);
                            field.onChange(value);
                        } })) })),
            React.createElement("div", { className: "col-12" },
                React.createElement("hr", null)),
            React.createElement("div", { className: "col-12" },
                React.createElement("label", { className: "form__label form__label--with-desc", htmlFor: "local_ptr" }, t('local_ptr_title')),
                React.createElement("div", { className: "form__desc form__desc--top" }, t('local_ptr_desc')),
                React.createElement("div", { className: "form__desc form__desc--top" }, defaultLocalPtrUpstreams?.length > 0
                    ? t('local_ptr_default_resolver', {
                        ip: defaultLocalPtrUpstreams.map((s) => `"${s}"`).join(', '),
                    })
                    : t('local_ptr_no_default_resolver')),
                React.createElement(Controller, { name: "local_ptr_upstreams", control: control, render: ({ field }) => (React.createElement(Textarea, { ...field, id: "local_ptr_upstreams", "data-testid": "local_ptr_upstreams", placeholder: t('local_ptr_placeholder'), disabled: processingSetConfig, trimOnBlur: true })) }),
                React.createElement("div", { className: "mt-4" },
                    React.createElement(Controller, { name: "use_private_ptr_resolvers", control: control, render: ({ field }) => (React.createElement(Checkbox, { ...field, "data-testid": "dns_use_private_ptr_resolvers", title: t('use_private_ptr_resolvers_title'), subtitle: t('use_private_ptr_resolvers_desc'), disabled: processingSetConfig })) }))),
            React.createElement("div", { className: "col-12" },
                React.createElement("hr", null)),
            React.createElement("div", { className: "col-12 mb-4" },
                React.createElement(Controller, { name: "resolve_clients", control: control, render: ({ field }) => (React.createElement(Checkbox, { ...field, "data-testid": "dns_resolve_clients", title: t('resolve_clients_title'), subtitle: t('resolve_clients_desc'), disabled: processingSetConfig })) })),
            React.createElement("div", { className: "col-12" },
                React.createElement("hr", null)),
            React.createElement("div", { className: "col-12 col-md-7" },
                React.createElement("div", { className: "form__group" },
                    React.createElement("label", { htmlFor: "upstream_timeout", className: "form__label form__label--with-desc" },
                        React.createElement(Trans, null, "upstream_timeout")),
                    React.createElement("div", { className: "form__desc form__desc--top" },
                        React.createElement(Trans, null, "upstream_timeout_desc")),
                    React.createElement(Controller, { name: "upstream_timeout", control: control, rules: { validate: validateRequiredValue }, render: ({ field }) => (React.createElement(Input, { ...field, type: "number", id: "upstream_timeout", "data-testid": "upstream_timeout", placeholder: t('form_enter_upstream_timeout'), disabled: processingSetConfig, min: 1, max: UINT32_RANGE.MAX, onChange: (e) => {
                                const { value } = e.target;
                                field.onChange(toNumber(value));
                            } })) })))),
        React.createElement("div", { className: "card-actions" },
            React.createElement("div", { className: "btn-list" },
                React.createElement("button", { type: "button", "data-testid": "dns_upstream_test", className: clsx('btn btn-primary btn-standard mr-2', {
                        'btn-loading': processingTestUpstream,
                    }), onClick: handleUpstreamTest, disabled: !upstream_dns || processingTestUpstream }, t('test_upstream_btn')),
                React.createElement("button", { type: "submit", "data-testid": "dns_upstream_save", className: "btn btn-success btn-standard", disabled: isSubmitting || processingSetConfig || processingTestUpstream }, t('apply_btn'))))));
};
export default Form;

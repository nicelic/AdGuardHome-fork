import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Controller, useFormContext } from 'react-hook-form';
import Examples from '../../../Dns/Upstream/Examples';
import { UINT32_RANGE } from '../../../../../helpers/constants';
import { Textarea } from '../../../../ui/Controls/Textarea';
import { Checkbox } from '../../../../ui/Controls/Checkbox';
import { Input } from '../../../../ui/Controls/Input';
import { toNumber } from '../../../../../helpers/form';
export const UpstreamDns = () => {
    const { t } = useTranslation();
    const { control } = useFormContext();
    return (React.createElement("div", { title: t('upstream_dns') },
        React.createElement("div", { className: "form__desc mb-3" },
            React.createElement(Trans, { components: [React.createElement("a", { href: "#dns", key: "0" })] }, "upstream_dns_client_desc")),
        React.createElement(Controller, { name: "upstreams", control: control, render: ({ field }) => (React.createElement(Textarea, { ...field, "data-testid": "clients_upstreams", className: "form-control form-control--textarea mb-5", placeholder: t('upstream_dns'), trimOnBlur: true })) }),
        React.createElement(Examples, null),
        React.createElement("div", { className: "form__label--bold mt-5 mb-3" }, t('upstream_dns_cache_configuration')),
        React.createElement("div", { className: "form__group mb-2" },
            React.createElement(Controller, { name: "upstreams_cache_enabled", control: control, render: ({ field }) => (React.createElement(Checkbox, { ...field, "data-testid": "clients_upstreams_cache_enabled", title: t('enable_upstream_dns_cache') })) })),
        React.createElement("div", { className: "form__group form__group--settings" },
            React.createElement("label", { htmlFor: "upstreams_cache_size", className: "form__label" }, t('dns_cache_size')),
            React.createElement(Controller, { name: "upstreams_cache_size", control: control, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "number", "data-testid": "clients_upstreams_cache_size", placeholder: t('enter_cache_size'), error: fieldState.error?.message, min: 0, max: UINT32_RANGE.MAX, onChange: (e) => {
                        const { value } = e.target;
                        field.onChange(toNumber(value));
                    } })) }))));
};

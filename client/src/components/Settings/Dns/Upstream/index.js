import React from 'react';
import { useTranslation } from 'react-i18next';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import Form from './Form';
import Card from '../../../ui/Card';
import { setDnsConfig } from '../../../../actions/dnsConfig';
const Upstream = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { upstream_dns, fallback_dns, bootstrap_dns, upstream_mode, resolve_clients, local_ptr_upstreams, use_private_ptr_resolvers, upstream_timeout, } = useSelector((state) => state.dnsConfig, shallowEqual);
    const upstream_dns_file = useSelector((state) => state.dnsConfig.upstream_dns_file);
    const handleSubmit = (values) => {
        const { fallback_dns, bootstrap_dns, upstream_dns, upstream_mode, resolve_clients, local_ptr_upstreams, use_private_ptr_resolvers, upstream_timeout, } = values;
        const dnsConfig = {
            fallback_dns,
            bootstrap_dns,
            upstream_mode,
            resolve_clients,
            local_ptr_upstreams,
            use_private_ptr_resolvers,
            upstream_timeout,
            ...(upstream_dns_file ? null : { upstream_dns }),
        };
        dispatch(setDnsConfig(dnsConfig));
    };
    const upstreamDns = upstream_dns_file
        ? t('upstream_dns_configured_in_file', { path: upstream_dns_file })
        : upstream_dns;
    return (React.createElement(Card, { title: t('upstream_dns'), bodyType: "card-body box-body--settings" },
        React.createElement("div", { className: "row" },
            React.createElement("div", { className: "col" },
                React.createElement(Form, { initialValues: {
                        upstream_dns: upstreamDns,
                        fallback_dns,
                        bootstrap_dns,
                        upstream_mode,
                        resolve_clients,
                        local_ptr_upstreams,
                        use_private_ptr_resolvers,
                        upstream_timeout,
                    }, onSubmit: handleSubmit })))));
};
export default Upstream;

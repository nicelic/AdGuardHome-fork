import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Trans, useTranslation } from 'react-i18next';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import Select from 'react-select';
import Tabs from '../../../ui/Tabs';
import { CLIENT_ID_LINK, LOCAL_TIMEZONE_VALUE } from '../../../../helpers/constants';
import { Input } from '../../../ui/Controls/Input';
import { validateRequiredValue } from '../../../../helpers/validators';
import { BlockedServices, ClientIds, MainSettings, ScheduleServices, UpstreamDns } from './components';
import '../Service.css';
const defaultFormValues = {
    ids: [{ name: '' }],
    name: '',
    tags: [],
    use_global_settings: false,
    filtering_enabled: false,
    safebrowsing_enabled: false,
    parental_enabled: false,
    ignore_querylog: false,
    ignore_statistics: false,
    blocked_services: {},
    safe_search: { enabled: false },
    upstreams: '',
    upstreams_cache_enabled: false,
    upstreams_cache_size: 0,
    use_global_blocked_services: false,
    blocked_services_schedule: {
        time_zone: LOCAL_TIMEZONE_VALUE,
    },
};
export const Form = ({ onSubmit, onClose, processingAdding, processingUpdating, tagsOptions, initialValues, }) => {
    const { t } = useTranslation();
    const methods = useForm({
        defaultValues: {
            ...defaultFormValues,
            ...initialValues,
        },
        mode: 'onBlur',
    });
    const { handleSubmit, reset, control, formState: { isSubmitting, isValid }, } = methods;
    const services = useSelector((store) => store?.services);
    const { safe_search } = initialValues;
    const safeSearchServices = { ...safe_search };
    delete safeSearchServices.enabled;
    const [activeTabLabel, setActiveTabLabel] = useState('settings');
    const tabs = {
        settings: {
            title: 'settings',
            component: React.createElement(MainSettings, { safeSearchServices: safeSearchServices }),
        },
        block_services: {
            title: 'block_services',
            component: React.createElement(BlockedServices, { services: services?.allServices }),
        },
        schedule_services: {
            title: 'schedule_services',
            component: React.createElement(ScheduleServices, null),
        },
        upstream_dns: {
            title: 'upstream_dns',
            component: React.createElement(UpstreamDns, null),
        },
    };
    const activeTab = tabs[activeTabLabel].component;
    return (React.createElement(FormProvider, { ...methods },
        React.createElement("form", { onSubmit: handleSubmit(onSubmit) },
            React.createElement("div", { className: "modal-body" },
                React.createElement("div", { className: "form__group mb-0" },
                    React.createElement("div", { className: "form__group" },
                        React.createElement(Controller, { name: "name", control: control, rules: { validate: validateRequiredValue }, render: ({ field, fieldState }) => (React.createElement(Input, { ...field, type: "text", "data-testid": "clients_name", placeholder: t('form_client_name'), error: fieldState.error?.message, onBlur: (event) => {
                                    const trimmedValue = event.target.value.trim();
                                    field.onBlur();
                                    field.onChange(trimmedValue);
                                } })) })),
                    React.createElement("div", { className: "form__group mb-4" },
                        React.createElement("div", { className: "form__label" },
                            React.createElement("strong", { className: "mr-3" },
                                React.createElement(Trans, null, "tags_title"))),
                        React.createElement("div", { className: "form__desc mt-0 mb-2" },
                            React.createElement(Trans, { components: [
                                    React.createElement("a", { target: "_blank", rel: "noopener noreferrer", href: "https://link.adtidy.org/forward.html?action=dns_kb_filtering_syntax_ctag&from=ui&app=home", key: "0" }),
                                ] }, "tags_desc")),
                        React.createElement(Controller, { name: "tags", control: control, render: ({ field }) => (React.createElement(Select, { ...field, "data-testid": "clients_tags", options: tagsOptions, className: "basic-multi-select", classNamePrefix: "select", isMulti: true })) })),
                    React.createElement("div", { className: "form__group" },
                        React.createElement("div", { className: "form__label" },
                            React.createElement("strong", { className: "mr-3" },
                                React.createElement(Trans, null, "client_identifier"))),
                        React.createElement("div", { className: "form__desc mt-0" },
                            React.createElement(Trans, { components: [
                                    React.createElement("a", { href: CLIENT_ID_LINK, target: "_blank", rel: "noopener noreferrer", key: "0" }),
                                ] }, "client_identifier_desc"))),
                    React.createElement("div", { className: "form__group" },
                        React.createElement(ClientIds, null))),
                React.createElement(Tabs, { controlClass: "form", tabs: tabs, activeTabLabel: activeTabLabel, setActiveTabLabel: setActiveTabLabel }, activeTab)),
            React.createElement("div", { className: "modal-footer" },
                React.createElement("div", { className: "btn-list" },
                    React.createElement("button", { type: "button", className: "btn btn-secondary btn-standard", disabled: isSubmitting, onClick: () => {
                            reset();
                            onClose();
                        } },
                        React.createElement(Trans, null, "cancel_btn")),
                    React.createElement("button", { type: "submit", className: "btn btn-success btn-standard", disabled: isSubmitting || !isValid || processingAdding || processingUpdating },
                        React.createElement(Trans, null, "save_btn")))))));
};

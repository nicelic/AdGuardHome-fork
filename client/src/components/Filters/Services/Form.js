import React, { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { ServiceField } from './ServiceField';
export const Form = ({ initialValues, blockedServices, serviceGroups, processing, processingSet, onSubmit, }) => {
    const { t } = useTranslation();
    const { handleSubmit, control, setValue, formState: { isSubmitting }, } = useForm({
        mode: 'onBlur',
        defaultValues: { blocked_services: initialValues }
    });
    const isServicesControlsDisabled = processing || processingSet;
    const isSubmitDisabled = processing || processingSet || isSubmitting;
    const servicesByGroup = useMemo(() => {
        return blockedServices.reduce((acc, service) => {
            if (!acc[service.group_id]) {
                acc[service.group_id] = [];
            }
            acc[service.group_id].push(service);
            return acc;
        }, {});
    }, [blockedServices]);
    const handleToggleAllServices = (isSelected) => {
        blockedServices.forEach((service) => {
            if (!isServicesControlsDisabled) {
                setValue(`blocked_services.${service.id}`, isSelected);
            }
        });
    };
    const handleToggleGroupServices = (groupId, isSelected) => {
        if (isServicesControlsDisabled) {
            return;
        }
        servicesByGroup[groupId].forEach((service) => {
            setValue(`blocked_services.${service.id}`, isSelected);
        });
    };
    const handleSubmitWithGroups = (values) => {
        if (!values || !values.blocked_services) {
            return onSubmit(values);
        }
        const enabledIdsMap = Object.fromEntries(blockedServices
            .filter(service => values.blocked_services?.[service.id])
            .map(service => [service.id, true]));
        return onSubmit({ blocked_services: enabledIdsMap });
    };
    return (React.createElement("form", { onSubmit: handleSubmit(handleSubmitWithGroups) },
        React.createElement("div", { className: "form__group" },
            React.createElement("div", { className: "blocked_services row mb-5" },
                React.createElement("div", { className: "col-12 col-md-6 mb-4 mb-md-0" },
                    React.createElement("button", { type: "button", "data-testid": "blocked_services_block_all", className: "btn btn-secondary btn-block font-weight-normal", disabled: isServicesControlsDisabled, onClick: () => handleToggleAllServices(true) },
                        React.createElement(Trans, null, "block_all"))),
                React.createElement("div", { className: "col-12 col-md-6" },
                    React.createElement("button", { type: "button", "data-testid": "blocked_services_unblock_all", className: "btn btn-secondary btn-block font-weight-normal", disabled: isServicesControlsDisabled, onClick: () => handleToggleAllServices(false) },
                        React.createElement(Trans, null, "unblock_all")))),
            serviceGroups.map((group) => {
                const groupServices = servicesByGroup[group.id];
                return (React.createElement("div", { key: group.id, className: "services-group mb-2" },
                    React.createElement("h3", { className: "h5 mb-3" }, t(`servicesgroup.${group.id}.name`, { ns: 'services' })),
                    groupServices.length > 1 && (React.createElement("div", { className: "actions mb-3 d-flex gap-4" },
                        React.createElement("button", { type: "button", className: "btn btn-link p-0 text-danger font-weight-normal mr-5", disabled: isServicesControlsDisabled, onClick: () => handleToggleGroupServices(group.id, true) },
                            React.createElement(Trans, null, "block_all")),
                        React.createElement("button", { type: "button", className: "btn btn-link p-0 text-success font-weight-normal", disabled: isServicesControlsDisabled, onClick: () => handleToggleGroupServices(group.id, false) },
                            React.createElement(Trans, null, "unblock_all")))),
                    React.createElement("div", { className: "services__wrapper" },
                        React.createElement("div", { className: "services" }, groupServices.map((service) => (React.createElement(Controller, { key: service.id, name: `blocked_services.${service.id}`, control: control, render: ({ field }) => (React.createElement(ServiceField, { ...field, "data-testid": `blocked_services_${service.id}`, "data-groupid": `blocked_services_${service.group_id}`, placeholder: service.name, disabled: isServicesControlsDisabled, icon: service.icon_svg })) })))))));
            })),
        React.createElement("div", { className: "btn-list" },
            React.createElement("button", { type: "submit", "data-testid": "blocked_services_save", className: "btn btn-success btn-standard btn-large", disabled: isSubmitDisabled },
                React.createElement(Trans, null, "save_btn")))));
};

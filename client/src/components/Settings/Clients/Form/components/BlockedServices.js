import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Controller, useFormContext } from 'react-hook-form';
import { ServiceField } from '../../../../Filters/Services/ServiceField';
export const BlockedServices = ({ services }) => {
    const { t } = useTranslation();
    const { watch, setValue, control } = useFormContext();
    const useGlobalServices = watch('use_global_blocked_services');
    const handleToggleAllServices = (isSelected) => {
        services.forEach((service) => setValue(`blocked_services.${service.id}`, isSelected));
    };
    return (React.createElement("div", { title: t('block_services') },
        React.createElement("div", { className: "form__group" },
            React.createElement(Controller, { name: "use_global_blocked_services", control: control, render: ({ field }) => (React.createElement(ServiceField, { ...field, "data-testid": "clients_use_global_blocked_services", placeholder: t('blocked_services_global'), className: "service--global" })) }),
            React.createElement("div", { className: "row mb-4" },
                React.createElement("div", { className: "col-6" },
                    React.createElement("button", { type: "button", "data-testid": "clients_block_all", className: "btn btn-secondary btn-block", disabled: useGlobalServices, onClick: () => handleToggleAllServices(true) },
                        React.createElement(Trans, null, "block_all"))),
                React.createElement("div", { className: "col-6" },
                    React.createElement("button", { type: "button", "data-testid": "clients_unblock_all", className: "btn btn-secondary btn-block", disabled: useGlobalServices, onClick: () => handleToggleAllServices(false) },
                        React.createElement(Trans, null, "unblock_all")))),
            services.length > 0 && (React.createElement("div", { className: "services" }, services.map((service) => (React.createElement(Controller, { key: service.id, name: `blocked_services.${service.id}`, control: control, render: ({ field }) => (React.createElement(ServiceField, { ...field, "data-testid": `clients_service_${service.id}`, placeholder: service.name, disabled: useGlobalServices, icon: service.icon_svg })) }))))))));
};

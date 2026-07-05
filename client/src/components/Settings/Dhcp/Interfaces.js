import React from 'react';
import { useSelector } from 'react-redux';
import { useFormContext } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';
import { validateRequiredValue } from '../../../helpers/validators';
const renderInterfaces = (interfaces) => Object.keys(interfaces).map((item) => {
    const option = interfaces[item];
    const { name } = option;
    const [interfaceIPv4] = option?.ipv4_addresses ?? [];
    const [interfaceIPv6] = option?.ipv6_addresses ?? [];
    const optionContent = [name, interfaceIPv4, interfaceIPv6].filter(Boolean).join(' - ');
    return (React.createElement("option", { value: name, key: name }, optionContent));
});
const getInterfaceValues = ({ gateway_ip, hardware_address, ip_addresses }) => [
    {
        name: 'dhcp_form_gateway_input',
        value: gateway_ip,
    },
    {
        name: 'dhcp_hardware_address',
        value: hardware_address,
    },
    {
        name: 'dhcp_ip_addresses',
        value: ip_addresses,
        render: (ip_addresses) => ip_addresses.map((ip) => (React.createElement("span", { key: ip, className: "interface__ip" }, ip))),
    },
];
const renderInterfaceValues = ({ gateway_ip, hardware_address, ip_addresses }) => (React.createElement("div", { className: "d-flex align-items-end dhcp__interfaces-info" },
    React.createElement("ul", { className: "list-unstyled m-0" }, getInterfaceValues({
        gateway_ip,
        hardware_address,
        ip_addresses,
    }).map(({ name, value, render }) => value && (React.createElement("li", { key: name },
        React.createElement("span", { className: "interface__title" },
            React.createElement(Trans, null, name),
            ":",
            ' '),
        render?.(value) || value))))));
const Interfaces = () => {
    const { t } = useTranslation();
    const { register, watch, formState: { errors }, } = useFormContext();
    const { processingInterfaces, interfaces, enabled } = useSelector((store) => store.dhcp);
    const interface_name = watch('interface_name');
    if (processingInterfaces || !interfaces) {
        return null;
    }
    const interfaceValue = interface_name && interfaces[interface_name];
    return (React.createElement("div", { className: "row dhcp__interfaces" },
        React.createElement("div", { className: "col col__dhcp" },
            React.createElement("label", { htmlFor: "interface_name", className: "form__label" }, t('dhcp_interface_select')),
            React.createElement("select", { id: "interface_name", "data-testid": "interface_name", className: "form-control custom-select pl-4 col-md", disabled: enabled, ...register('interface_name', {
                    validate: validateRequiredValue,
                }) },
                React.createElement("option", { value: "", disabled: enabled }, t('dhcp_interface_select')),
                renderInterfaces(interfaces)),
            errors.interface_name && (React.createElement("div", { className: "form__message form__message--error" }, t(errors.interface_name.message)))),
        interfaceValue &&
            renderInterfaceValues({
                gateway_ip: interfaceValue.gateway_ip,
                hardware_address: interfaceValue.hardware_address,
                ip_addresses: interfaceValue.ip_addresses,
            })));
};
export default Interfaces;

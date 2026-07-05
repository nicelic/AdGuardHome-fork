import React from 'react';
import { Trans } from 'react-i18next';
import { Guide } from '../../components/ui/Guide';
import Controls from './Controls';
import AddressList from './AddressList';
export const Devices = ({ interfaces, dnsConfig }) => (React.createElement("div", { className: "setup__step" },
    React.createElement("div", { className: "setup__group" },
        React.createElement("div", { className: "setup__subtitle" },
            React.createElement(Trans, null, "install_devices_title")),
        React.createElement("div", { className: "setup__desc" },
            React.createElement(Trans, null, "install_devices_desc"),
            React.createElement("div", { className: "mt-1" },
                React.createElement(Trans, null, "install_devices_address"),
                ":"),
            React.createElement("div", { className: "mt-1" },
                React.createElement(AddressList, { interfaces: interfaces, address: dnsConfig.ip, port: dnsConfig.port, isDns: true }))),
        React.createElement(Guide, null)),
    React.createElement(Controls, null)));

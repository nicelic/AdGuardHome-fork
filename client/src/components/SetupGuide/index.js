import React from 'react';
import { Trans, withTranslation } from 'react-i18next';
import { Guide } from '../ui/Guide';
import Card from '../ui/Card';
import PageTitle from '../ui/PageTitle';
import './Guide.css';
const SetupGuide = ({ t, dashboard: { dnsAddresses } }) => (React.createElement("div", { className: "guide" },
    React.createElement(PageTitle, { title: t('setup_guide') }),
    React.createElement(Card, null,
        React.createElement("div", { className: "guide__title" },
            React.createElement(Trans, null, "install_devices_title")),
        React.createElement("div", { className: "guide__desc" },
            React.createElement(Trans, null, "install_devices_desc"),
            React.createElement("div", { className: "mt-1" },
                React.createElement(Trans, null, "install_devices_address"),
                ":"),
            React.createElement("ul", { className: "guide__list" }, dnsAddresses.map((ip) => (React.createElement("li", { key: ip, className: "guide__address" }, ip))))),
        React.createElement(Guide, { dnsAddresses: dnsAddresses }))));
export default withTranslation()(SetupGuide);

import React from 'react';
import { Link } from 'react-router-dom';
import { normalizeWhois } from './helpers';
import { WHOIS_ICONS } from './constants';
const getFormattedWhois = (whois) => {
    const whoisInfo = normalizeWhois(whois);
    return Object.keys(whoisInfo).map((key) => {
        const icon = WHOIS_ICONS[key];
        return (React.createElement("span", { className: "logs__whois text-muted", key: key, title: whoisInfo[key] },
            icon && (React.createElement(React.Fragment, null,
                React.createElement("svg", { className: "logs__whois-icon icons icon--18" },
                    React.createElement("use", { xlinkHref: `#${icon}` })),
                "\u00A0")),
            whoisInfo[key]));
    });
};
/**
 * @param {string} value
 * @param {object} info
 * @param {string} info.name
 * @param {object} info.whois_info
 * @param {boolean} [isDetailed]
 * @param {boolean} [isLogs]
 * @returns {JSXElement}
 */
export const renderFormattedClientCell = (value, info, isDetailed = false, isLogs = false) => {
    let whoisContainer = null;
    let nameContainer = value;
    if (info) {
        const { name, whois_info } = info;
        const whoisAvailable = whois_info && Object.keys(whois_info).length > 0;
        if (name) {
            const nameValue = (React.createElement("div", { className: "logs__text logs__text--link logs__text--nowrap logs__text--client", title: `${name} (${value})` },
                name,
                "\u00A0",
                React.createElement("small", null, `(${value})`)));
            if (!isLogs) {
                nameContainer = nameValue;
            }
            else {
                nameContainer = !whoisAvailable && isDetailed ? React.createElement("small", { title: value }, value) : nameValue;
            }
        }
        if (whoisAvailable && isDetailed) {
            whoisContainer = (React.createElement("div", { className: "logs__text logs__text--wrap logs__text--whois" }, getFormattedWhois(whois_info)));
        }
    }
    return (React.createElement("div", { className: "logs__text logs__text--client mw-100", title: value },
        React.createElement(Link, { to: `logs?search="${encodeURIComponent(value)}"` }, nameContainer),
        whoisContainer));
};

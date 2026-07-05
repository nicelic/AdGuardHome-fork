import React, { Fragment } from 'react';
import { normalizeWhois } from '../../../helpers/helpers';
import { WHOIS_ICONS } from '../../../helpers/constants';
const getFormattedWhois = (value, t) => {
    const whoisInfo = normalizeWhois(value);
    const whoisKeys = Object.keys(whoisInfo);
    if (whoisKeys.length > 0) {
        return whoisKeys.map((key) => {
            const icon = WHOIS_ICONS[key];
            return (React.createElement("div", { key: key, title: t(key) },
                icon && (React.createElement(Fragment, null,
                    React.createElement("svg", { className: "logs__whois-icon text-muted-dark icons icon--24" },
                        React.createElement("use", { xlinkHref: `#${icon}` })),
                    "\u00A0")),
                whoisInfo[key]));
        });
    }
    return '–';
};
const whoisCell = (t) => function cell(row) {
    const { value } = row;
    return (React.createElement("div", { className: "logs__row o-hidden" },
        React.createElement("div", { className: "logs__text logs__text--wrap" }, getFormattedWhois(value, t))));
};
export default whoisCell;

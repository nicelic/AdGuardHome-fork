import React from 'react';
import { Trans } from 'react-i18next';
import { getSourceData, getTrackerData } from '../../helpers/trackers/trackers';
import Tooltip from '../ui/Tooltip';
import { captitalizeWords } from '../../helpers/helpers';
const renderLabel = (value) => (React.createElement("strong", null,
    React.createElement(Trans, null, value)));
const renderLink = ({ url, name }) => (React.createElement("a", { className: "tooltip-custom__content-link", target: "_blank", rel: "noopener noreferrer", href: url },
    React.createElement("strong", null, name)));
const getTrackerInfo = (trackerData) => [
    {
        key: 'name_table_header',
        value: trackerData,
        render: renderLink,
    },
    {
        key: 'category_label',
        value: captitalizeWords(trackerData.category),
        render: renderLabel,
    },
    {
        key: 'source_label',
        value: getSourceData(trackerData),
        render: renderLink,
    },
];
const DomainCell = ({ value }) => {
    const trackerData = getTrackerData(value);
    const content = trackerData && (React.createElement("div", { className: "popover__list" },
        React.createElement("div", { className: "tooltip-custom__content-title mb-1" },
            React.createElement(Trans, null, "found_in_known_domain_db")),
        getTrackerInfo(trackerData).map(({ key, value, render }) => (React.createElement("div", { key: key, className: "tooltip-custom__content-item" },
            React.createElement(Trans, null, key),
            ": ",
            render(value))))));
    return (React.createElement("div", { className: "logs__row" },
        React.createElement("div", { className: "logs__text", title: value }, value),
        trackerData && (React.createElement(Tooltip, { content: content, placement: "top", className: "tooltip-container tooltip-custom--wide" },
            React.createElement("svg", { className: "icons icon--24 icon--green ml-1" },
                React.createElement("use", { xlinkHref: "#privacy" }))))));
};
export default DomainCell;

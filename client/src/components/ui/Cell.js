import React from 'react';
import LogsSearchLink from './LogsSearchLink';
import { formatNumber } from '../../helpers/helpers';
const Cell = ({ value, percent, color, search }) => (React.createElement("div", { className: "stats__row" },
    React.createElement("div", { className: "stats__row-value mb-1" },
        React.createElement("strong", null, search ? React.createElement(LogsSearchLink, { search: search }, formatNumber(value)) : formatNumber(value)),
        React.createElement("small", { className: "ml-3 text-muted" },
            percent,
            "%")),
    React.createElement("div", { className: "progress progress-xs" },
        React.createElement("div", { className: "progress-bar", style: {
                width: `${percent}%`,
                backgroundColor: color,
            } }))));
export default Cell;

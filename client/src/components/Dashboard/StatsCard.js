import React from 'react';
import cn from 'clsx';
import { formatNumber } from '../../helpers/helpers';
import Card from '../ui/Card';
import Line from '../ui/Line';
import './StatsCard.css';
export const STATS_CARD_VARIANTS = {
    QUERIES: 'queries',
    ADS: 'ads',
    THREATS: 'threats',
    ADULT: 'adult',
};
const CHART_COLORS = {
    queries: '#7F7F7F',
    ads: '#F67247',
    threats: '#D58500',
    adult: '#A870B2',
};
export const StatsCard = ({ total, lineData, percent, title, variant }) => {
    const showPercent = typeof percent === 'number';
    const accentColor = CHART_COLORS[variant];
    return (React.createElement("div", { className: cn('stats-card', `stats-card--${variant}`) },
        React.createElement(Card, { type: "card--stats", bodyType: "card-wrap" },
            React.createElement("div", { className: "stats-card__inner" },
                React.createElement("div", { className: "stats-card__header" },
                    React.createElement("div", { className: "stats-card__value" }, formatNumber(total)),
                    showPercent && React.createElement("div", { className: "stats-card__percent" },
                        Math.round(percent),
                        "%")),
                React.createElement("div", { className: "stats-card__chart" },
                    React.createElement(Line, { data: lineData, color: accentColor })))),
        React.createElement("div", { className: "stats-card__title" }, title)));
};

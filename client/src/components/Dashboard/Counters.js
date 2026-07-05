import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import round from 'lodash/round';
import { shallowEqual, useSelector } from 'react-redux';
import Card from '../ui/Card';
import { formatNumber, msToDays, msToHours } from '../../helpers/helpers';
import LogsSearchLink from '../ui/LogsSearchLink';
import { RESPONSE_FILTER, TIME_UNITS } from '../../helpers/constants';
import Tooltip from '../ui/Tooltip';
const Row = ({ label, count, response_status, tooltipTitle, translationComponents }) => {
    const content = response_status ? (React.createElement(LogsSearchLink, { response_status: response_status }, count)) : (count);
    return (React.createElement("div", { className: "counters__row", key: label },
        React.createElement("div", { className: "counters__column" },
            React.createElement("span", { className: "counters__title" },
                React.createElement(Trans, { components: translationComponents }, label)),
            React.createElement("span", { className: "counters__tooltip" },
                React.createElement(Tooltip, { content: tooltipTitle, placement: "top", className: "tooltip-container tooltip-custom--narrow text-center" },
                    React.createElement("svg", { className: "icons icon--20 icon--lightgray ml-2" },
                        React.createElement("use", { xlinkHref: "#question" }))))),
        React.createElement("div", { className: "counters__column counters__column--value" },
            React.createElement("strong", null, content))));
};
const Counters = ({ refreshButton, subtitle }) => {
    const { interval, numDnsQueries, numBlockedFiltering, numReplacedSafebrowsing, numReplacedParental, numReplacedSafesearch, avgProcessingTime, timeUnits, } = useSelector((state) => state.stats, shallowEqual);
    const { t } = useTranslation();
    const dnsQueryTooltip = timeUnits === TIME_UNITS.HOURS
        ? t('number_of_dns_query_hours', { count: msToHours(interval) })
        : t('number_of_dns_query_days', { count: msToDays(interval) });
    const rows = [
        {
            label: 'dns_query',
            count: formatNumber(numDnsQueries),
            tooltipTitle: dnsQueryTooltip,
            response_status: RESPONSE_FILTER.ALL.QUERY,
        },
        {
            label: 'blocked_by',
            count: formatNumber(numBlockedFiltering),
            tooltipTitle: 'number_of_dns_query_blocked_24_hours',
            response_status: RESPONSE_FILTER.BLOCKED.QUERY,
            translationComponents: [
                React.createElement("a", { href: "#filters", key: "0" }, "link"),
            ],
        },
        {
            label: 'stats_malware_phishing',
            count: formatNumber(numReplacedSafebrowsing),
            tooltipTitle: 'number_of_dns_query_blocked_24_hours_by_sec',
            response_status: RESPONSE_FILTER.BLOCKED_THREATS.QUERY,
        },
        {
            label: 'stats_adult',
            count: formatNumber(numReplacedParental),
            tooltipTitle: 'number_of_dns_query_blocked_24_hours_adult',
            response_status: RESPONSE_FILTER.BLOCKED_ADULT_WEBSITES.QUERY,
        },
        {
            label: 'enforced_save_search',
            count: formatNumber(numReplacedSafesearch),
            tooltipTitle: 'number_of_dns_query_to_safe_search',
            response_status: RESPONSE_FILTER.SAFE_SEARCH.QUERY,
        },
        {
            label: 'average_processing_time',
            count: avgProcessingTime ? `${round(avgProcessingTime)} ms` : '0',
            tooltipTitle: 'average_processing_time_hint',
        },
    ];
    return (React.createElement(Card, { title: t('general_statistics'), subtitle: subtitle, bodyType: "card-table", refresh: refreshButton },
        React.createElement("div", { className: "counters" }, rows.map((row, index) => {
            return React.createElement(Row, { ...row, key: index });
        }))));
};
export default Counters;

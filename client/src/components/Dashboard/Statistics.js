import React from 'react';
import { Link } from 'react-router-dom';
import { withTranslation, Trans } from 'react-i18next';
import { StatsCard, STATS_CARD_VARIANTS } from './StatsCard';
import { getPercent } from '../../helpers/helpers';
import { RESPONSE_FILTER } from '../../helpers/constants';
const Statistics = ({ dnsQueries, blockedFiltering, replacedSafebrowsing, replacedParental, numDnsQueries, numBlockedFiltering, numReplacedSafebrowsing, numReplacedParental, }) => (React.createElement("div", { className: "row" },
    React.createElement("div", { className: "col-sm-6 col-lg-3" },
        React.createElement(StatsCard, { total: numDnsQueries, lineData: dnsQueries, title: React.createElement(Link, { to: "logs" },
                React.createElement(Trans, null, "dns_query")), variant: STATS_CARD_VARIANTS.QUERIES })),
    React.createElement("div", { className: "col-sm-6 col-lg-3" },
        React.createElement(StatsCard, { total: numBlockedFiltering, lineData: blockedFiltering, percent: getPercent(numDnsQueries, numBlockedFiltering), title: React.createElement(Trans, { components: [
                    React.createElement(Link, { to: `logs?response_status=${RESPONSE_FILTER.BLOCKED.QUERY}`, key: "0" }, "link"),
                ] }, "blocked_by"), variant: STATS_CARD_VARIANTS.ADS })),
    React.createElement("div", { className: "col-sm-6 col-lg-3" },
        React.createElement(StatsCard, { total: numReplacedSafebrowsing, lineData: replacedSafebrowsing, percent: getPercent(numDnsQueries, numReplacedSafebrowsing), title: React.createElement(Link, { to: `logs?response_status=${RESPONSE_FILTER.BLOCKED_THREATS.QUERY}` },
                React.createElement(Trans, null, "stats_malware_phishing")), variant: STATS_CARD_VARIANTS.THREATS })),
    React.createElement("div", { className: "col-sm-6 col-lg-3" },
        React.createElement(StatsCard, { total: numReplacedParental, lineData: replacedParental, percent: getPercent(numDnsQueries, numReplacedParental), title: React.createElement(Link, { to: `logs?response_status=${RESPONSE_FILTER.BLOCKED_ADULT_WEBSITES.QUERY}` },
                React.createElement(Trans, null, "stats_adult")), variant: STATS_CARD_VARIANTS.ADULT }))));
export default withTranslation()(Statistics);

import React, { useEffect } from 'react';
import { HashLink as Link } from 'react-router-hash-link';
import { Trans, useTranslation } from 'react-i18next';
import classNames from 'classnames';
import Statistics from './Statistics';
import Counters from './Counters';
import Clients from './Clients';
import QueriedDomains from './QueriedDomains';
import BlockedDomains from './BlockedDomains';
import { DISABLE_PROTECTION_TIMINGS, ONE_SECOND_IN_MS, SETTINGS_URLS, TIME_UNITS } from '../../helpers/constants';
import { msToSeconds, msToMinutes, msToHours, msToDays } from '../../helpers/helpers';
import PageTitle from '../ui/PageTitle';
import Loading from '../ui/Loading';
import './Dashboard.css';
import Dropdown from '../ui/Dropdown';
import UpstreamResponses from './UpstreamResponses';
import UpstreamAvgTime from './UpstreamAvgTime';
const Dashboard = ({ getAccessList, getStats, getStatsConfig, dashboard: { protectionEnabled, processingProtection, protectionDisabledDuration }, toggleProtection, stats, access, }) => {
    const { t } = useTranslation();
    const getAllStats = () => {
        getAccessList();
        getStats();
        getStatsConfig();
    };
    useEffect(() => {
        getAllStats();
    }, []);
    const getSubtitle = () => {
        if (!stats.enabled) {
            return t('stats_disabled_short');
        }
        const msIn7Days = 604800000;
        if (stats.timeUnits === TIME_UNITS.HOURS && stats.interval === msIn7Days) {
            return t('for_last_days', { count: msToDays(stats.interval) });
        }
        return stats.timeUnits === TIME_UNITS.HOURS
            ? t('for_last_hours', { count: msToHours(stats.interval) })
            : t('for_last_days', { count: msToDays(stats.interval) });
    };
    const buttonClass = classNames('btn btn-sm dashboard-protection-button', {
        'btn-gray': protectionEnabled,
        'btn-success': !protectionEnabled,
    });
    const refreshButton = (React.createElement("button", { type: "button", className: "btn btn-icon btn-outline-primary btn-sm", title: t('refresh_btn'), onClick: () => getAllStats() },
        React.createElement("svg", { className: "icons icon12" },
            React.createElement("use", { xlinkHref: "#refresh" }))));
    const statsProcessing = stats.processingStats || stats.processingGetConfig || access.processing;
    const subtitle = getSubtitle();
    const DISABLE_PROTECTION_ITEMS = [
        {
            text: t('disable_for_seconds', { count: msToSeconds(DISABLE_PROTECTION_TIMINGS.HALF_MINUTE) }),
            disableTime: DISABLE_PROTECTION_TIMINGS.HALF_MINUTE,
        },
        {
            text: t('disable_for_minutes', { count: msToMinutes(DISABLE_PROTECTION_TIMINGS.MINUTE) }),
            disableTime: DISABLE_PROTECTION_TIMINGS.MINUTE,
        },
        {
            text: t('disable_for_minutes', { count: msToMinutes(DISABLE_PROTECTION_TIMINGS.TEN_MINUTES) }),
            disableTime: DISABLE_PROTECTION_TIMINGS.TEN_MINUTES,
        },
        {
            text: t('disable_for_hours', { count: msToHours(DISABLE_PROTECTION_TIMINGS.HOUR) }),
            disableTime: DISABLE_PROTECTION_TIMINGS.HOUR,
        },
        {
            text: t('disable_until_tomorrow'),
            disableTime: DISABLE_PROTECTION_TIMINGS.TOMORROW,
        },
    ];
    const getDisableProtectionItems = () => Object.values(DISABLE_PROTECTION_ITEMS).map((item, index) => (React.createElement("div", { key: `disable_timings_${index}`, className: "dropdown-item", onClick: () => {
            toggleProtection(protectionEnabled, item.disableTime - ONE_SECOND_IN_MS);
        } }, item.text)));
    const getRemaningTimeText = (milliseconds) => {
        if (!milliseconds) {
            return '';
        }
        const date = new Date(milliseconds);
        const hh = date.getUTCHours();
        const mm = `0${date.getUTCMinutes()}`.slice(-2);
        const ss = `0${date.getUTCSeconds()}`.slice(-2);
        const formattedHH = `0${hh}`.slice(-2);
        return hh ? `${formattedHH}:${mm}:${ss}` : `${mm}:${ss}`;
    };
    const getProtectionBtnText = (status) => (status ? t('disable_protection') : t('enable_protection'));
    return (React.createElement(React.Fragment, null,
        React.createElement(PageTitle, { title: t('dashboard'), containerClass: "page-title--dashboard" },
            React.createElement("div", { className: "page-title__protection" },
                React.createElement("button", { type: "button", className: buttonClass, onClick: () => {
                        toggleProtection(protectionEnabled);
                    }, disabled: processingProtection }, protectionDisabledDuration
                    ? `${t('enable_protection_timer', { time: getRemaningTimeText(protectionDisabledDuration) })}`
                    : getProtectionBtnText(protectionEnabled)),
                protectionEnabled && (React.createElement(Dropdown, { label: "", baseClassName: "dropdown-protection", icon: "arrow-down", controlClassName: "dropdown-protection__toggle", menuClassName: "dropdown-menu dropdown-menu-arrow dropdown-menu--protection" }, getDisableProtectionItems()))),
            React.createElement("button", { type: "button", className: "btn btn-outline-primary btn-sm", onClick: getAllStats },
                React.createElement(Trans, null, "refresh_statics"))),
        statsProcessing && React.createElement(Loading, null),
        !statsProcessing && (React.createElement("div", { className: "row row-cards dashboard" },
            React.createElement("div", { className: "col-lg-12" },
                stats.interval === 0 && (React.createElement("div", { className: "alert alert-warning", role: "alert" },
                    React.createElement(Trans, { components: [
                            React.createElement(Link, { to: `${SETTINGS_URLS.settings}#stats-config`, key: "0" }, "link"),
                        ] }, "stats_disabled"))),
                React.createElement(Statistics, { dnsQueries: stats.dnsQueries, blockedFiltering: stats.blockedFiltering, replacedSafebrowsing: stats.replacedSafebrowsing, replacedParental: stats.replacedParental, numDnsQueries: stats.numDnsQueries, numBlockedFiltering: stats.numBlockedFiltering, numReplacedSafebrowsing: stats.numReplacedSafebrowsing, numReplacedParental: stats.numReplacedParental })),
            React.createElement("div", { className: "col-lg-6" },
                React.createElement(Counters, { subtitle: subtitle, refreshButton: refreshButton })),
            React.createElement("div", { className: "col-lg-6" },
                React.createElement(Clients, { subtitle: subtitle, refreshButton: refreshButton })),
            React.createElement("div", { className: "col-lg-6" },
                React.createElement(QueriedDomains, { subtitle: subtitle, dnsQueries: stats.numDnsQueries, topQueriedDomains: stats.topQueriedDomains, refreshButton: refreshButton })),
            React.createElement("div", { className: "col-lg-6" },
                React.createElement(BlockedDomains, { subtitle: subtitle, topBlockedDomains: stats.topBlockedDomains, blockedFiltering: stats.numBlockedFiltering, replacedSafebrowsing: stats.numReplacedSafebrowsing, replacedSafesearch: stats.numReplacedSafesearch, replacedParental: stats.numReplacedParental, refreshButton: refreshButton })),
            React.createElement("div", { className: "col-lg-6" },
                React.createElement(UpstreamResponses, { subtitle: subtitle, topUpstreamsResponses: stats.topUpstreamsResponses, refreshButton: refreshButton })),
            React.createElement("div", { className: "col-lg-6" },
                React.createElement(UpstreamAvgTime, { subtitle: subtitle, topUpstreamsAvgTime: stats.topUpstreamsAvgTime, refreshButton: refreshButton }))))));
};
export default Dashboard;

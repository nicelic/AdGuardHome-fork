import React, { Component, Fragment } from 'react';
import { withTranslation } from 'react-i18next';
import i18next from 'i18next';
import StatsConfig from './StatsConfig';
import LogsConfig from './LogsConfig';
import { FiltersConfig } from './FiltersConfig';
import { Checkbox } from '../ui/Controls/Checkbox';
import Loading from '../ui/Loading';
import PageTitle from '../ui/PageTitle';
import Card from '../ui/Card';
import { captitalizeWords } from '../../helpers/helpers';
import './Settings.css';
class Settings extends Component {
    componentDidMount() {
        this.props.initSettings();
        this.props.getStatsConfig();
        this.props.getLogsConfig();
        this.props.getFilteringStatus();
    }
    renderSafeSearch = () => {
        const safesearch = this.props.settings.settingsList?.safesearch || {};
        const { enabled } = safesearch;
        const searches = { ...(safesearch || {}) };
        delete searches.enabled;
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "form__group form__group--checkbox" },
                React.createElement(Checkbox, { "data-testid": "safesearch", value: enabled, title: i18next.t('enforce_safe_search'), subtitle: i18next.t('enforce_save_search_hint'), onChange: (checked) => this.props.toggleSetting('safesearch', { ...safesearch, enabled: checked }) })),
            React.createElement("div", { className: "form__group--inner" }, Object.keys(searches).map((searchKey) => (React.createElement("div", { key: searchKey, className: "form__group form__group--checkbox" },
                React.createElement(Checkbox, { value: searches[searchKey], title: captitalizeWords(searchKey), disabled: !safesearch.enabled, onChange: (checked) => this.props.toggleSetting('safesearch', { ...safesearch, [searchKey]: checked }) })))))));
    };
    render() {
        const { settings, setStatsConfig, resetStats, stats, queryLogs, setLogsConfig, clearLogs, filtering, setFiltersConfig, t, } = this.props;
        const safebrowsingEnabled = settings.settingsList?.safebrowsing?.enabled ?? false;
        const parentalEnabled = settings.settingsList?.parental?.enabled ?? false;
        const isDataReady = !settings.processing && !stats.processingGetConfig && !queryLogs.processingGetConfig;
        return (React.createElement(Fragment, null,
            React.createElement(PageTitle, { title: t('general_settings') }),
            !isDataReady && React.createElement(Loading, null),
            isDataReady && (React.createElement("div", { className: "content" },
                React.createElement("div", { className: "row" },
                    React.createElement("div", { className: "col-md-12" },
                        React.createElement(Card, { bodyType: "card-body box-body--settings" },
                            React.createElement("div", { className: "form" },
                                React.createElement(FiltersConfig, { initialValues: {
                                        interval: filtering.interval,
                                        enabled: filtering.enabled,
                                    }, processing: filtering.processingSetConfig, setFiltersConfig: setFiltersConfig }),
                                React.createElement("div", { className: "form__group form__group--checkbox" },
                                    React.createElement(Checkbox, { "data-testid": "safebrowsing", value: safebrowsingEnabled, title: t('use_adguard_browsing_sec'), subtitle: t('use_adguard_browsing_sec_hint'), onChange: (checked) => this.props.toggleSetting('safebrowsing', !checked) })),
                                React.createElement("div", { className: "form__group form__group--checkbox" },
                                    React.createElement(Checkbox, { "data-testid": "parental", value: parentalEnabled, title: t('use_adguard_parental'), subtitle: t('use_adguard_parental_hint'), onChange: (checked) => this.props.toggleSetting('parental', !checked) })),
                                this.renderSafeSearch()))),
                    React.createElement("div", { className: "col-md-12" },
                        React.createElement(LogsConfig, { enabled: queryLogs.enabled, ignored: queryLogs.ignored, ignoredEnabled: queryLogs.ignored_enabled, interval: queryLogs.interval, customInterval: queryLogs.customInterval, anonymize_client_ip: queryLogs.anonymize_client_ip, processing: queryLogs.processingSetConfig, processingClear: queryLogs.processingClear, setLogsConfig: setLogsConfig, clearLogs: clearLogs })),
                    React.createElement("div", { className: "col-md-12" },
                        React.createElement(StatsConfig, { interval: stats.interval, customInterval: stats.customInterval, ignored: stats.ignored, ignoredEnabled: stats.ignored_enabled, enabled: stats.enabled, processing: stats.processingSetConfig, processingReset: stats.processingReset, setStatsConfig: setStatsConfig, resetStats: resetStats })))))));
    }
}
export default withTranslation()(Settings);

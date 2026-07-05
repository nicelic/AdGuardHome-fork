import React, { Component } from 'react';
import { withTranslation } from 'react-i18next';
import Card from '../../ui/Card';
import { Form } from './Form';
import { HOUR } from '../../../helpers/constants';
class StatsConfig extends Component {
    handleFormSubmit = ({ enabled, interval, ignored, ignored_enabled, customInterval }) => {
        const { t, interval: prevInterval } = this.props;
        const newInterval = customInterval ? customInterval * HOUR : interval;
        const config = {
            enabled,
            interval: newInterval,
            ignored: ignored ? ignored.split('\n') : [],
            ignored_enabled,
        };
        if (config.interval < prevInterval) {
            if (window.confirm(t('statistics_retention_confirm'))) {
                this.props.setStatsConfig(config);
            }
        }
        else {
            this.props.setStatsConfig(config);
        }
    };
    handleReset = () => {
        const { t, resetStats } = this.props;
        // eslint-disable-next-line no-alert
        if (window.confirm(t('statistics_clear_confirm'))) {
            resetStats();
        }
    };
    render() {
        const { t, interval, customInterval, processing, processingReset, ignored, ignoredEnabled, enabled, } = this.props;
        return (React.createElement(Card, { title: t('statistics_configuration'), bodyType: "card-body box-body--settings", id: "stats-config" },
            React.createElement("div", { className: "form" },
                React.createElement(Form, { initialValues: {
                        interval,
                        customInterval,
                        enabled,
                        ignored: ignored?.join('\n'),
                        ignored_enabled: ignoredEnabled,
                    }, processing: processing, processingReset: processingReset, onSubmit: this.handleFormSubmit, onReset: this.handleReset }))));
    }
}
export default withTranslation()(StatsConfig);

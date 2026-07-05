import React from 'react';
// @ts-expect-error FIXME: update react-table
import ReactTable from 'react-table';
import round from 'lodash/round';
import { withTranslation, Trans } from 'react-i18next';
import Card from '../ui/Card';
import DomainCell from './DomainCell';
import { DASHBOARD_TABLES_DEFAULT_PAGE_SIZE, TABLES_MIN_ROWS } from '../../helpers/constants';
import { formatNumber } from '../../helpers/helpers';
const TimeCell = ({ value }) => {
    if (!value) {
        return '–';
    }
    const valueInMilliseconds = formatNumber(round(Number(value) * 1000));
    return (React.createElement("div", { className: "logs__row o-hidden" },
        React.createElement("span", { className: "logs__text logs__text--full", title: valueInMilliseconds.toString() },
            valueInMilliseconds,
            "\u00A0ms")));
};
const UpstreamAvgTime = ({ t, refreshButton, topUpstreamsAvgTime, subtitle }) => (React.createElement(Card, { title: t('average_upstream_response_time'), subtitle: subtitle, bodyType: "card-table", refresh: refreshButton },
    React.createElement(ReactTable, { data: topUpstreamsAvgTime.map(({ name: domain, count }) => ({
            domain,
            count,
        })), columns: [
            {
                Header: React.createElement(Trans, null, "upstream"),
                accessor: 'domain',
                Cell: DomainCell,
            },
            {
                Header: React.createElement(Trans, null, "response_time"),
                accessor: 'count',
                maxWidth: 190,
                Cell: TimeCell,
            },
        ], showPagination: false, noDataText: t('no_upstreams_data_found'), minRows: TABLES_MIN_ROWS, defaultPageSize: DASHBOARD_TABLES_DEFAULT_PAGE_SIZE, className: "-highlight card-table-overflow--limited stats__table" })));
export default withTranslation()(UpstreamAvgTime);

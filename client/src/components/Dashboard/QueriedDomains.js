import React from 'react';
// @ts-expect-error FIXME: update react-table
import ReactTable from 'react-table';
import { withTranslation, Trans } from 'react-i18next';
import Card from '../ui/Card';
import Cell from '../ui/Cell';
import DomainCell from './DomainCell';
import { DASHBOARD_TABLES_DEFAULT_PAGE_SIZE, STATUS_COLORS, TABLES_MIN_ROWS } from '../../helpers/constants';
import { getPercent } from '../../helpers/helpers';
const getQueriedPercentColor = (percent) => {
    if (percent > 10) {
        return STATUS_COLORS.red;
    }
    if (percent > 5) {
        return STATUS_COLORS.yellow;
    }
    return STATUS_COLORS.green;
};
const countCell = (dnsQueries) => function cell(row) {
    const { value } = row;
    const percent = getPercent(dnsQueries, value);
    const percentColor = getQueriedPercentColor(percent);
    return React.createElement(Cell, { value: value, percent: percent, color: percentColor, search: row.original.domain });
};
const QueriedDomains = ({ t, refreshButton, topQueriedDomains, subtitle, dnsQueries }) => (React.createElement(Card, { title: t('stats_query_domain'), subtitle: subtitle, bodyType: "card-table", refresh: refreshButton },
    React.createElement(ReactTable, { data: topQueriedDomains.map(({ name: domain, count }) => ({
            domain,
            count,
        })), columns: [
            {
                Header: React.createElement(Trans, null, "domain"),
                accessor: 'domain',
                Cell: DomainCell,
            },
            {
                Header: React.createElement(Trans, null, "requests_count"),
                accessor: 'count',
                maxWidth: 190,
                Cell: countCell(dnsQueries),
            },
        ], showPagination: false, noDataText: t('no_domains_found'), minRows: TABLES_MIN_ROWS, defaultPageSize: DASHBOARD_TABLES_DEFAULT_PAGE_SIZE, className: "-highlight card-table-overflow--limited stats__table" })));
export default withTranslation()(QueriedDomains);

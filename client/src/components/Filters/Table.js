import React, { Component } from 'react';
// @ts-expect-error FIXME: update react-table
import ReactTable from 'react-table';
import { withTranslation, Trans } from 'react-i18next';
import CellWrap from '../ui/CellWrap';
import { MODAL_TYPE } from '../../helpers/constants';
import { formatDetailedDateTime } from '../../helpers/helpers';
import { isValidAbsolutePath } from '../../helpers/form';
import { LOCAL_STORAGE_KEYS, LocalStorageHelper } from '../../helpers/localStorageHelper';
class Table extends Component {
    getDateCell = (row) => CellWrap(row, formatDetailedDateTime);
    renderCheckbox = ({ original }) => {
        const { processingConfigFilter, toggleFilter } = this.props;
        const { url, name, enabled } = original;
        const data = { name, url, enabled: !enabled };
        return (React.createElement("label", { className: "checkbox" },
            React.createElement("input", { type: "checkbox", className: "checkbox__input", onChange: () => toggleFilter(url, data), checked: enabled, disabled: processingConfigFilter }),
            React.createElement("span", { className: "checkbox__label" })));
    };
    columns = [
        {
            Header: React.createElement(Trans, null, "enabled_table_header"),
            accessor: 'enabled',
            Cell: this.renderCheckbox,
            width: 90,
            className: 'text-center',
            resizable: false,
        },
        {
            Header: React.createElement(Trans, null, "name_table_header"),
            accessor: 'name',
            minWidth: 180,
            Cell: CellWrap,
        },
        {
            Header: React.createElement(Trans, null, "list_url_table_header"),
            accessor: 'url',
            minWidth: 180,
            // eslint-disable-next-line react/prop-types
            Cell: ({ value }) => (React.createElement("div", { className: "logs__row" }, isValidAbsolutePath(value) ? (value) : (React.createElement("a", { href: value, target: "_blank", rel: "noopener noreferrer", className: "link logs__text" }, value)))),
        },
        {
            Header: React.createElement(Trans, null, "rules_count_table_header"),
            accessor: 'rulesCount',
            className: 'text-center',
            minWidth: 100,
            Cell: (props) => props.value.toLocaleString(),
        },
        {
            Header: React.createElement(Trans, null, "last_time_updated_table_header"),
            accessor: 'lastUpdated',
            className: 'text-center',
            minWidth: 180,
            Cell: this.getDateCell,
        },
        {
            Header: React.createElement(Trans, null, "actions_table_header"),
            accessor: 'actions',
            className: 'text-center',
            width: 100,
            sortable: false,
            resizable: false,
            Cell: (row) => {
                const { original } = row;
                const { url } = original;
                const { t, toggleFilteringModal, handleDelete } = this.props;
                return (React.createElement("div", { className: "logs__row logs__row--center" },
                    React.createElement("button", { type: "button", className: "btn btn-icon btn-outline-primary btn-sm mr-2", title: t('edit_table_action'), onClick: () => toggleFilteringModal({
                            type: MODAL_TYPE.EDIT_FILTERS,
                            url,
                        }) },
                        React.createElement("svg", { className: "icons icon12" },
                            React.createElement("use", { xlinkHref: "#edit" }))),
                    React.createElement("button", { type: "button", className: "btn btn-icon btn-outline-secondary btn-sm", onClick: () => handleDelete(url), title: t('delete_table_action') },
                        React.createElement("svg", { className: "icons icon12" },
                            React.createElement("use", { xlinkHref: "#delete" })))));
            },
        },
    ];
    render() {
        const { loading, filters, t, whitelist } = this.props;
        const localStorageKey = whitelist
            ? LOCAL_STORAGE_KEYS.ALLOWLIST_PAGE_SIZE
            : LOCAL_STORAGE_KEYS.BLOCKLIST_PAGE_SIZE;
        return (React.createElement(ReactTable, { data: filters, columns: this.columns, showPagination: true, defaultPageSize: LocalStorageHelper.getItem(localStorageKey) || 10, onPageSizeChange: (size) => LocalStorageHelper.setItem(localStorageKey, size), loading: loading, minRows: 6, ofText: "/", previousText: t('previous_btn'), nextText: t('next_btn'), pageText: t('page_table_footer_text'), rowsText: t('rows_table_footer_text'), loadingText: t('loading_table_status'), noDataText: whitelist ? t('no_whitelist_added') : t('no_blocklist_added') }));
    }
}
export default withTranslation()(Table);

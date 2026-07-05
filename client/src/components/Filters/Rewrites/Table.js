import React, { Component } from 'react';
// @ts-expect-error FIXME: update react-table
import ReactTable from 'react-table';
import { withTranslation } from 'react-i18next';
import { sortIp } from '../../../helpers/helpers';
import { MODAL_TYPE, TABLES_MIN_ROWS } from '../../../helpers/constants';
import { LocalStorageHelper, LOCAL_STORAGE_KEYS } from '../../../helpers/localStorageHelper';
class Table extends Component {
    cellWrap = ({ value }) => (React.createElement("div", { className: "logs__row o-hidden" },
        React.createElement("span", { className: "logs__text", title: value }, value)));
    renderCheckbox = ({ original }) => {
        const { processing, settings, toggleRewrite } = this.props;
        const isEnabledSettings = Boolean(settings && settings.enabled);
        return (React.createElement("label", { className: "checkbox" },
            React.createElement("input", { "data-testid": "rewrite-enabled", type: "checkbox", className: "checkbox__input", onChange: () => toggleRewrite(original), checked: original.enabled, disabled: processing || !isEnabledSettings }),
            React.createElement("span", { className: "checkbox__label" })));
    };
    columns = [
        {
            Header: this.props.t('enabled_table_header'),
            accessor: 'enabled',
            Cell: this.renderCheckbox,
            width: 90,
            className: 'text-center',
            resizable: false,
        },
        {
            Header: this.props.t('domain'),
            accessor: 'domain',
            Cell: this.cellWrap,
        },
        {
            Header: this.props.t('answer'),
            accessor: 'answer',
            sortMethod: sortIp,
            Cell: this.cellWrap,
        },
        {
            Header: this.props.t('actions_table_header'),
            accessor: 'actions',
            maxWidth: 100,
            sortable: false,
            resizable: false,
            Cell: (row) => {
                const { original } = row;
                return (React.createElement("div", { className: "logs__row logs__row--center" },
                    React.createElement("button", { "data-testid": "edit-rewrite", type: "button", className: "btn btn-icon btn-outline-primary btn-sm mr-2", onClick: () => {
                            this.props.toggleRewritesModal({
                                type: MODAL_TYPE.EDIT_REWRITE,
                                currentRewrite: original,
                            });
                        }, disabled: this.props.processingUpdate, title: this.props.t('edit_table_action') },
                        React.createElement("svg", { className: "icons icon12" },
                            React.createElement("use", { xlinkHref: "#edit" }))),
                    React.createElement("button", { "data-testid": "delete-rewrite", type: "button", className: "btn btn-icon btn-outline-secondary btn-sm", onClick: () => this.props.handleDelete(original), title: this.props.t('delete_table_action') },
                        React.createElement("svg", { className: "icons" },
                            React.createElement("use", { xlinkHref: "#delete" })))));
            },
        },
    ];
    render() {
        const { t, list, processing, processingAdd, processingDelete } = this.props;
        return (React.createElement(ReactTable, { data: list || [], columns: this.columns, loading: processing || processingAdd || processingDelete, className: "-striped -highlight card-table-overflow", showPagination: true, defaultPageSize: LocalStorageHelper.getItem(LOCAL_STORAGE_KEYS.REWRITES_PAGE_SIZE) || 10, onPageSizeChange: (size) => LocalStorageHelper.setItem(LOCAL_STORAGE_KEYS.REWRITES_PAGE_SIZE, size), minRows: TABLES_MIN_ROWS, ofText: "/", previousText: t('previous_btn'), nextText: t('next_btn'), pageText: t('page_table_footer_text'), rowsText: t('rows_table_footer_text'), loadingText: t('loading_table_status'), noDataText: t('rewrite_not_found') }));
    }
}
export default withTranslation()(Table);

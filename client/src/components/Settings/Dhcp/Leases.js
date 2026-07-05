import React, { Component } from 'react';
import { connect } from 'react-redux';
// @ts-expect-error FIXME: update react-table
import ReactTable from 'react-table';
import { Trans, withTranslation } from 'react-i18next';
import { LEASES_TABLE_DEFAULT_PAGE_SIZE, MODAL_TYPE } from '../../../helpers/constants';
import { sortIp } from '../../../helpers/helpers';
import { toggleLeaseModal } from '../../../actions';
class Leases extends Component {
    cellWrap = ({ value }) => (React.createElement("div", { className: "logs__row o-hidden" },
        React.createElement("span", { className: "logs__text", title: value }, value)));
    convertToStatic = (data) => () => {
        const { dispatch } = this.props;
        dispatch(toggleLeaseModal({
            type: MODAL_TYPE.ADD_LEASE,
            config: data,
        }));
    };
    makeStatic = ({ row }) => {
        const { t, disabledLeasesButton } = this.props;
        return (React.createElement("div", { className: "logs__row logs__row--center" },
            React.createElement("button", { type: "button", className: "btn btn-icon btn-icon--green btn-outline-success btn-sm", title: t('make_static'), onClick: this.convertToStatic(row), disabled: disabledLeasesButton },
                React.createElement("svg", { className: "icons icon12" },
                    React.createElement("use", { xlinkHref: "#plus" })))));
    };
    render() {
        const { leases, t } = this.props;
        return (React.createElement(ReactTable, { data: leases || [], columns: [
                {
                    Header: 'MAC',
                    accessor: 'mac',
                    minWidth: 180,
                    Cell: this.cellWrap,
                },
                {
                    Header: 'IP',
                    accessor: 'ip',
                    minWidth: 230,
                    Cell: this.cellWrap,
                    sortMethod: sortIp,
                },
                {
                    Header: React.createElement(Trans, null, "dhcp_table_hostname"),
                    accessor: 'hostname',
                    minWidth: 230,
                    Cell: this.cellWrap,
                },
                {
                    Header: React.createElement(Trans, null, "dhcp_table_expires"),
                    accessor: 'expires',
                    minWidth: 220,
                    Cell: this.cellWrap,
                },
                {
                    Header: React.createElement(Trans, null, "actions_table_header"),
                    Cell: this.makeStatic,
                },
            ], pageSize: LEASES_TABLE_DEFAULT_PAGE_SIZE, showPageSizeOptions: false, showPagination: leases.length > LEASES_TABLE_DEFAULT_PAGE_SIZE, noDataText: t('dhcp_leases_not_found'), minRows: 6, className: "-striped -highlight card-table-overflow" }));
    }
}
export default withTranslation()(connect(() => ({}), (dispatch) => ({ dispatch }))(Leases));

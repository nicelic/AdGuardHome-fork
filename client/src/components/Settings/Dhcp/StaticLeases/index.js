import React from 'react';
// @ts-expect-error FIXME: update react-table
import ReactTable from 'react-table';
import { Trans, useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { LEASES_TABLE_DEFAULT_PAGE_SIZE, MODAL_TYPE } from '../../../../helpers/constants';
import { sortIp } from '../../../../helpers/helpers';
import Modal from './Modal';
import { addStaticLease, removeStaticLease, toggleLeaseModal, updateStaticLease } from '../../../../actions';
const cellWrap = ({ value }) => (React.createElement("div", { className: "logs__row o-hidden" },
    React.createElement("span", { className: "logs__text", title: value }, value)));
const StaticLeases = ({ isModalOpen, modalType, processingAdding, processingDeleting, processingUpdating, staticLeases, cidr, gatewayIp, }) => {
    const [t] = useTranslation();
    const dispatch = useDispatch();
    const handleSubmit = (data) => {
        const { mac, ip, hostname } = data;
        if (modalType === MODAL_TYPE.EDIT_LEASE) {
            dispatch(updateStaticLease({ mac, ip, hostname }));
        }
        else {
            dispatch(addStaticLease({ mac, ip, hostname }));
        }
    };
    const handleDelete = (ip, mac, hostname = '') => {
        const name = hostname || ip;
        // eslint-disable-next-line no-alert
        if (window.confirm(t('delete_confirm', { key: name }))) {
            dispatch(removeStaticLease({
                ip,
                mac,
                hostname,
            }));
        }
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(ReactTable, { data: staticLeases || [], columns: [
                {
                    Header: 'MAC',
                    accessor: 'mac',
                    minWidth: 180,
                    Cell: cellWrap,
                },
                {
                    Header: 'IP',
                    accessor: 'ip',
                    minWidth: 230,
                    sortMethod: sortIp,
                    Cell: cellWrap,
                },
                {
                    Header: React.createElement(Trans, null, "dhcp_table_hostname"),
                    accessor: 'hostname',
                    minWidth: 230,
                    Cell: cellWrap,
                },
                {
                    Header: React.createElement(Trans, null, "actions_table_header"),
                    accessor: 'actions',
                    maxWidth: 150,
                    sortable: false,
                    resizable: false,
                    // eslint-disable-next-line react/display-name
                    Cell: (row) => {
                        const { ip, mac, hostname } = row.original;
                        return (React.createElement("div", { className: "logs__row logs__row--center" },
                            React.createElement("button", { type: "button", className: "btn btn-icon btn-outline-primary btn-sm mr-2", onClick: () => dispatch(toggleLeaseModal({
                                    type: MODAL_TYPE.EDIT_LEASE,
                                    config: { ip, mac, hostname },
                                })), disabled: processingUpdating, title: t('edit_table_action') },
                                React.createElement("svg", { className: "icons icon12" },
                                    React.createElement("use", { xlinkHref: "#edit" }))),
                            React.createElement("button", { type: "button", className: "btn btn-icon btn-outline-secondary btn-sm", onClick: () => handleDelete(ip, mac, hostname), disabled: processingDeleting, title: t('delete_table_action') },
                                React.createElement("svg", { className: "icons icon12" },
                                    React.createElement("use", { xlinkHref: "#delete" })))));
                    },
                },
            ], pageSize: LEASES_TABLE_DEFAULT_PAGE_SIZE, showPageSizeOptions: false, showPagination: staticLeases.length > LEASES_TABLE_DEFAULT_PAGE_SIZE, noDataText: t('dhcp_static_leases_not_found'), className: "-striped -highlight card-table-overflow", minRows: 6 }),
        React.createElement(Modal, { isModalOpen: isModalOpen, modalType: modalType, handleSubmit: handleSubmit, processingAdding: processingAdding, cidr: cidr, gatewayIp: gatewayIp })));
};
export default StaticLeases;

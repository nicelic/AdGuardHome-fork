import React from 'react';
import { Trans, withTranslation } from 'react-i18next';
import ReactModal from 'react-modal';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { Form } from './Form';
import { toggleLeaseModal } from '../../../../actions';
import { MODAL_TYPE } from '../../../../helpers/constants';
const Modal = ({ isModalOpen, modalType, handleSubmit, processingAdding, cidr, gatewayIp, }) => {
    const dispatch = useDispatch();
    const toggleModal = () => dispatch(toggleLeaseModal());
    const leaseInitialData = useSelector((state) => state.dhcp.leaseModalConfig, shallowEqual);
    return (React.createElement(ReactModal, { className: "Modal__Bootstrap modal-dialog modal-dialog-centered modal-dialog--clients", closeTimeoutMS: 0, isOpen: isModalOpen, onRequestClose: toggleModal },
        React.createElement("div", { className: "modal-content" },
            React.createElement("div", { className: "modal-header" },
                React.createElement("h4", { className: "modal-title" }, modalType === MODAL_TYPE.EDIT_LEASE ? (React.createElement(Trans, null, "dhcp_edit_static_lease")) : (React.createElement(Trans, null, "dhcp_new_static_lease"))),
                React.createElement("button", { type: "button", className: "close", onClick: toggleModal },
                    React.createElement("span", { className: "sr-only" }, "Close"))),
            React.createElement(Form, { initialValues: {
                    mac: leaseInitialData?.mac ?? '',
                    ip: leaseInitialData?.ip ?? '',
                    hostname: leaseInitialData?.hostname ?? '',
                    cidr,
                    gatewayIp,
                }, onSubmit: handleSubmit, processingAdding: processingAdding, cidr: cidr, isEdit: modalType === MODAL_TYPE.EDIT_LEASE }))));
};
export default withTranslation()(Modal);

import React from 'react';
import { Trans, withTranslation } from 'react-i18next';
import ReactModal from 'react-modal';
import { MODAL_TYPE } from '../../../helpers/constants';
import { Form } from './Form';
const normalizeIds = (initialIds) => {
    if (!initialIds || initialIds.length === 0) {
        return [{ name: '' }];
    }
    return initialIds.map((id) => ({ name: id }));
};
const getInitialData = ({ initial, modalType, clientId, clientName }) => {
    if (initial && initial.blocked_services) {
        const { blocked_services } = initial;
        const blocked = {};
        blocked_services.forEach((service) => {
            blocked[service] = true;
        });
        return {
            ...initial,
            blocked_services: blocked,
            ids: normalizeIds(initial.ids),
        };
    }
    if (modalType !== MODAL_TYPE.EDIT_CLIENT && clientId) {
        return {
            ...initial,
            name: clientName,
            ids: [{ name: clientId }],
        };
    }
    return {
        ...initial,
        ids: normalizeIds(initial.ids),
    };
};
const Modal = ({ isModalOpen, modalType, currentClientData, handleSubmit, handleClose, processingAdding, processingUpdating, tagsOptions, clientId, t, }) => {
    const initialData = getInitialData({
        initial: currentClientData,
        modalType,
        clientId,
        clientName: t('client_name', { id: clientId }),
    });
    return (React.createElement(ReactModal, { className: "Modal__Bootstrap modal-dialog modal-dialog-centered modal-dialog--clients", closeTimeoutMS: 0, isOpen: isModalOpen, onRequestClose: handleClose },
        React.createElement("div", { className: "modal-content" },
            React.createElement("div", { className: "modal-header" },
                React.createElement("h4", { className: "modal-title" }, modalType === MODAL_TYPE.EDIT_CLIENT ? React.createElement(Trans, null, "client_edit") : React.createElement(Trans, null, "client_new")),
                React.createElement("button", { type: "button", className: "close", onClick: handleClose },
                    React.createElement("span", { className: "sr-only" }, "Close"))),
            React.createElement(Form, { initialValues: { ...initialData }, onSubmit: handleSubmit, onClose: handleClose, processingAdding: processingAdding, processingUpdating: processingUpdating, tagsOptions: tagsOptions }))));
};
export default withTranslation()(Modal);

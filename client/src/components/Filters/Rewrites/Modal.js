import React from 'react';
import { Trans, withTranslation } from 'react-i18next';
import ReactModal from 'react-modal';
import { MODAL_TYPE } from '../../../helpers/constants';
import Form from './Form';
const Modal = (props) => {
    const { isModalOpen, handleSubmit, toggleRewritesModal, processingAdd, modalType, currentRewrite, } = props;
    return (React.createElement(ReactModal, { className: "Modal__Bootstrap modal-dialog modal-dialog-centered", closeTimeoutMS: 0, isOpen: isModalOpen, onRequestClose: () => toggleRewritesModal() },
        React.createElement("div", { className: "modal-content" },
            React.createElement("div", { className: "modal-header" },
                React.createElement("h4", { className: "modal-title" }, modalType === MODAL_TYPE.EDIT_REWRITE ? (React.createElement(Trans, null, "rewrite_edit")) : (React.createElement(Trans, null, "rewrite_add"))),
                React.createElement("button", { type: "button", className: "close", onClick: () => toggleRewritesModal() },
                    React.createElement("span", { className: "sr-only" }, "Close"))),
            React.createElement(Form, { onSubmit: handleSubmit, toggleRewritesModal: toggleRewritesModal, processingAdd: processingAdd, currentRewrite: currentRewrite }))));
};
export default withTranslation()(Modal);

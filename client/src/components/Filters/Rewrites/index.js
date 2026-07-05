import React, { Component, Fragment } from 'react';
import { Trans, withTranslation } from 'react-i18next';
import cn from 'classnames';
import Table from './Table';
import Modal from './Modal';
import Card from '../../ui/Card';
import PageTitle from '../../ui/PageTitle';
import { MODAL_TYPE } from '../../../helpers/constants';
class Rewrites extends Component {
    componentDidMount() {
        this.props.getRewritesList();
        this.props.getRewriteSettings();
    }
    handleDelete = (values) => {
        // eslint-disable-next-line no-alert
        if (window.confirm(this.props.t('rewrite_confirm_delete', { key: values.domain }))) {
            this.props.deleteRewrite(values);
        }
    };
    handleSubmit = (values) => {
        const { modalType, currentRewrite } = this.props.rewrites;
        if (modalType === MODAL_TYPE.EDIT_REWRITE && currentRewrite) {
            this.props.updateRewrite({
                target: currentRewrite,
                update: values,
            });
        }
        else {
            this.props.addRewrite(values);
        }
    };
    toggleRewrite = (currentRewrite) => {
        const updatedRewrite = { ...currentRewrite, enabled: !currentRewrite.enabled };
        this.props.updateRewrite({
            target: currentRewrite,
            update: updatedRewrite,
        });
    };
    toggleRewriteSettings = () => {
        const { enabled } = this.props.rewrites.settings;
        this.props.updateRewriteSettings({ enabled: !enabled });
    };
    render() {
        const { t, rewrites, toggleRewritesModal, } = this.props;
        const { list, isModalOpen, processing, processingAdd, processingDelete, processingUpdate, modalType, currentRewrite, settings } = rewrites;
        const isEnabledSettings = settings.enabled;
        return (React.createElement(Fragment, null,
            React.createElement(PageTitle, { title: t('dns_rewrites'), subtitle: t('rewrite_desc') }),
            React.createElement("div", { className: cn(isEnabledSettings ? 'text-success' : 'text-warning', 'mb-2') }, isEnabledSettings ? t('rewrites_enabled_table_header') : t('rewrites_disabled_table_header')),
            React.createElement(Card, { id: "rewrites", bodyType: "card-body box-body--settings" },
                React.createElement(Fragment, null,
                    React.createElement(Table, { list: list, processing: processing, processingAdd: processingAdd, processingDelete: processingDelete, processingUpdate: processingUpdate, handleDelete: this.handleDelete, toggleRewritesModal: toggleRewritesModal, toggleRewrite: this.toggleRewrite, settings: settings }),
                    React.createElement("div", { className: "card-actions" },
                        React.createElement("button", { "data-testid": "add-rewrite", type: "button", className: "btn btn-success btn-standard  mr-2", onClick: () => toggleRewritesModal({ type: MODAL_TYPE.ADD_REWRITE }), disabled: processingAdd },
                            React.createElement(Trans, null, "rewrite_add")),
                        React.createElement("button", { "data-testid": "toggle-rewrite-settings", type: "button", className: "btn btn-primary btn-standard", onClick: () => this.toggleRewriteSettings(), disabled: processingUpdate },
                            React.createElement(Trans, null, isEnabledSettings ? 'disable_rewrites' : 'enable_rewrites'))),
                    React.createElement(Modal, { isModalOpen: isModalOpen, modalType: modalType, toggleRewritesModal: toggleRewritesModal, handleSubmit: this.handleSubmit, processingAdd: processingAdd, processingDelete: processingDelete, currentRewrite: currentRewrite })))));
    }
}
export default withTranslation()(Rewrites);

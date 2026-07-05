import React, { Component, Fragment } from 'react';
import { withTranslation } from 'react-i18next';
import { ClientsTable } from './ClientsTable';
import AutoClients from './AutoClients';
import PageTitle from '../../ui/PageTitle';
import Loading from '../../ui/Loading';
class Clients extends Component {
    componentDidMount() {
        this.props.getClients();
        this.props.getStats();
    }
    render() {
        const { t, dashboard, stats, clients, addClient, updateClient, deleteClient, toggleClientModal, getStats, } = this.props;
        return (React.createElement(Fragment, null,
            React.createElement(PageTitle, { title: t('client_settings') }),
            (stats.processingStats || dashboard.processingClients) && React.createElement(Loading, null),
            !stats.processingStats && !dashboard.processingClients && (React.createElement(Fragment, null,
                React.createElement(ClientsTable, { clients: dashboard.clients, normalizedTopClients: stats.normalizedTopClients, isModalOpen: clients.isModalOpen, modalClientName: clients.modalClientName, modalType: clients.modalType, addClient: addClient, updateClient: updateClient, deleteClient: deleteClient, toggleClientModal: toggleClientModal, processingAdding: clients.processingAdding, processingDeleting: clients.processingDeleting, processingUpdating: clients.processingUpdating, getStats: getStats, supportedTags: dashboard.supportedTags }),
                React.createElement(AutoClients, { autoClients: dashboard.autoClients, normalizedTopClients: stats.normalizedTopClients })))));
    }
}
export default withTranslation()(Clients);

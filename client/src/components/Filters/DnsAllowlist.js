import React, { Component } from 'react';
import { withTranslation } from 'react-i18next';
import PageTitle from '../ui/PageTitle';
import Card from '../ui/Card';
import Modal from './Modal';
import Actions from './Actions';
import Table from './Table';
import { MODAL_TYPE } from '../../helpers/constants';
import { getCurrentFilter } from '../../helpers/helpers';
class DnsAllowlist extends Component {
    componentDidMount() {
        this.props.getFilteringStatus();
    }
    handleSubmit = (values) => {
        const { name, url } = values;
        const { filtering } = this.props;
        const whitelist = true;
        if (filtering.modalType === MODAL_TYPE.EDIT_FILTERS) {
            this.props.editFilter(filtering.modalFilterUrl, values, whitelist);
        }
        else {
            this.props.addFilter(url, name, whitelist);
        }
    };
    handleDelete = (url) => {
        if (window.confirm(this.props.t('list_confirm_delete'))) {
            const whitelist = true;
            this.props.removeFilter(url, whitelist);
        }
    };
    toggleFilter = (url, data) => {
        const whitelist = true;
        this.props.toggleFilterStatus(url, data, whitelist);
    };
    handleRefresh = () => {
        this.props.refreshFilters({ whitelist: true });
    };
    openAddFiltersModal = () => {
        this.props.toggleFilteringModal({ type: MODAL_TYPE.ADD_FILTERS });
    };
    render() {
        const { t, toggleFilteringModal, addFilter, filtering: { whitelistFilters, isModalOpen, isFilterAdded, processingRefreshFilters, processingRemoveFilter, processingAddFilter, processingConfigFilter, processingFilters, modalType, modalFilterUrl, }, } = this.props;
        const currentFilterData = getCurrentFilter(modalFilterUrl, whitelistFilters);
        const loading = processingConfigFilter ||
            processingFilters ||
            processingAddFilter ||
            processingRemoveFilter ||
            processingRefreshFilters;
        const whitelist = true;
        return (React.createElement(React.Fragment, null,
            React.createElement(PageTitle, { title: t('dns_allowlists'), subtitle: t('dns_allowlists_desc') }),
            React.createElement("div", { className: "content" },
                React.createElement("div", { className: "row" },
                    React.createElement("div", { className: "col-md-12" },
                        React.createElement(Card, { subtitle: t('filters_and_hosts_hint') },
                            React.createElement(Table, { filters: whitelistFilters, loading: loading, processingConfigFilter: processingConfigFilter, toggleFilteringModal: toggleFilteringModal, handleDelete: this.handleDelete, toggleFilter: this.toggleFilter, whitelist: whitelist }),
                            React.createElement(Actions, { handleAdd: this.openAddFiltersModal, handleRefresh: this.handleRefresh, processingRefreshFilters: processingRefreshFilters, whitelist: whitelist }))))),
            React.createElement(Modal, { filters: whitelistFilters, isOpen: isModalOpen, toggleFilteringModal: toggleFilteringModal, addFilter: addFilter, isFilterAdded: isFilterAdded, processingAddFilter: processingAddFilter, processingConfigFilter: processingConfigFilter, handleSubmit: this.handleSubmit, modalType: modalType, currentFilterData: currentFilterData, whitelist: whitelist })));
    }
}
export default withTranslation()(DnsAllowlist);

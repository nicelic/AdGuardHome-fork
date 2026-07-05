import React, { Component } from 'react';
import { withTranslation } from 'react-i18next';
import PageTitle from '../ui/PageTitle';
import Card from '../ui/Card';
import Modal from './Modal';
import Actions from './Actions';
import Table from './Table';
import { MODAL_TYPE } from '../../helpers/constants';
import { getCurrentFilter } from '../../helpers/helpers';
import filtersCatalog from '../../helpers/filters/filters';
class DnsBlocklist extends Component {
    componentDidMount() {
        this.props.getFilteringStatus();
    }
    handleSubmit = (values) => {
        const { modalFilterUrl, modalType } = this.props.filtering;
        switch (modalType) {
            case MODAL_TYPE.EDIT_FILTERS:
                this.props.editFilter(modalFilterUrl, values);
                break;
            case MODAL_TYPE.ADD_FILTERS: {
                const { name, url } = values;
                this.props.addFilter(url, name);
                break;
            }
            case MODAL_TYPE.CHOOSE_FILTERING_LIST: {
                const changedValues = Object.entries(values)?.reduce((acc, [key, value]) => {
                    if (value && key in filtersCatalog.filters) {
                        acc[key] = value;
                    }
                    return acc;
                }, {});
                Object.keys(changedValues).forEach((fieldName) => {
                    // filterId is actually in the field name
                    const { source, name } = filtersCatalog.filters[fieldName];
                    this.props.addFilter(source, name);
                });
                break;
            }
            default:
                break;
        }
    };
    handleDelete = (url) => {
        if (window.confirm(this.props.t('list_confirm_delete'))) {
            this.props.removeFilter(url);
        }
    };
    toggleFilter = (url, data) => {
        this.props.toggleFilterStatus(url, data);
    };
    handleRefresh = () => {
        this.props.refreshFilters({ whitelist: false });
    };
    openSelectTypeModal = () => {
        this.props.toggleFilteringModal({ type: MODAL_TYPE.SELECT_MODAL_TYPE });
    };
    render() {
        const { t, toggleFilteringModal, addFilter, filtering: { filters, isModalOpen, isFilterAdded, processingRefreshFilters, processingRemoveFilter, processingAddFilter, processingConfigFilter, processingFilters, modalType, modalFilterUrl, }, } = this.props;
        const currentFilterData = getCurrentFilter(modalFilterUrl, filters);
        const loading = processingConfigFilter ||
            processingFilters ||
            processingAddFilter ||
            processingRemoveFilter ||
            processingRefreshFilters;
        return (React.createElement(React.Fragment, null,
            React.createElement(PageTitle, { title: t('dns_blocklists'), subtitle: t('dns_blocklists_desc') }),
            React.createElement("div", { className: "content" },
                React.createElement("div", { className: "row" },
                    React.createElement("div", { className: "col-md-12" },
                        React.createElement(Card, { subtitle: t('filters_and_hosts_hint') },
                            React.createElement(Table, { filters: filters, loading: loading, processingConfigFilter: processingConfigFilter, toggleFilteringModal: toggleFilteringModal, handleDelete: this.handleDelete, toggleFilter: this.toggleFilter }),
                            React.createElement(Actions, { handleAdd: this.openSelectTypeModal, handleRefresh: this.handleRefresh, processingRefreshFilters: processingRefreshFilters }))))),
            React.createElement(Modal, { filtersCatalog: filtersCatalog, filters: filters, isOpen: isModalOpen, toggleFilteringModal: toggleFilteringModal, addFilter: addFilter, isFilterAdded: isFilterAdded, processingAddFilter: processingAddFilter, processingConfigFilter: processingConfigFilter, handleSubmit: this.handleSubmit, modalType: modalType, currentFilterData: currentFilterData })));
    }
}
export default withTranslation()(DnsBlocklist);

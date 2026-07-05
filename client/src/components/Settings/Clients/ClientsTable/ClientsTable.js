/* eslint-disable react/display-name */
/* eslint-disable react/prop-types */
import React, { useEffect } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory, useLocation } from 'react-router-dom';
// @ts-expect-error FIXME: update react-table
import ReactTable from 'react-table';
import { getAllBlockedServices, getBlockedServices } from '../../../../actions/services';
import { initSettings } from '../../../../actions';
import { splitByNewLine, countClientsStatistics, sortIp, getService, formatNumber } from '../../../../helpers/helpers';
import { MODAL_TYPE, LOCAL_TIMEZONE_VALUE, TABLES_MIN_ROWS } from '../../../../helpers/constants';
import Card from '../../../ui/Card';
import CellWrap from '../../../ui/CellWrap';
import LogsSearchLink from '../../../ui/LogsSearchLink';
import Modal from '../Modal';
import { LocalStorageHelper, LOCAL_STORAGE_KEYS } from '../../../../helpers/localStorageHelper';
const ClientsTable = ({ clients, normalizedTopClients, isModalOpen, modalClientName, modalType, addClient, updateClient, deleteClient, toggleClientModal, processingAdding, processingDeleting, processingUpdating, getStats, supportedTags, }) => {
    const [t] = useTranslation();
    const dispatch = useDispatch();
    const location = useLocation();
    const history = useHistory();
    const services = useSelector((state) => state?.services);
    const globalSettings = useSelector((state) => state?.settings.settingsList);
    const params = new URLSearchParams(location.search);
    const clientId = params.get('clientId');
    useEffect(() => {
        dispatch(getAllBlockedServices());
        dispatch(getBlockedServices());
        dispatch(initSettings());
        if (clientId) {
            toggleClientModal({
                type: MODAL_TYPE.ADD_CLIENT,
            });
        }
    }, []);
    const handleFormAdd = (values) => {
        addClient(values);
    };
    const handleFormUpdate = (values, name) => {
        updateClient(values, name);
    };
    const handleSubmit = (values) => {
        const config = { ...values };
        if (values) {
            if (values.blocked_services) {
                config.blocked_services = Object.keys(values.blocked_services).filter((service) => values.blocked_services[service]);
            }
            if (values.upstreams && typeof values.upstreams === 'string') {
                config.upstreams = splitByNewLine(values.upstreams);
            }
            else {
                config.upstreams = [];
            }
            if (values.tags) {
                config.tags = values.tags.map((tag) => tag.value);
            }
            else {
                config.tags = [];
            }
            if (values.ids) {
                config.ids = values.ids.map((id) => id.name);
            }
            else {
                config.ids = [];
            }
            if (typeof values.upstreams_cache_size === 'string') {
                config.upstreams_cache_size = 0;
            }
        }
        if (modalType === MODAL_TYPE.EDIT_CLIENT) {
            handleFormUpdate(config, modalClientName);
        }
        else {
            handleFormAdd(config);
        }
        if (clientId) {
            history.push('/#clients');
        }
    };
    const getOptionsWithLabels = (options) => options.map((option) => ({
        value: option,
        label: option,
    }));
    const getClient = (name, clients) => {
        const client = clients.find((item) => name === item.name);
        if (client) {
            const { upstreams, tags, ...values } = client;
            return {
                upstreams: (upstreams && upstreams.join('\n')) || '',
                tags: (tags && getOptionsWithLabels(tags)) || [],
                ...values,
            };
        }
        return {
            ids: [''],
            tags: [],
            use_global_settings: true,
            use_global_blocked_services: true,
            blocked_services_schedule: {
                time_zone: LOCAL_TIMEZONE_VALUE,
            },
            safe_search: { ...(globalSettings?.safesearch || {}) },
        };
    };
    const handleDelete = (data) => {
        // eslint-disable-next-line no-alert
        if (window.confirm(t('client_confirm_delete', { key: data.name }))) {
            deleteClient(data);
            getStats();
        }
    };
    const handleClose = () => {
        toggleClientModal();
        if (clientId) {
            history.push('/#clients');
        }
    };
    const columns = [
        {
            Header: t('table_client'),
            accessor: 'ids',
            minWidth: 150,
            Cell: (row) => {
                const { value } = row;
                return (React.createElement("div", { className: "logs__row o-hidden" },
                    React.createElement("span", { className: "logs__text" }, value.map((address) => (React.createElement("div", { key: address, title: address }, address))))));
            },
            sortMethod: sortIp,
        },
        {
            Header: t('table_name'),
            accessor: 'name',
            minWidth: 120,
            Cell: CellWrap,
        },
        {
            Header: t('settings'),
            accessor: 'use_global_settings',
            minWidth: 120,
            Cell: ({ value }) => {
                const title = value ? React.createElement(Trans, null, "settings_global") : React.createElement(Trans, null, "settings_custom");
                return (React.createElement("div", { className: "logs__row o-hidden" },
                    React.createElement("div", { className: "logs__text" }, title)));
            },
        },
        {
            Header: t('blocked_services'),
            accessor: 'blocked_services',
            minWidth: 180,
            Cell: (row) => {
                const { value, original } = row;
                if (original.use_global_blocked_services) {
                    return React.createElement(Trans, null, "settings_global");
                }
                if (value && services.allServices) {
                    return (React.createElement("div", { className: "logs__row logs__row--icons" }, value.map((service) => {
                        const serviceInfo = getService(services.allServices, service);
                        if (serviceInfo?.icon_svg) {
                            return (React.createElement("div", { key: serviceInfo.name, dangerouslySetInnerHTML: {
                                    __html: window.atob(serviceInfo.icon_svg),
                                }, className: "service__icon service__icon--table", title: serviceInfo.name }));
                        }
                        return null;
                    })));
                }
                return React.createElement("div", { className: "logs__row logs__row--icons" }, "\u2013");
            },
        },
        {
            Header: t('upstreams'),
            accessor: 'upstreams',
            minWidth: 120,
            Cell: ({ value }) => {
                const title = value && value.length > 0 ? React.createElement(Trans, null, "settings_custom") : React.createElement(Trans, null, "settings_global");
                return (React.createElement("div", { className: "logs__row o-hidden" },
                    React.createElement("div", { className: "logs__text" }, title)));
            },
        },
        {
            Header: t('tags_title'),
            accessor: 'tags',
            minWidth: 140,
            Cell: (row) => {
                const { value } = row;
                if (!value || value.length < 1) {
                    return '–';
                }
                return (React.createElement("div", { className: "logs__row o-hidden" },
                    React.createElement("span", { className: "logs__text" }, value.map((tag) => (React.createElement("div", { key: tag, title: tag, className: "logs__tag small" }, tag))))));
            },
        },
        {
            Header: t('requests_count'),
            id: 'statistics',
            accessor: (row) => countClientsStatistics(row.ids, normalizedTopClients.auto),
            sortMethod: (a, b) => b - a,
            minWidth: 120,
            Cell: (row) => {
                let content = row.value;
                if (typeof content === "number") {
                    content = formatNumber(content);
                }
                else {
                    content = CellWrap(row);
                }
                if (!content) {
                    return content;
                }
                return React.createElement(LogsSearchLink, { search: row.original.name }, content);
            },
        },
        {
            Header: t('actions_table_header'),
            accessor: 'actions',
            maxWidth: 100,
            sortable: false,
            resizable: false,
            Cell: (row) => {
                const clientName = row.original.name;
                return (React.createElement("div", { className: "logs__row logs__row--center" },
                    React.createElement("button", { type: "button", className: "btn btn-icon btn-outline-primary btn-sm mr-2", onClick: () => toggleClientModal({
                            type: MODAL_TYPE.EDIT_CLIENT,
                            name: clientName,
                        }), disabled: processingUpdating, title: t('edit_table_action') },
                        React.createElement("svg", { className: "icons icon12" },
                            React.createElement("use", { xlinkHref: "#edit" }))),
                    React.createElement("button", { type: "button", className: "btn btn-icon btn-outline-secondary btn-sm", onClick: () => handleDelete({ name: clientName }), disabled: processingDeleting, title: t('delete_table_action') },
                        React.createElement("svg", { className: "icons icon12" },
                            React.createElement("use", { xlinkHref: "#delete" })))));
            },
        },
    ];
    const currentClientData = getClient(modalClientName, clients);
    const tagsOptions = getOptionsWithLabels(supportedTags);
    return (React.createElement(Card, { title: t('clients_title'), subtitle: t('clients_desc'), bodyType: "card-body box-body--settings" },
        React.createElement(React.Fragment, null,
            React.createElement(ReactTable, { data: clients || [], columns: columns, defaultSorted: [
                    {
                        id: 'statistics',
                        asc: true,
                    },
                ], className: "-striped -highlight card-table-overflow", showPagination: true, defaultPageSize: LocalStorageHelper.getItem(LOCAL_STORAGE_KEYS.CLIENTS_PAGE_SIZE) || 10, onPageSizeChange: (size) => LocalStorageHelper.setItem(LOCAL_STORAGE_KEYS.CLIENTS_PAGE_SIZE, size), minRows: TABLES_MIN_ROWS, ofText: "/", previousText: t('previous_btn'), nextText: t('next_btn'), pageText: t('page_table_footer_text'), rowsText: t('rows_table_footer_text'), loadingText: t('loading_table_status'), noDataText: t('clients_not_found') }),
            React.createElement("button", { type: "button", className: "btn btn-success btn-standard mt-3", onClick: () => toggleClientModal(MODAL_TYPE.ADD_FILTERS), disabled: processingAdding },
                React.createElement(Trans, null, "client_add")),
            React.createElement(Modal, { isModalOpen: isModalOpen, modalType: modalType, handleClose: handleClose, currentClientData: currentClientData, handleSubmit: handleSubmit, processingAdding: processingAdding, processingUpdating: processingUpdating, tagsOptions: tagsOptions, clientId: clientId }))));
};
export default ClientsTable;

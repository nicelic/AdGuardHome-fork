import React, { memo } from 'react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { captitalizeWords, checkFiltered, getRulesToFilterList, formatDateTime, formatClientProtocol, formatElapsedMs, formatTime, getBlockingClientName, getServiceName, processContent, } from '../../../helpers/helpers';
import { BLOCK_ACTIONS, DEFAULT_SHORT_DATE_FORMAT_OPTIONS, FILTERED_STATUS, FILTERED_STATUS_TO_META_MAP, LONG_TIME_FORMAT, QUERY_STATUS_COLORS, } from '../../../helpers/constants';
import { getSourceData } from '../../../helpers/trackers/trackers';
import { toggleBlocking, toggleBlockingForClient } from '../../../actions';
import DateCell from './DateCell';
import DomainCell from './DomainCell';
import ResponseCell from './ResponseCell';
import ClientCell from './ClientCell';
import { toggleClientBlock } from '../../../actions/access';
import { getBlockClientInfo, BUTTON_PREFIX } from './helpers';
import { updateLogs } from '../../../actions/queryLogs';
import '../Logs.css';
const Row = memo(({ style, rowProps, rowProps: { reason }, isSmallScreen, setDetailedDataCurrent, setButtonType, setModalOpened, }) => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const dnssec_enabled = useSelector((state) => state.dnsConfig.dnssec_enabled);
    const filters = useSelector((state) => state.filtering.filters, shallowEqual);
    const whitelistFilters = useSelector((state) => state.filtering.whitelistFilters, shallowEqual);
    const autoClients = useSelector((state) => state.dashboard.autoClients, shallowEqual);
    const processingSet = useSelector((state) => state.access.processingSet);
    const allowedClients = useSelector((state) => state.access.allowed_clients, shallowEqual);
    const services = useSelector((state) => state?.services);
    const clients = useSelector((state) => state.dashboard.clients);
    const onClick = () => {
        if (!isSmallScreen) {
            return;
        }
            const { answer_dnssec, client, domain, elapsedMs, client_info, response, time, tracker, upstream, type, client_proto, client_transport, client_id, rules, originalResponse, status, service_name, cached, } = rowProps;
        const hasTracker = !!tracker;
        const autoClient = autoClients.find((autoClient) => autoClient.name === client);
        const source = autoClient?.source;
        const formattedElapsedMs = formatElapsedMs(elapsedMs, t);
        const isFiltered = checkFiltered(reason);
        const isBlocked = reason === FILTERED_STATUS.FILTERED_BLACK_LIST || reason === FILTERED_STATUS.FILTERED_BLOCKED_SERVICE;
        const buttonType = isFiltered ? BLOCK_ACTIONS.UNBLOCK : BLOCK_ACTIONS.BLOCK;
        const onToggleBlock = () => {
            dispatch(toggleBlocking(buttonType, domain));
        };
        const isBlockedByResponse = originalResponse.length > 0 && isBlocked;
        const requestStatus = t(isBlockedByResponse ? 'blocked_by_cname_or_ip' : FILTERED_STATUS_TO_META_MAP[reason]?.LABEL || reason);
            const protocol = formatClientProtocol(client_proto, client_transport, t);
        const sourceData = getSourceData(tracker);
        const { confirmMessage, buttonKey: blockingClientKey, lastRuleInAllowlist, } = getBlockClientInfo(client, client_info?.disallowed || false, client_info?.disallowed_rule || '', allowedClients);
        const blockingForClientKey = isFiltered ? 'unblock_for_this_client_only' : 'block_for_this_client_only';
        const clientNameBlockingFor = getBlockingClientName(clients, client);
        const onBlockingForClientClick = () => {
            dispatch(toggleBlockingForClient(buttonType, domain, clientNameBlockingFor));
        };
        const onBlockingClientClick = async () => {
            if (window.confirm(confirmMessage)) {
                await dispatch(toggleClientBlock(client, client_info?.disallowed || false, client_info?.disallowed_rule || ''));
                await dispatch(updateLogs());
                setModalOpened(false);
            }
        };
        const blockButton = (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "title--border" }),
            React.createElement("button", { type: "button", className: classNames('button-action--arrow-option mb-1', { 'bg--danger': !isBlocked }, { 'bg--green': isFiltered }), onClick: onToggleBlock }, t(buttonType))));
        const blockForClientButton = (React.createElement("button", { className: "text-center font-weight-bold py-1 button-action--arrow-option", onClick: onBlockingForClientClick }, t(blockingForClientKey)));
        const blockClientButton = (React.createElement("button", { className: "text-center font-weight-bold py-1 button-action--arrow-option", onClick: onBlockingClientClick, disabled: processingSet || lastRuleInAllowlist }, t(blockingClientKey)));
        const detailedData = {
            time_table_header: formatTime(time, LONG_TIME_FORMAT),
            date: formatDateTime(time, DEFAULT_SHORT_DATE_FORMAT_OPTIONS),
            encryption_status: isBlocked ? React.createElement("div", { className: "bg--danger" }, requestStatus) : requestStatus,
            ...(FILTERED_STATUS.FILTERED_BLOCKED_SERVICE &&
                service_name &&
                services.allServices && { service_name: getServiceName(services.allServices, service_name) }),
            domain,
            type_table_header: type,
            protocol,
            known_tracker: hasTracker && 'title',
            table_name: tracker?.name,
            category_label: hasTracker && captitalizeWords(tracker.category),
            tracker_source: hasTracker && sourceData && (React.createElement("a", { href: sourceData.url, target: "_blank", rel: "noopener noreferrer", className: "link--green" }, sourceData.name)),
            response_details: 'title',
            install_settings_dns: upstream,
            ...(cached && {
                served_from_cache_label: (React.createElement("svg", { className: "icons icon--20 icon--green" },
                    React.createElement("use", { xlinkHref: "#check" }))),
            }),
            elapsed: formattedElapsedMs,
            ...(rules.length > 0 && { rule_label: getRulesToFilterList(rules, filters, whitelistFilters) }),
            response_table_header: response?.join('\n'),
            response_code: status,
            client_details: 'title',
            ip_address: client,
            name: client_info?.name || client_id,
            country: client_info?.whois?.country,
            city: client_info?.whois?.city,
            network: client_info?.whois?.orgname,
            source_label: source,
            validated_with_dnssec: dnssec_enabled ? Boolean(answer_dnssec) : false,
            original_response: originalResponse?.join('\n'),
            [BUTTON_PREFIX + buttonType]: blockButton,
            [BUTTON_PREFIX + blockingForClientKey]: blockForClientButton,
            [BUTTON_PREFIX + blockingClientKey]: blockClientButton,
        };
        setDetailedDataCurrent(processContent(detailedData));
        setButtonType(buttonType);
        setModalOpened(true);
    };
    const isDetailed = useSelector((state) => state.queryLogs.isDetailed);
    const className = classNames('d-flex px-5 logs__row', `logs__row--${FILTERED_STATUS_TO_META_MAP?.[reason]?.COLOR ?? QUERY_STATUS_COLORS.WHITE}`, {
        'logs__cell--detailed': isDetailed,
    });
    return (React.createElement("div", { style: style, className: className, onClick: onClick, role: "row", "data-testid": "querylog_cell" },
        React.createElement(DateCell, { ...rowProps }),
        React.createElement(DomainCell, { ...rowProps }),
        React.createElement(ResponseCell, { ...rowProps }),
        React.createElement(ClientCell, { ...rowProps })));
});
Row.displayName = 'Row';
export default Row;

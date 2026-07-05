import React, { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import throttle from 'lodash/throttle';
import Loading from '../ui/Loading';
import Header from './Cells/Header';
import { getLogs } from '../../actions/queryLogs';
import Row from './Cells';
import { isScrolledIntoView } from '../../helpers/helpers';
import { QUERY_LOGS_PAGE_LIMIT } from '../../helpers/constants';
const InfiniteTable = ({ isLoading, items, isSmallScreen, currentQuery, setDetailedDataCurrent, setButtonType, setModalOpened, }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const loader = useRef(null);
    const loadingRef = useRef(null);
    const isEntireLog = useSelector((state) => state.queryLogs.isEntireLog);
    const processingGetLogs = useSelector((state) => state.queryLogs.processingGetLogs);
    const loading = isLoading || processingGetLogs;
    const listener = useCallback(() => {
        if (!loadingRef.current && loader.current && isScrolledIntoView(loader.current)) {
            dispatch(getLogs(currentQuery));
        }
    }, []);
    useEffect(() => {
        loadingRef.current = processingGetLogs;
    }, [processingGetLogs]);
    useEffect(() => {
        listener();
    }, [items.length < QUERY_LOGS_PAGE_LIMIT, isEntireLog]);
    useEffect(() => {
        const THROTTLE_TIME = 100;
        const throttledListener = throttle(listener, THROTTLE_TIME);
        window.addEventListener('scroll', throttledListener);
        return () => {
            window.removeEventListener('scroll', throttledListener);
        };
    }, []);
    const renderRow = (row, idx) => (React.createElement(Row, { key: idx, rowProps: row, isSmallScreen: isSmallScreen, setDetailedDataCurrent: setDetailedDataCurrent, setButtonType: setButtonType, setModalOpened: setModalOpened }));
    const isNothingFound = items.length === 0 && !processingGetLogs;
    return (React.createElement("div", { className: "logs__table", role: "grid" },
        loading && React.createElement(Loading, null),
        React.createElement(Header, null),
        isNothingFound ? (React.createElement("label", { className: "logs__no-data" }, t('nothing_found'))) : (React.createElement(React.Fragment, null,
            items.map(renderRow),
            !isEntireLog && (React.createElement("div", { ref: loader, className: "logs__loading text-center" }, t('loading_table_status')))))));
};
export default InfiniteTable;

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { Form } from './Form';
import { refreshFilteredLogs } from '../../../actions/queryLogs';
import { addSuccessToast } from '../../../actions/toasts';
const Filters = ({ setIsLoading }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const refreshLogs = async () => {
        setIsLoading(true);
        await dispatch(refreshFilteredLogs());
        dispatch(addSuccessToast('query_log_updated'));
        setIsLoading(false);
    };
    return (React.createElement("div", { className: "page-header page-header--logs" },
        React.createElement("h1", { className: "page-title page-title--large" },
            t('query_log'),
            React.createElement("button", { type: "button", className: "btn btn-icon--green logs__refresh", title: t('refresh_btn'), onClick: refreshLogs },
                React.createElement("svg", { className: "icons icon--24" },
                    React.createElement("use", { xlinkHref: "#update" })))),
        React.createElement(Form, { setIsLoading: setIsLoading })));
};
export default Filters;

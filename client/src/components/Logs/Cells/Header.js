import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import classNames from 'classnames';
import React from 'react';
import { toggleDetailedLogs } from '../../../actions/queryLogs';
import HeaderCell from './HeaderCell';
const Header = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const isDetailed = useSelector((state) => state.queryLogs.isDetailed);
    const disableDetailedMode = () => dispatch(toggleDetailedLogs(false));
    const enableDetailedMode = () => dispatch(toggleDetailedLogs(true));
    const HEADERS = [
        {
            className: 'logs__cell--date',
            content: 'time_table_header',
        },
        {
            className: 'logs__cell--domain',
            content: 'request_table_header',
        },
        {
            className: 'logs__cell--response',
            content: 'response_table_header',
        },
        {
            className: 'logs__cell--client',
            content: (React.createElement(React.Fragment, null,
                t('client_table_header'),
                React.createElement("span", null,
                    React.createElement("svg", { className: classNames('icons icon--24 icon--green cursor--pointer mr-2', {
                            'icon--selected': !isDetailed,
                        }), onClick: disableDetailedMode },
                        React.createElement("title", null, t('compact')),
                        React.createElement("use", { xlinkHref: "#list" })),
                    React.createElement("svg", { className: classNames('icons icon--24 icon--green cursor--pointer', {
                            'icon--selected': isDetailed,
                        }), onClick: enableDetailedMode },
                        React.createElement("title", null, t('default')),
                        React.createElement("use", { xlinkHref: "#detailed_list" }))))),
        },
    ];
    return (React.createElement("div", { className: "logs__cell--header__container px-5", role: "row" }, HEADERS.map(HeaderCell)));
};
export default Header;

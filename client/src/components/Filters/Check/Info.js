import React from 'react';
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';
import i18next from 'i18next';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { checkFiltered, checkRewrite, checkRewriteHosts, checkWhiteList, checkSafeSearch, checkSafeBrowsing, checkParental, getRulesToFilterList, } from '../../../helpers/helpers';
import { BLOCK_ACTIONS, FILTERED, FILTERED_STATUS } from '../../../helpers/constants';
import { toggleBlocking } from '../../../actions';
const renderBlockingButton = (isFiltered, domain) => {
    const processingRules = useSelector((state) => state.filtering.processingRules);
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const buttonType = isFiltered ? BLOCK_ACTIONS.UNBLOCK : BLOCK_ACTIONS.BLOCK;
    const onClick = async () => {
        await dispatch(toggleBlocking(buttonType, domain));
    };
    const buttonClass = classNames('mt-3 button-action button-action--main button-action--active button-action--small', {
        'button-action--unblock': isFiltered,
    });
    return (React.createElement("button", { type: "button", className: buttonClass, onClick: onClick, disabled: processingRules }, t(buttonType)));
};
const getTitle = () => {
    const { t } = useTranslation();
    const filters = useSelector((state) => state.filtering.filters, shallowEqual);
    const whitelistFilters = useSelector((state) => state.filtering.whitelistFilters, shallowEqual);
    const rules = useSelector((state) => state.filtering.check.rules, shallowEqual);
    const reason = useSelector((state) => state.filtering.check.reason);
    const getReasonFiltered = (reason) => {
        const filterKey = reason.replace(FILTERED, '');
        return i18next.t('query_log_filtered', { filter: filterKey });
    };
    const ruleAndFilterNames = getRulesToFilterList(rules, filters, whitelistFilters);
    const REASON_TO_TITLE_MAP = {
        [FILTERED_STATUS.NOT_FILTERED_NOT_FOUND]: t('check_not_found'),
        [FILTERED_STATUS.REWRITE]: t('rewrite_applied'),
        [FILTERED_STATUS.REWRITE_HOSTS]: t('rewrite_hosts_applied'),
        [FILTERED_STATUS.FILTERED_BLACK_LIST]: ruleAndFilterNames,
        [FILTERED_STATUS.NOT_FILTERED_WHITE_LIST]: ruleAndFilterNames,
        [FILTERED_STATUS.FILTERED_SAFE_SEARCH]: getReasonFiltered(reason),
        [FILTERED_STATUS.FILTERED_SAFE_BROWSING]: getReasonFiltered(reason),
        [FILTERED_STATUS.FILTERED_PARENTAL]: getReasonFiltered(reason),
    };
    if (Object.prototype.hasOwnProperty.call(REASON_TO_TITLE_MAP, reason)) {
        return REASON_TO_TITLE_MAP[reason];
    }
    return (React.createElement(React.Fragment, null,
        React.createElement("div", null, t('check_reason', { reason })),
        React.createElement("div", null,
            t('rule_label'),
            ": \u00A0",
            ruleAndFilterNames)));
};
const Info = () => {
    const { hostname, reason, service_name, cname, ip_addrs } = useSelector((state) => state.filtering.check, shallowEqual);
    const { t } = useTranslation();
    const title = getTitle();
    const className = classNames('card mb-0 p-3', {
        'logs__row--red': checkFiltered(reason),
        'logs__row--blue': checkRewrite(reason) || checkRewriteHosts(reason),
        'logs__row--green': checkWhiteList(reason),
    });
    const onlyFiltered = checkSafeSearch(reason) || checkSafeBrowsing(reason) || checkParental(reason);
    const isFiltered = checkFiltered(reason);
    return (React.createElement("div", { className: className },
        React.createElement("div", null,
            React.createElement("strong", null, hostname)),
        React.createElement("div", null, title),
        !onlyFiltered && (React.createElement(React.Fragment, null,
            service_name && React.createElement("div", null, t('check_service', { service: service_name })),
            cname && React.createElement("div", null, t('check_cname', { cname })),
            ip_addrs && React.createElement("div", null, t('check_ip', { ip: ip_addrs.join(', ') })),
            renderBlockingButton(isFiltered, hostname)))));
};
export default Info;

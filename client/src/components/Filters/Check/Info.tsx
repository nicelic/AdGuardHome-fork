import React from 'react';
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';

import i18next from 'i18next';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import {
    checkFiltered,
    checkRewrite,
    checkRewriteHosts,
    checkWhiteList,
    checkSafeSearch,
    checkSafeBrowsing,
    checkParental,
    getRulesToFilterList,
} from '../../../helpers/helpers';
import { BLOCK_ACTIONS, FILTERED, FILTERED_STATUS } from '../../../helpers/constants';

import { toggleBlocking } from '../../../actions';
import type { RootState } from '../../../initialState';

const Info = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const { filters, whitelistFilters, processingRules, check } = useSelector(
        (state: RootState) => state.filtering,
        shallowEqual,
    );
    const {
        hostname,
        reason,
        service_name,
        cname,
        cnames,
        ip_addrs,
        rules = [],
    } = check;

    let displayCNames: string[] = [];
    if (Array.isArray(cnames) && cnames.length > 0) {
        displayCNames = cnames;
    } else if (cname) {
        displayCNames = [cname];
    }

    const className = classNames('card mb-0 p-3', {
        'logs__row--red': checkFiltered(reason),
        'logs__row--blue': checkRewrite(reason) || checkRewriteHosts(reason),
        'logs__row--green': checkWhiteList(reason),
    });

    const onlyFiltered = checkSafeSearch(reason) || checkSafeBrowsing(reason) || checkParental(reason);

    const isFiltered = checkFiltered(reason);
    const buttonType = isFiltered ? BLOCK_ACTIONS.UNBLOCK : BLOCK_ACTIONS.BLOCK;
    const buttonClass = classNames(
        'mt-3 button-action button-action--main button-action--active button-action--small',
        {
            'button-action--unblock': isFiltered,
        },
    );
    const getReasonFiltered = (currentReason: string) => {
        const filterKey = currentReason.replace(FILTERED, '');
        return i18next.t('query_log_filtered', { filter: filterKey });
    };
    const ruleAndFilterNames = getRulesToFilterList(rules, filters, whitelistFilters);
    const reasonToTitleMap = {
        [FILTERED_STATUS.NOT_FILTERED_NOT_FOUND]: t('check_not_found'),
        [FILTERED_STATUS.REWRITE]: t('rewrite_applied'),
        [FILTERED_STATUS.REWRITE_HOSTS]: t('rewrite_hosts_applied'),
        [FILTERED_STATUS.FILTERED_BLACK_LIST]: ruleAndFilterNames,
        [FILTERED_STATUS.NOT_FILTERED_WHITE_LIST]: ruleAndFilterNames,
        [FILTERED_STATUS.FILTERED_SAFE_SEARCH]: getReasonFiltered(reason),
        [FILTERED_STATUS.FILTERED_SAFE_BROWSING]: getReasonFiltered(reason),
        [FILTERED_STATUS.FILTERED_PARENTAL]: getReasonFiltered(reason),
    };
    const title = Object.prototype.hasOwnProperty.call(reasonToTitleMap, reason)
        ? reasonToTitleMap[reason]
        : (
            <>
                <div>{t('check_reason', { reason })}</div>

                <div>
                    {t('rule_label')}: &nbsp;
                    {ruleAndFilterNames}
                </div>
            </>
        );

    const onToggleBlocking = async () => {
        await dispatch(toggleBlocking(buttonType, hostname));
    };

    return (
        <div className={className}>
            <div>
                <strong>{hostname}</strong>
            </div>

            <div>{title}</div>
            {!onlyFiltered && (
                <>
                    {service_name && <div>{t('check_service', { service: service_name })}</div>}

                    {displayCNames.length > 0 && <div>{t('check_cname', { cname: displayCNames.join(', ') })}</div>}

                    {ip_addrs && <div>{t('check_ip', { ip: ip_addrs.join(', ') })}</div>}
                    <button
                        type="button"
                        className={buttonClass}
                        onClick={onToggleBlocking}
                        disabled={processingRules}
                    >
                        {t(buttonType)}
                    </button>
                </>
            )}
        </div>
    );
};

export default Info;

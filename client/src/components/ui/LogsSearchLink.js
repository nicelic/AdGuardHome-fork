import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getLogsUrlParams } from '../../helpers/helpers';
import { MENU_URLS } from '../../helpers/constants';
const LogsSearchLink = ({ search = '', response_status = '', children, link = MENU_URLS.logs, }) => {
    const { t } = useTranslation();
    const to = link === MENU_URLS.logs
        ? `${MENU_URLS.logs}${getLogsUrlParams(search && `"${search}"`, response_status)}`
        : link;
    return (React.createElement(Link, { to: to, tabIndex: 0, title: t('click_to_view_queries'), "aria-label": t('click_to_view_queries') }, children));
};
export default LogsSearchLink;

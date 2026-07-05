import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import Upstream from './Upstream';
import Access from './Access';
import Config from './Config';
import PageTitle from '../../ui/PageTitle';
import Loading from '../../ui/Loading';
import CacheConfig from './Cache';
import { getDnsConfig } from '../../../actions/dnsConfig';
import { getAccessList } from '../../../actions/access';
const Dns = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const processing = useSelector((state) => state.access.processing);
    const processingGetConfig = useSelector((state) => state.dnsConfig.processingGetConfig);
    const isDataLoading = processing || processingGetConfig;
    useEffect(() => {
        dispatch(getAccessList());
        dispatch(getDnsConfig());
    }, []);
    return (React.createElement(React.Fragment, null,
        React.createElement(PageTitle, { title: t('dns_settings') }),
        isDataLoading ? (React.createElement(Loading, null)) : (React.createElement(React.Fragment, null,
            React.createElement(Upstream, null),
            React.createElement(Config, null),
            React.createElement(CacheConfig, null),
            React.createElement(Access, null)))));
};
export default Dns;

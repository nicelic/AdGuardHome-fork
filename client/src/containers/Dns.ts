import { connect } from 'react-redux';
import { getAccessList, setAccessList } from '../actions/access';
import { getDnsConfig, setDnsConfig } from '../actions/dnsConfig';

import Dns from '../components/Settings/Dns';

const mapStateToProps = (state: any) => {
    const { dashboard, settings, access, dnsConfig } = state;
    const props = {
        dashboard,
        settings,
        access,
        dnsConfig,
    };
    return props;
};

const mapDispatchToProps = {
    getAccessList,
    setAccessList,
    getDnsConfig,
    setDnsConfig,
};

export default connect(mapStateToProps, mapDispatchToProps)(Dns);

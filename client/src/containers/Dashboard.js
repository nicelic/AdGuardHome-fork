import { connect } from 'react-redux';
import { toggleProtection, getClients } from '../actions';
import { getStats, getStatsConfig } from '../actions/stats';
import { getAccessList } from '../actions/access';
import Dashboard from '../components/Dashboard';
const mapStateToProps = (state) => {
    const { dashboard, stats, access } = state;
    const props = { dashboard, stats, access };
    return props;
};
const mapDispatchToProps = {
    toggleProtection,
    getClients,
    getStats,
    getStatsConfig,
    getAccessList,
};
export default connect(mapStateToProps, mapDispatchToProps)(Dashboard);

import { connect } from 'react-redux';

import CertificateManager from '../components/CertificateManager';

const mapStateToProps = (state: any) => {
    const { dashboard, encryption } = state;

    return {
        dashboard,
        encryption,
    };
};

export default connect(mapStateToProps)(CertificateManager);

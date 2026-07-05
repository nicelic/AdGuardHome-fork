import { connect } from 'react-redux';
import {
    getRewriteText,
    handleRewriteRulesChange,
    updateRewriteText,
    updateRewriteSettings,
    getRewriteSettings,
} from '../actions/rewrites';

import Rewrites from '../components/Filters/Rewrites';
import { RootState } from '../initialState';

const mapStateToProps = (state: RootState) => {
    const { rewrites } = state;
    const props = { rewrites };
    return props;
};

type DispatchProps = {
    getRewriteText: () => (dispatch: any) => void;
    handleRewriteRulesChange: (...args: unknown[]) => unknown;
    updateRewriteText: (...args: unknown[]) => unknown;
    updateRewriteSettings: (...args: unknown[]) => unknown;
    getRewriteSettings: () => (dispatch: any) => void;
}

const mapDispatchToProps: DispatchProps = {
    getRewriteText,
    handleRewriteRulesChange,
    updateRewriteText,
    updateRewriteSettings,
    getRewriteSettings,
};

export default connect(mapStateToProps, mapDispatchToProps)(Rewrites);

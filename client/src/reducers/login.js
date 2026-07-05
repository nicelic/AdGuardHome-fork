import { combineReducers } from 'redux';
import { handleActions } from 'redux-actions';
import * as actions from '../actions/login';
import toasts from './toasts';
const login = handleActions({
    [actions.processLoginRequest.toString()]: (state) => ({
        ...state,
        processingLogin: true,
    }),
    [actions.processLoginFailure.toString()]: (state) => ({
        ...state,
        processingLogin: false,
    }),
    [actions.processLoginSuccess.toString()]: (state, { payload }) => ({
        ...state,
        ...payload,
        processingLogin: false,
    }),
}, {
    processingLogin: false,
    email: '',
    password: '',
});
export default combineReducers({
    login,
    toasts,
});

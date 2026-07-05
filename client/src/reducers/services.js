import { handleActions } from 'redux-actions';
import * as actions from '../actions/services';
const services = handleActions({
    [actions.getBlockedServicesRequest.toString()]: (state) => ({
        ...state,
        processing: true,
    }),
    [actions.getBlockedServicesFailure.toString()]: (state) => ({
        ...state,
        processing: false,
    }),
    [actions.getBlockedServicesSuccess.toString()]: (state, { payload }) => ({
        ...state,
        list: payload,
        processing: false,
    }),
    [actions.getAllBlockedServicesRequest.toString()]: (state) => ({
        ...state,
        processingAll: true,
    }),
    [actions.getAllBlockedServicesFailure.toString()]: (state) => ({
        ...state,
        processingAll: false,
    }),
    [actions.getAllBlockedServicesSuccess.toString()]: (state, { payload }) => ({
        ...state,
        allServices: payload.blocked_services,
        allGroups: payload.groups,
        processingAll: false,
    }),
    [actions.updateBlockedServicesRequest.toString()]: (state) => ({
        ...state,
        processingSet: true,
    }),
    [actions.updateBlockedServicesFailure.toString()]: (state) => ({
        ...state,
        processingSet: false,
    }),
    [actions.updateBlockedServicesSuccess.toString()]: (state) => ({
        ...state,
        processingSet: false,
    }),
}, {
    processing: true,
    processingAll: true,
    processingSet: false,
    list: {},
    allServices: [],
    allGroups: [],
});
export default services;

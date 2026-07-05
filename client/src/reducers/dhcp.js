import { handleActions } from 'redux-actions';
import * as actions from '../actions';
import { enrichWithConcatenatedIpAddresses } from '../helpers/helpers';
const dhcp = handleActions({
    [actions.getDhcpStatusRequest.toString()]: (state) => ({
        ...state,
        processing: true,
    }),
    [actions.getDhcpStatusFailure.toString()]: (state) => ({
        ...state,
        processing: false,
    }),
    [actions.getDhcpStatusSuccess.toString()]: (state, { payload }) => {
        const { static_leases: staticLeases, ...values } = payload;
        const newState = {
            ...state,
            staticLeases,
            processing: false,
            ...values,
        };
        return newState;
    },
    [actions.getDhcpInterfacesRequest.toString()]: (state) => ({
        ...state,
        processingInterfaces: true,
    }),
    [actions.getDhcpInterfacesFailure.toString()]: (state) => ({
        ...state,
        processingInterfaces: false,
    }),
    [actions.getDhcpInterfacesSuccess.toString()]: (state, { payload }) => {
        const newState = {
            ...state,
            interfaces: enrichWithConcatenatedIpAddresses(payload),
            processingInterfaces: false,
        };
        return newState;
    },
    [actions.findActiveDhcpRequest.toString()]: (state) => ({
        ...state,
        processingStatus: true,
    }),
    [actions.findActiveDhcpFailure.toString()]: (state) => ({
        ...state,
        processingStatus: false,
    }),
    [actions.findActiveDhcpSuccess.toString()]: (state, { payload }) => {
        const newState = {
            ...state,
            check: payload,
            processingStatus: false,
        };
        return newState;
    },
    [actions.toggleDhcpRequest.toString()]: (state) => ({
        ...state,
        processingDhcp: true,
    }),
    [actions.toggleDhcpFailure.toString()]: (state) => ({
        ...state,
        processingDhcp: false,
    }),
    [actions.toggleDhcpSuccess.toString()]: (state) => {
        const { enabled } = state;
        const newState = {
            ...state,
            enabled: !enabled,
            check: null,
            processingDhcp: false,
        };
        return newState;
    },
    [actions.setDhcpConfigRequest.toString()]: (state) => ({
        ...state,
        processingConfig: true,
    }),
    [actions.setDhcpConfigFailure.toString()]: (state) => ({
        ...state,
        processingConfig: false,
    }),
    [actions.setDhcpConfigSuccess.toString()]: (state, { payload }) => {
        const { v4, v6 } = state;
        const newConfigV4 = { ...v4, ...payload.v4 };
        const newConfigV6 = { ...v6, ...payload.v6 };
        const newState = {
            ...state,
            v4: newConfigV4,
            v6: newConfigV6,
            interface_name: payload.interface_name,
            processingConfig: false,
        };
        return newState;
    },
    [actions.resetDhcpRequest.toString()]: (state) => ({
        ...state,
        processingReset: true,
    }),
    [actions.resetDhcpFailure.toString()]: (state) => ({
        ...state,
        processingReset: false,
    }),
    [actions.resetDhcpSuccess.toString()]: (state) => ({
        ...state,
        processingReset: false,
        enabled: false,
        v4: {},
        v6: {},
        interface_name: '',
    }),
    [actions.resetDhcpLeasesSuccess.toString()]: (state) => ({
        ...state,
        leases: [],
        staticLeases: [],
    }),
    [actions.toggleLeaseModal.toString()]: (state, { payload }) => {
        const newState = {
            ...state,
            isModalOpen: !state.isModalOpen,
            modalType: payload?.type || '',
            leaseModalConfig: payload?.config,
        };
        return newState;
    },
    [actions.addStaticLeaseRequest.toString()]: (state) => ({
        ...state,
        processingAdding: true,
    }),
    [actions.addStaticLeaseFailure.toString()]: (state) => ({
        ...state,
        processingAdding: false,
    }),
    [actions.addStaticLeaseSuccess.toString()]: (state, { payload }) => {
        const { ip, mac, hostname } = payload;
        const newLease = {
            ip,
            mac,
            hostname: hostname || '',
        };
        const leases = [...state.staticLeases, newLease];
        const newState = {
            ...state,
            staticLeases: leases,
            processingAdding: false,
        };
        return newState;
    },
    [actions.removeStaticLeaseRequest.toString()]: (state) => ({
        ...state,
        processingDeleting: true,
    }),
    [actions.removeStaticLeaseFailure.toString()]: (state) => ({
        ...state,
        processingDeleting: false,
    }),
    [actions.removeStaticLeaseSuccess.toString()]: (state, { payload }) => {
        const leaseToRemove = payload.ip;
        const leases = state.staticLeases.filter((item) => item.ip !== leaseToRemove);
        const newState = {
            ...state,
            staticLeases: leases,
            processingDeleting: false,
        };
        return newState;
    },
    [actions.updateStaticLeaseRequest.toString()]: (state) => ({
        ...state,
        processingUpdating: true,
    }),
    [actions.updateStaticLeaseFailure.toString()]: (state) => ({
        ...state,
        processingUpdating: false,
    }),
    [actions.updateStaticLeaseSuccess.toString()]: (state) => {
        const newState = {
            ...state,
            processingUpdating: false,
        };
        return newState;
    },
}, {
    processing: true,
    processingStatus: false,
    processingInterfaces: false,
    processingDhcp: false,
    processingConfig: false,
    processingAdding: false,
    processingDeleting: false,
    processingUpdating: false,
    enabled: false,
    interface_name: '',
    check: null,
    v4: {
        gateway_ip: '',
        subnet_mask: '',
        range_start: '',
        range_end: '',
        lease_duration: 0,
    },
    v6: {
        range_start: '',
        lease_duration: 0,
    },
    leases: [],
    staticLeases: [],
    isModalOpen: false,
    leaseModalConfig: undefined,
    modalType: '',
    dhcp_available: false,
});
export default dhcp;

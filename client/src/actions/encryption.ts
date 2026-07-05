import { createAction } from 'redux-actions';
import apiClient from '../api/Api';

import { redirectToCurrentProtocol } from '../helpers/helpers';
import { addErrorToast, addSuccessToast } from './toasts';

const decodeTLSResponse = (payload: any) => ({
    ...payload,
    certificate_chain: atob(payload.certificate_chain || ''),
    private_key: atob(payload.private_key || ''),
    panel_certificate_chain: atob(payload.panel_certificate_chain || ''),
    panel_private_key: atob(payload.panel_private_key || ''),
});

const encodeTLSRequest = (config: any) => {
    const values = { ...config };

    values.certificate_chain = btoa(values.certificate_chain || '');
    values.private_key = btoa(values.private_key || '');
    values.panel_certificate_chain = btoa(values.panel_certificate_chain || '');
    values.panel_private_key = btoa(values.panel_private_key || '');
    values.panel_server_port = values.panel_server_port || 0;
    values.port_https = values.port_https || 0;
    values.port_dns_over_tls = values.port_dns_over_tls || 0;
    values.port_dns_over_quic = values.port_dns_over_quic || 0;

    return values;
};

export const getTlsStatusRequest = createAction('GET_TLS_STATUS_REQUEST');
export const getTlsStatusFailure = createAction('GET_TLS_STATUS_FAILURE');
export const getTlsStatusSuccess = createAction('GET_TLS_STATUS_SUCCESS');

export const getTlsStatus = () => async (dispatch: any) => {
    dispatch(getTlsStatusRequest());
    try {
        const status = await apiClient.getTlsStatus();
        dispatch(getTlsStatusSuccess(decodeTLSResponse(status)));
    } catch (error) {
        dispatch(addErrorToast({ error }));
        dispatch(getTlsStatusFailure());
    }
};

export const setTlsConfigRequest = createAction('SET_TLS_CONFIG_REQUEST');
export const setTlsConfigFailure = createAction('SET_TLS_CONFIG_FAILURE');
export const setTlsConfigSuccess = createAction('SET_TLS_CONFIG_SUCCESS');
export const dnsStatusSuccess = createAction('DNS_STATUS_SUCCESS');

export const setTlsConfig = (config: any) => async (dispatch: any, getState: any) => {
    dispatch(setTlsConfigRequest());
    try {
        const { httpPort } = getState().dashboard;
        const values = encodeTLSRequest(config);

        const response = await apiClient.setTlsConfig(values);
        const decodedResponse = decodeTLSResponse(response);

        redirectToCurrentProtocol(decodedResponse, httpPort);

        const dnsStatus = await apiClient.getGlobalStatus();
        if (dnsStatus) {
            if (dnsStatus.protection_disabled_duration === 0) {
                dnsStatus.protection_disabled_duration = null;
            }
            dispatch(dnsStatusSuccess(dnsStatus));
        }

        dispatch(setTlsConfigSuccess(decodedResponse));
        dispatch(addSuccessToast('encryption_config_saved'));
    } catch (error) {
        dispatch(addErrorToast({ error }));
        dispatch(setTlsConfigFailure());
    }
};

export const validateTlsConfigRequest = createAction('VALIDATE_TLS_CONFIG_REQUEST');
export const validateTlsConfigFailure = createAction('VALIDATE_TLS_CONFIG_FAILURE');
export const validateTlsConfigSuccess = createAction('VALIDATE_TLS_CONFIG_SUCCESS');

export const validateTlsConfig = (config: any) => async (dispatch: any) => {
    dispatch(validateTlsConfigRequest());
    try {
        const values = encodeTLSRequest(config);

        const response = await apiClient.validateTlsConfig(values);
        const decodedResponse = decodeTLSResponse(response);
        dispatch(validateTlsConfigSuccess(decodedResponse));

        return decodedResponse;
    } catch (error) {
        dispatch(addErrorToast({ error }));
        dispatch(validateTlsConfigFailure());

        return null;
    }
};

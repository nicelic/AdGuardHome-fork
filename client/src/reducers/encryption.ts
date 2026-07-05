import { handleActions } from 'redux-actions';

import * as actions from '../actions/encryption';
import { EncryptionData } from '../initialState';

const normalizeEncryptionPayload = (state: EncryptionData, payload: Partial<EncryptionData>) => ({
    ...state,
    ...payload,
    server_name: payload.server_name || '',
    panel_server_name: payload.panel_server_name || '',
    panel_server_url_path: payload.panel_server_url_path || '/',
    panel_server_port: payload.panel_server_port || 0,
    dns_over_quic_url_path: payload.dns_over_quic_url_path || '/dns-query',
    certificate_path: payload.certificate_path || '',
    certificate_key_pairs: payload.certificate_key_pairs || [],
    certificate_key_pair_statuses: payload.certificate_key_pair_statuses || [],
    private_key_path: payload.private_key_path || '',
    private_key_saved: payload.private_key_saved || false,
    panel_certificate_chain: payload.panel_certificate_chain || '',
    panel_certificate_path: payload.panel_certificate_path || '',
    panel_certificate_key_pairs: payload.panel_certificate_key_pairs || [],
    panel_certificate_key_pair_statuses: payload.panel_certificate_key_pair_statuses || [],
    panel_private_key_path: payload.panel_private_key_path || '',
    panel_private_key_saved: payload.panel_private_key_saved || false,
    dns_assigned_certificate_ids: payload.dns_assigned_certificate_ids || [],
    panel_assigned_certificate_ids: payload.panel_assigned_certificate_ids || [],
});

const encryption = handleActions(
    {
        [actions.getTlsStatusRequest.toString()]: (state: any) => ({
            ...state,
            processing: true,
        }),
        [actions.getTlsStatusFailure.toString()]: (state: any) => ({
            ...state,
            processing: false,
        }),
        [actions.getTlsStatusSuccess.toString()]: (state: any, { payload }: any) => {
            const newState = normalizeEncryptionPayload(state, {
                ...payload,
                processing: false,
            });

            return newState;
        },

        [actions.setTlsConfigRequest.toString()]: (state: any) => ({
            ...state,
            processingConfig: true,
        }),
        [actions.setTlsConfigFailure.toString()]: (state: any) => ({
            ...state,
            processingConfig: false,
        }),
        [actions.setTlsConfigSuccess.toString()]: (state: any, { payload }: any) => {
            const newState = normalizeEncryptionPayload(state, {
                ...payload,
                processingConfig: false,
            });

            return newState;
        },

        [actions.validateTlsConfigRequest.toString()]: (state: any) => ({
            ...state,
            processingValidate: true,
        }),
        [actions.validateTlsConfigFailure.toString()]: (state: any) => ({
            ...state,
            processingValidate: false,
            issuer: '',
            key_type: '',
            not_after: '',
            not_before: '',
            subject: '',
            warning_validation: '',
            panel_warning_validation: '',
            dns_names: null,
            panel_dns_names: null,
            valid_chain: false,
            panel_valid_chain: false,
            valid_key: false,
            panel_valid_key: false,
            valid_cert: false,
            panel_valid_cert: false,
            valid_pair: false,
            panel_valid_pair: false,
            can_apply: false,
            panel_can_apply: false,
            panel_issuer: '',
            panel_key_type: '',
            panel_not_after: '',
            panel_not_before: '',
            panel_subject: '',
            certificate_key_pair_statuses: [],
            panel_certificate_key_pair_statuses: [],
        }),
        [actions.validateTlsConfigSuccess.toString()]: (state: any, { payload }: any) => {
            const {
                issuer = '',
                key_type = '',
                not_after = '',
                not_before = '',
                subject = '',
                warning_validation = '',
                dns_names = '',
                can_apply = false,
                panel_issuer = '',
                panel_key_type = '',
                panel_not_after = '',
                panel_not_before = '',
                panel_subject = '',
                panel_warning_validation = '',
                panel_dns_names = '',
                panel_can_apply = false,
                ...values
            } = payload;

            const newState = normalizeEncryptionPayload(state, {
                ...values,
                issuer,
                key_type,
                not_after,
                not_before,
                subject,
                warning_validation,
                dns_names,
                can_apply,
                panel_issuer,
                panel_key_type,
                panel_not_after,
                panel_not_before,
                panel_subject,
                panel_warning_validation,
                panel_dns_names,
                panel_can_apply,
                processingValidate: false,
            });

            return newState;
        },
    },
    {
        processing: true,
        processingConfig: false,
        processingValidate: false,
        can_apply: false,
        panel_can_apply: false,
        enabled: false,
        serve_plain_dns: false,
        dns_names: null,
        panel_dns_names: null,
        force_https: false,
        issuer: '',
        panel_issuer: '',
        key_type: '',
        panel_key_type: '',
        not_after: '',
        panel_not_after: '',
        not_before: '',
        panel_not_before: '',
        panel_server_name: '',
        panel_server_url_path: '/',
        panel_server_port: 0,
        dns_over_quic_url_path: '/dns-query',
        port_dns_over_tls: 0,
        port_dns_over_quic: 0,
        port_https: 0,
        port_dnscrypt: 0,
        subject: '',
        panel_subject: '',
        valid_chain: false,
        panel_valid_chain: false,
        valid_key: false,
        panel_valid_key: false,
        valid_cert: false,
        panel_valid_cert: false,
        valid_pair: false,
        panel_valid_pair: false,
        status_cert: '',
        status_key: '',
        certificate_chain: '',
        panel_certificate_chain: '',
        private_key: '',
        panel_private_key: '',
        server_name: '',
        warning_validation: '',
        panel_warning_validation: '',
        certificate_path: '',
        panel_certificate_path: '',
        certificate_key_pairs: [],
        panel_certificate_key_pairs: [],
        certificate_key_pair_statuses: [],
        panel_certificate_key_pair_statuses: [],
        private_key_path: '',
        panel_private_key_path: '',
        private_key_saved: false,
        panel_private_key_saved: false,
        dns_assigned_certificate_ids: [],
        panel_assigned_certificate_ids: [],
    },
);

export default encryption;

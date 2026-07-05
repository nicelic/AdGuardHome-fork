import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    getTlsStatusSuccess,
    validateTlsConfig as validateTlsConfigAction,
    validateTlsConfigFailure,
    validateTlsConfigSuccess,
} from '../actions/encryption';
import apiClient from '../api/Api';
import { validateAbsolutePath, validatePairedValue, validatePlainDns } from '../helpers/validators';
import encryptionReducer from '../reducers/encryption';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('validatePairedValue', () => {
    it('allows both values to be empty', () => {
        expect(validatePairedValue('', '')).toBeUndefined();
    });

    it('allows both values to be set', () => {
        expect(validatePairedValue('cert.pem', 'key.pem')).toBeUndefined();
    });

    it('requires both values when only one side is set', () => {
        expect(validatePairedValue('cert.pem', '')).toBeTruthy();
        expect(validatePairedValue('', 'key.pem')).toBeTruthy();
    });
});

describe('validateAbsolutePath', () => {
    it('accepts absolute filesystem paths', () => {
        expect(validateAbsolutePath('C:\\certs\\fullchain.pem')).toBeUndefined();
        expect(validateAbsolutePath('/etc/ssl/private/key.pem')).toBeUndefined();
    });

    it('rejects URLs for local certificate path fields', () => {
        expect(validateAbsolutePath('https://example.org/cert.pem')).toBeTruthy();
    });
});

describe('validatePlainDns', () => {
    it('requires plain DNS when encryption is disabled', () => {
        expect(
            validatePlainDns(false, {
                enabled: false,
                port_https: 443,
            }),
        ).toBeTruthy();
    });

    it('requires an encrypted DNS protocol when plain DNS is disabled', () => {
        expect(
            validatePlainDns(false, {
                enabled: true,
                port_https: 0,
                port_dns_over_tls: 0,
                port_dns_over_quic: 0,
                port_dnscrypt: 0,
            }),
        ).toBeTruthy();
    });

    it('allows disabling plain DNS when an encrypted DNS protocol is enabled', () => {
        expect(
            validatePlainDns(false, {
                enabled: true,
                port_https: 0,
                port_dns_over_tls: 853,
                port_dns_over_quic: 0,
                port_dnscrypt: 0,
            }),
        ).toBeUndefined();
    });
});

describe('encryption reducer validation failure', () => {
    it('clears stale validation state after a failed validation request', () => {
        const previousState = encryptionReducer(
            undefined,
            validateTlsConfigSuccess({
                issuer: 'issuer',
                key_type: 'RSA',
                not_after: 'after',
                not_before: 'before',
                subject: 'subject',
                warning_validation: 'warning',
                dns_names: ['example.org'],
                valid_chain: true,
                valid_key: true,
                valid_cert: true,
                valid_pair: true,
                certificate_key_pair_statuses: [
                    {
                        certificate_path: 'cert.pem',
                        private_key_path: 'key.pem',
                        valid_chain: true,
                        valid_key: true,
                        valid_cert: true,
                        valid_pair: true,
                    },
                ],
            }),
        );

        const nextState = encryptionReducer(previousState, validateTlsConfigFailure());

        expect(nextState.issuer).toBe('');
        expect(nextState.key_type).toBe('');
        expect(nextState.warning_validation).toBe('');
        expect(nextState.dns_names).toBeNull();
        expect(nextState.valid_chain).toBe(false);
        expect(nextState.valid_key).toBe(false);
        expect(nextState.valid_cert).toBe(false);
        expect(nextState.valid_pair).toBe(false);
        expect(nextState.certificate_key_pair_statuses).toStrictEqual([]);
    });
});

describe('encryption reducer validation payload', () => {
    it('stores can_apply from TLS validation responses', () => {
        const nextState = encryptionReducer(
            undefined,
            validateTlsConfigSuccess({
                can_apply: false,
                warning_validation: 'configured server names are not covered',
            }),
        );

        expect(nextState.can_apply).toBe(false);
        expect(nextState.warning_validation).toContain('not covered');
    });
});

describe('encryption reducer payload normalization', () => {
    it('clears omitted TLS fields from a fresh status payload', () => {
        const previousState = {
            ...encryptionReducer(undefined, { type: '@@INIT', payload: undefined } as any),
            panel_server_name: 'panel.example.org',
            panel_server_url_path: '/panel',
            panel_server_port: 4443,
            dns_over_quic_url_path: '/old-dns-query',
            certificate_path: 'old-cert.pem',
            certificate_key_pairs: [{ certificate_path: 'old-cert.pem', private_key_path: 'old-key.pem' }],
            certificate_key_pair_statuses: [{ certificate_path: 'old-cert.pem', private_key_path: 'old-key.pem' }],
            private_key_path: 'old-key.pem',
            private_key_saved: true,
        };

        const nextState = encryptionReducer(
            previousState,
            getTlsStatusSuccess({
                enabled: true,
                server_name: 'dns.example.org',
            }),
        );

        expect(nextState.panel_server_name).toBe('');
        expect(nextState.panel_server_url_path).toBe('/');
        expect(nextState.panel_server_port).toBe(0);
        expect(nextState.dns_over_quic_url_path).toBe('/dns-query');
        expect(nextState.certificate_path).toBe('');
        expect(nextState.certificate_key_pairs).toStrictEqual([]);
        expect(nextState.certificate_key_pair_statuses).toStrictEqual([]);
        expect(nextState.private_key_path).toBe('');
        expect(nextState.private_key_saved).toBe(false);
    });
});

describe('validateTlsConfig action', () => {
    it('returns validation response for submit gating', async () => {
        const response = {
            can_apply: false,
            valid_key: true,
            valid_cert: true,
            valid_pair: true,
            certificate_chain: '',
            private_key: '',
        };
        vi.spyOn(apiClient, 'validateTlsConfig').mockResolvedValue(response as any);

        const dispatch = vi.fn();
        const result = await validateTlsConfigAction({
            certificate_chain: '',
            private_key: '',
            panel_server_port: 0,
            port_https: 443,
            port_dns_over_tls: 853,
            port_dns_over_quic: 0,
        } as any)(dispatch);

        expect(result).toEqual({
            ...response,
            panel_certificate_chain: '',
            panel_private_key: '',
        });
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'VALIDATE_TLS_CONFIG_SUCCESS' }));
    });

    it('returns null when validation request fails', async () => {
        vi.spyOn(apiClient, 'validateTlsConfig').mockRejectedValue(new Error('boom'));

        const dispatch = vi.fn();
        const result = await validateTlsConfigAction({
            certificate_chain: '',
            private_key: '',
            panel_server_port: 0,
            port_https: 443,
            port_dns_over_tls: 853,
            port_dns_over_quic: 0,
        } as any)(dispatch);

        expect(result).toBeNull();
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'VALIDATE_TLS_CONFIG_FAILURE' }));
    });
});

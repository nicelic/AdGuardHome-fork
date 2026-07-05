import { describe, expect, it } from 'vitest';
import { validateTlsConfigFailure, validateTlsConfigSuccess, } from '../actions/encryption';
import { validatePairedValue } from '../helpers/validators';
import encryptionReducer from '../reducers/encryption';
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
describe('encryption reducer validation failure', () => {
    it('clears stale validation state after a failed validation request', () => {
        const previousState = encryptionReducer(undefined, validateTlsConfigSuccess({
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
        }));
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

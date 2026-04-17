import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptWalletSecret, decryptWalletSecret } from '../utils/wallet-encryption';

const TEST_KEY_HEX = 'a'.repeat(64); // 64-char hex = 32 bytes
const STELLAR_SECRET = 'SCZANGBA5INTS5OEBS4YRJVXNSMQP5ZTG7OHCCPWYNYGB6WFICXWUQKI';

describe('wallet encryption utilities', () => {
    beforeEach(() => {
        process.env.WALLET_ENCRYPTION_KEY = TEST_KEY_HEX;
    });

    afterEach(() => {
        delete process.env.WALLET_ENCRYPTION_KEY;
    });

    it('should encrypt and decrypt a Stellar secret key', () => {
        const ciphertext = encryptWalletSecret(STELLAR_SECRET);
        const decrypted = decryptWalletSecret(ciphertext);
        expect(decrypted).toBe(STELLAR_SECRET);
    });

    it('should produce different ciphertexts for the same input (random IV)', () => {
        const ct1 = encryptWalletSecret(STELLAR_SECRET);
        const ct2 = encryptWalletSecret(STELLAR_SECRET);
        expect(ct1).not.toBe(ct2);
    });

    it('should produce a ciphertext in iv:authTag:ciphertext format', () => {
        const ciphertext = encryptWalletSecret(STELLAR_SECRET);
        const parts = ciphertext.split(':');
        expect(parts).toHaveLength(3);
        // Each part must be non-empty hex
        parts.forEach((p) => {
            expect(p).toMatch(/^[0-9a-f]+$/);
        });
    });

    it('should throw when WALLET_ENCRYPTION_KEY is not set', () => {
        delete process.env.WALLET_ENCRYPTION_KEY;
        expect(() => encryptWalletSecret(STELLAR_SECRET)).toThrow('WALLET_ENCRYPTION_KEY');
    });

    it('should throw when decrypting with a different key', () => {
        const ciphertext = encryptWalletSecret(STELLAR_SECRET);

        process.env.WALLET_ENCRYPTION_KEY = 'b'.repeat(64); // different key
        expect(() => decryptWalletSecret(ciphertext)).toThrow();
    });

    it('should throw on tampered ciphertext (auth tag mismatch)', () => {
        const ciphertext = encryptWalletSecret(STELLAR_SECRET);
        const parts = ciphertext.split(':');
        // Flip last char of ciphertext hex
        parts[2] = parts[2].slice(0, -1) + (parts[2].slice(-1) === 'f' ? '0' : 'f');
        expect(() => decryptWalletSecret(parts.join(':'))).toThrow();
    });

    it('should throw on malformed ciphertext', () => {
        expect(() => decryptWalletSecret('not:valid')).toThrow('Invalid ciphertext format');
    });

    it('should work with a non-hex string key (SHA-256 derivation)', () => {
        process.env.WALLET_ENCRYPTION_KEY = 'my-secret-key-passphrase';
        const ciphertext = encryptWalletSecret(STELLAR_SECRET);
        const decrypted = decryptWalletSecret(ciphertext);
        expect(decrypted).toBe(STELLAR_SECRET);
    });
});

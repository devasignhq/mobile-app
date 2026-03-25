import { describe, it, expect, beforeEach } from 'vitest';
import { encrypt, decrypt, validateEncryptionKey } from '../utils/wallet-encryption';

// 32-byte hex key for testing
const TEST_KEY = 'a'.repeat(64); // 32 bytes = 64 hex chars

describe('Wallet Encryption (AES-256-GCM)', () => {
    beforeEach(() => {
        process.env.WALLET_ENCRYPTION_KEY = TEST_KEY;
    });

    describe('encrypt/decrypt', () => {
        it('should encrypt and decrypt a string correctly', () => {
            const plaintext = 'SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'; // Stellar secret key format
            const encrypted = encrypt(plaintext);
            const decrypted = decrypt(encrypted);

            expect(decrypted).toBe(plaintext);
        });

        it('should produce different ciphertext for same plaintext (random IV)', () => {
            const plaintext = 'test-secret-key';
            const encrypted1 = encrypt(plaintext);
            const encrypted2 = encrypt(plaintext);

            expect(encrypted1).not.toBe(encrypted2);
            expect(decrypt(encrypted1)).toBe(plaintext);
            expect(decrypt(encrypted2)).toBe(plaintext);
        });

        it('should handle empty string', () => {
            const encrypted = encrypt('');
            const decrypted = decrypt(encrypted);
            expect(decrypted).toBe('');
        });

        it('should handle long strings', () => {
            const plaintext = 'x'.repeat(1000);
            const encrypted = encrypt(plaintext);
            const decrypted = decrypt(encrypted);
            expect(decrypted).toBe(plaintext);
        });

        it('should handle unicode characters', () => {
            const plaintext = 'secret-key-with-émojis-🔐-and-ñ';
            const encrypted = encrypt(plaintext);
            const decrypted = decrypt(encrypted);
            expect(decrypted).toBe(plaintext);
        });

        it('should throw when decrypting with wrong key', () => {
            const plaintext = 'secret';
            const encrypted = encrypt(plaintext);

            // Change the key
            process.env.WALLET_ENCRYPTION_KEY = 'b'.repeat(64);

            expect(() => decrypt(encrypted)).toThrow();
        });

        it('should throw when decrypting tampered data', () => {
            const plaintext = 'secret';
            const encrypted = encrypt(plaintext);

            // Tamper with the ciphertext
            const tampered = encrypted.slice(0, -2) + 'ff';

            expect(() => decrypt(tampered)).toThrow();
        });
    });

    describe('validateEncryptionKey', () => {
        it('should return valid for correct key', () => {
            const result = validateEncryptionKey();
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should return invalid when key is missing', () => {
            delete process.env.WALLET_ENCRYPTION_KEY;
            const result = validateEncryptionKey();
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should return invalid when key is wrong length', () => {
            process.env.WALLET_ENCRYPTION_KEY = 'short';
            const result = validateEncryptionKey();
            expect(result.valid).toBe(false);
        });
    });
});

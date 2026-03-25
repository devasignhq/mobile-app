import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

/**
 * Gets the encryption key from environment variable.
 * Key must be a 64-character hex string (32 bytes).
 */
function getEncryptionKey(): Buffer {
    const keyHex = process.env.WALLET_ENCRYPTION_KEY;
    if (!keyHex) {
        throw new Error('WALLET_ENCRYPTION_KEY environment variable is not set');
    }
    if (keyHex.length !== KEY_LENGTH * 2) {
        throw new Error(
            `WALLET_ENCRYPTION_KEY must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes), got ${keyHex.length}`
        );
    }
    return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypted data format:
 * - IV (12 bytes) + Auth Tag (16 bytes) + Ciphertext (variable)
 * Stored as hex string.
 */
export interface EncryptedData {
    ciphertext: string; // hex: iv + authTag + encrypted
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a hex string containing IV + Auth Tag + Ciphertext.
 *
 * @param plaintext - The string to encrypt (e.g., Stellar secret key)
 * @returns Hex-encoded encrypted data
 */
export function encrypt(plaintext: string): string {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    // Concatenate: IV (12) + AuthTag (16) + Ciphertext (variable)
    return iv.toString('hex') + authTag.toString('hex') + encrypted;
}

/**
 * Decrypts a hex string produced by encrypt().
 *
 * @param encryptedHex - Hex string from encrypt()
 * @returns The original plaintext string
 */
export function decrypt(encryptedHex: string): string {
    const key = getEncryptionKey();

    // Parse IV, Auth Tag, and Ciphertext from the concatenated hex
    const ivStart = 0;
    const ivEnd = IV_LENGTH * 2;
    const authTagEnd = ivEnd + AUTH_TAG_LENGTH * 2;

    const iv = Buffer.from(encryptedHex.slice(ivStart, ivEnd), 'hex');
    const authTag = Buffer.from(encryptedHex.slice(ivEnd, authTagEnd), 'hex');
    const ciphertext = encryptedHex.slice(authTagEnd);

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

/**
 * Validates that the encryption key is properly configured.
 * Useful for health checks and startup validation.
 */
export function validateEncryptionKey(): { valid: boolean; error?: string } {
    try {
        const key = getEncryptionKey();
        if (key.length !== KEY_LENGTH) {
            return { valid: false, error: `Key must be ${KEY_LENGTH} bytes` };
        }

        // Round-trip test
        const testPlaintext = 'validation-test-string';
        const encrypted = encrypt(testPlaintext);
        const decrypted = decrypt(encrypted);

        if (decrypted !== testPlaintext) {
            return { valid: false, error: 'Round-trip encryption test failed' };
        }

        return { valid: true };
    } catch (error) {
        return {
            valid: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

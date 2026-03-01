import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Derives a 32-byte AES-256 key from the raw environment variable value.
 * Accepts either a 64-char hex string (raw 32 bytes) or any string (SHA-256 hashed).
 */
function getEncryptionKey(): Buffer {
    const raw = process.env.WALLET_ENCRYPTION_KEY;
    if (!raw) {
        throw new Error('WALLET_ENCRYPTION_KEY environment variable is not set');
    }

    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
        // 64-char hex → 32 bytes
        return Buffer.from(raw, 'hex');
    }

    // Otherwise derive a 32-byte key via SHA-256
    return createHash('sha256').update(raw).digest();
}

/**
 * Encrypts a Stellar wallet secret key using AES-256-GCM.
 *
 * Returns a colon-delimited string: `iv:authTag:ciphertext` (all hex-encoded).
 * This format embeds all data needed for decryption in a single portable string.
 */
export function encryptWalletSecret(secret: string): string {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

/**
 * Decrypts a Stellar wallet secret key previously encrypted with `encryptWalletSecret`.
 *
 * Expects a colon-delimited string: `iv:authTag:ciphertext` (all hex-encoded).
 * Throws if the ciphertext is tampered with (authentication tag mismatch).
 */
export function decryptWalletSecret(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid ciphertext format — expected iv:authTag:ciphertext');
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    if (iv.length !== IV_LENGTH) {
        throw new Error('Invalid IV length in ciphertext');
    }
    if (authTag.length !== AUTH_TAG_LENGTH) {
        throw new Error('Invalid auth tag length in ciphertext');
    }

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Validates and returns the server-side encryption key from environment variable.
 * Expects a 64-character hex string representing a 32-byte key.
 */
function getEncryptionKey(): Buffer {
    const keyHex = process.env.WALLET_ENCRYPTION_KEY;
    if (!keyHex) {
        throw new Error('WALLET_ENCRYPTION_KEY environment variable is not set');
    }
    
    const key = Buffer.from(keyHex, 'hex');
    if (key.length !== 32) {
        throw new Error('WALLET_ENCRYPTION_KEY must be a valid 64-character hex string (32 bytes)');
    }
    
    return key;
}

/**
 * Encrypts a Stellar wallet secret key using AES-256-GCM.
 * @param secret The plaintext secret key string.
 * @returns The encrypted payload formatted as `iv:authTag:ciphertext` in hex.
 */
export function encryptWalletSecret(secret: string): string {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an encrypted Stellar wallet secret key payload.
 * @param encryptedData The payload formatted as `iv:authTag:ciphertext` in hex.
 * @returns The original plaintext secret key string.
 */
export function decryptWalletSecret(encryptedData: string): string {
    const key = getEncryptionKey();
    const parts = encryptedData.split(':');
    
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted wallet secret format. Expected iv:authTag:ciphertext');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    if (iv.length !== IV_LENGTH) {
        throw new Error(`Invalid initialization vector length. Expected ${IV_LENGTH} bytes`);
    }
    
    if (authTag.length !== AUTH_TAG_LENGTH) {
        throw new Error(`Invalid authentication tag length. Expected ${AUTH_TAG_LENGTH} bytes`);
    }
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decryptedStr: string;
    try {
        decryptedStr = decipher.update(encrypted, 'hex', 'utf8');
        decryptedStr += decipher.final('utf8');
    } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        throw new Error(`Failed to decrypt wallet secret. Bad key or corrupted payload. Details: ${errorMessage}`);
    }
    
    return decryptedStr;
}

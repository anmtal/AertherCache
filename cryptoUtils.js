/**
 * AetherCache Encryption Utilities
 * Implements highly secure AES-256-GCM encryption/decryption for API keys.
 * Uses native Node.js crypto module.
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV is standard for GCM
const SALT_LENGTH = 16;
const KEY_LENGTH = 32; // 256-bit key
const PBKDF2_ITERATIONS = 10000;

/**
 * Derives a secure key from a master secret and salt.
 */
function deriveKey(masterSecret, salt) {
    return crypto.pbkdf2Sync(masterSecret, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypts a plain text API key.
 * @param {string} text - The raw API key (e.g., 'sk-ant-...')
 * @param {string} masterSecret - The server's environment master key
 * @returns {string} - Encrypted string in format: salt:iv:authTag:encryptedText
 */
function encrypt(text, masterSecret) {
    if (!text || !masterSecret) {
        throw new Error('Text and master secret are required for encryption');
    }

    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = deriveKey(masterSecret, salt);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');

    // Combine all components into a single safe string for database storage
    return [
        salt.toString('hex'),
        iv.toString('hex'),
        authTag.toString('hex'),
        encrypted
    ].join(':');
}

/**
 * Decrypts an encrypted API key string.
 * @param {string} encryptedData - The database string (salt:iv:authTag:encryptedText)
 * @param {string} masterSecret - The server's environment master key
 * @returns {string} - The decrypted raw API key
 */
function decrypt(encryptedData, masterSecret) {
    if (!encryptedData || !masterSecret) {
        throw new Error('Encrypted data and master secret are required for decryption');
    }

    const parts = encryptedData.split(':');
    if (parts.length !== 4) {
        throw new Error('Invalid encrypted data format');
    }

    const salt = Buffer.from(parts[0], 'hex');
    const iv = Buffer.from(parts[1], 'hex');
    const authTag = Buffer.from(parts[2], 'hex');
    const encryptedText = parts[3];

    const key = deriveKey(masterSecret, salt);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

module.exports = {
    encrypt,
    decrypt
};

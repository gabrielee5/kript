/**
 * Cryptographic utilities for Kript keyring encryption
 *
 * Uses Web Crypto API (SubtleCrypto) for AES-256-GCM encryption
 * with PBKDF2 key derivation for secure private key storage.
 */

import { PGPError, ErrorCode } from './types.js';

/**
 * Encryption configuration constants
 */
export const CRYPTO_CONFIG = {
  /** PBKDF2 iteration count - 100,000+ as recommended by OWASP */
  PBKDF2_ITERATIONS: 120000,
  /** Salt length in bytes (128 bits) */
  SALT_LENGTH: 16,
  /** IV length for AES-GCM (96 bits as recommended) */
  IV_LENGTH: 12,
  /** AES key length in bits */
  AES_KEY_LENGTH: 256,
  /** PBKDF2 hash algorithm */
  PBKDF2_HASH: 'SHA-256',
  /** Encryption algorithm */
  ALGORITHM: 'AES-GCM',
  /** Authentication tag length in bits */
  TAG_LENGTH: 128,
} as const;

/**
 * Encrypted data format stored in storage
 */
export interface EncryptedData {
  /** Base64 encoded salt used for key derivation */
  salt: string;
  /** Base64 encoded initialization vector */
  iv: string;
  /** Base64 encoded ciphertext (includes authentication tag) */
  ciphertext: string;
  /** Version for future format migrations */
  version: number;
}

/**
 * Get the crypto object (works in both browser and Node.js)
 */
function getCrypto(): Crypto {
  if (typeof globalThis.crypto !== 'undefined') {
    return globalThis.crypto;
  }
  throw new PGPError(
    ErrorCode.ENCRYPTION_FAILED,
    'Web Crypto API not available in this environment'
  );
}

/**
 * Get the subtle crypto interface
 */
function getSubtleCrypto(): SubtleCrypto {
  const crypto = getCrypto();
  if (!crypto.subtle) {
    throw new PGPError(
      ErrorCode.ENCRYPTION_FAILED,
      'SubtleCrypto not available. Ensure you are running in a secure context (HTTPS or localhost).'
    );
  }
  return crypto.subtle;
}

/**
 * Generate cryptographically secure random bytes
 */
export function generateRandomBytes(length: number): Uint8Array {
  const crypto = getCrypto();
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Convert Uint8Array to base64 string
 */
export function uint8ArrayToBase64(arr: Uint8Array): string {
  // Use standard base64 encoding
  let binary = '';
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i]!);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr;
}

/**
 * Derive an encryption key from a passphrase using PBKDF2
 *
 * @param passphrase - The user's master passphrase
 * @param salt - Salt for key derivation (should be stored alongside encrypted data)
 * @returns CryptoKey suitable for AES-GCM encryption/decryption
 */
export async function deriveKey(
  passphrase: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();

  // Import passphrase as raw key material
  const passphraseKey = await subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive AES-256 key using PBKDF2
  const derivedKey = await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: CRYPTO_CONFIG.PBKDF2_ITERATIONS,
      hash: CRYPTO_CONFIG.PBKDF2_HASH,
    },
    passphraseKey,
    {
      name: CRYPTO_CONFIG.ALGORITHM,
      length: CRYPTO_CONFIG.AES_KEY_LENGTH,
    },
    false, // Not extractable for security
    ['encrypt', 'decrypt']
  );

  return derivedKey;
}

/**
 * Encrypt data using AES-256-GCM
 *
 * @param plaintext - Data to encrypt (string will be UTF-8 encoded)
 * @param passphrase - Master passphrase for key derivation
 * @returns EncryptedData object containing salt, IV, and ciphertext
 */
export async function encryptData(
  plaintext: string,
  passphrase: string
): Promise<EncryptedData> {
  if (!passphrase || passphrase.length === 0) {
    throw new PGPError(
      ErrorCode.INVALID_PASSPHRASE,
      'Passphrase is required for encryption'
    );
  }

  const subtle = getSubtleCrypto();

  // Generate random salt and IV
  const salt = generateRandomBytes(CRYPTO_CONFIG.SALT_LENGTH);
  const iv = generateRandomBytes(CRYPTO_CONFIG.IV_LENGTH);

  // Derive encryption key from passphrase
  const key = await deriveKey(passphrase, salt);

  // Encode plaintext as UTF-8
  const plaintextBytes = new TextEncoder().encode(plaintext);

  // Encrypt using AES-GCM
  const ciphertext = await subtle.encrypt(
    {
      name: CRYPTO_CONFIG.ALGORITHM,
      iv: iv.buffer as ArrayBuffer,
      tagLength: CRYPTO_CONFIG.TAG_LENGTH,
    },
    key,
    plaintextBytes
  );

  return {
    salt: uint8ArrayToBase64(salt),
    iv: uint8ArrayToBase64(iv),
    ciphertext: uint8ArrayToBase64(new Uint8Array(ciphertext)),
    version: 1,
  };
}

/**
 * Decrypt data using AES-256-GCM
 *
 * @param encryptedData - EncryptedData object containing salt, IV, and ciphertext
 * @param passphrase - Master passphrase for key derivation
 * @returns Decrypted plaintext string
 * @throws PGPError with INVALID_PASSPHRASE if decryption fails (wrong passphrase or tampered data)
 */
export async function decryptData(
  encryptedData: EncryptedData,
  passphrase: string
): Promise<string> {
  if (!passphrase || passphrase.length === 0) {
    throw new PGPError(
      ErrorCode.INVALID_PASSPHRASE,
      'Passphrase is required for decryption'
    );
  }

  // Validate encrypted data structure
  if (!encryptedData.salt || !encryptedData.iv || !encryptedData.ciphertext) {
    throw new PGPError(
      ErrorCode.DECRYPTION_FAILED,
      'Invalid encrypted data format: missing required fields'
    );
  }

  const subtle = getSubtleCrypto();

  try {
    // Decode base64 values
    const salt = base64ToUint8Array(encryptedData.salt);
    const iv = base64ToUint8Array(encryptedData.iv);
    const ciphertext = base64ToUint8Array(encryptedData.ciphertext);

    // Validate decoded values
    if (salt.length !== CRYPTO_CONFIG.SALT_LENGTH) {
      throw new PGPError(
        ErrorCode.DECRYPTION_FAILED,
        `Invalid salt length: expected ${CRYPTO_CONFIG.SALT_LENGTH}, got ${salt.length}`
      );
    }

    if (iv.length !== CRYPTO_CONFIG.IV_LENGTH) {
      throw new PGPError(
        ErrorCode.DECRYPTION_FAILED,
        `Invalid IV length: expected ${CRYPTO_CONFIG.IV_LENGTH}, got ${iv.length}`
      );
    }

    // Derive decryption key from passphrase
    const key = await deriveKey(passphrase, salt);

    // Decrypt using AES-GCM
    const plaintextBytes = await subtle.decrypt(
      {
        name: CRYPTO_CONFIG.ALGORITHM,
        iv: iv.buffer as ArrayBuffer,
        tagLength: CRYPTO_CONFIG.TAG_LENGTH,
      },
      key,
      ciphertext.buffer as ArrayBuffer
    );

    // Decode plaintext as UTF-8
    return new TextDecoder().decode(plaintextBytes);
  } catch (error) {
    // AES-GCM will throw on authentication failure (wrong passphrase or tampered data)
    if (error instanceof PGPError) {
      throw error;
    }
    throw new PGPError(
      ErrorCode.INVALID_PASSPHRASE,
      'Decryption failed: incorrect passphrase or corrupted data',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Encrypt a single private key string
 *
 * @param privateKey - The armored private key to encrypt
 * @param passphrase - Master passphrase for encryption
 * @returns Base64 encoded encrypted data string (format: version:salt:iv:ciphertext)
 */
export async function encryptPrivateKey(
  privateKey: string,
  passphrase: string
): Promise<string> {
  const encrypted = await encryptData(privateKey, passphrase);
  // Store as a compact format: version:salt:iv:ciphertext
  return `${encrypted.version}:${encrypted.salt}:${encrypted.iv}:${encrypted.ciphertext}`;
}

/**
 * Decrypt a single private key string
 *
 * @param encryptedPrivateKey - The encrypted private key string
 * @param passphrase - Master passphrase for decryption
 * @returns The decrypted armored private key
 */
export async function decryptPrivateKey(
  encryptedPrivateKey: string,
  passphrase: string
): Promise<string> {
  // Parse the compact format
  const parts = encryptedPrivateKey.split(':');

  if (parts.length !== 4) {
    throw new PGPError(
      ErrorCode.DECRYPTION_FAILED,
      'Invalid encrypted private key format'
    );
  }

  const [versionStr, salt, iv, ciphertext] = parts;
  const version = parseInt(versionStr!, 10);

  if (isNaN(version) || version < 1) {
    throw new PGPError(
      ErrorCode.DECRYPTION_FAILED,
      'Invalid encryption version'
    );
  }

  // Currently only version 1 is supported
  if (version !== 1) {
    throw new PGPError(
      ErrorCode.DECRYPTION_FAILED,
      `Unsupported encryption version: ${version}`
    );
  }

  const encryptedData: EncryptedData = {
    salt: salt!,
    iv: iv!,
    ciphertext: ciphertext!,
    version,
  };

  return decryptData(encryptedData, passphrase);
}

/**
 * Check if a string appears to be an encrypted private key
 * (starts with version number followed by base64 data)
 */
export function isEncryptedPrivateKey(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  // Check for our encrypted format: version:salt:iv:ciphertext
  const parts = value.split(':');
  if (parts.length !== 4) {
    return false;
  }

  const [versionStr, salt, iv, ciphertext] = parts;

  // Check version is a number
  const version = parseInt(versionStr!, 10);
  if (isNaN(version) || version < 1) {
    return false;
  }

  // Check that salt, iv, and ciphertext look like base64
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  return (
    base64Regex.test(salt!) &&
    base64Regex.test(iv!) &&
    base64Regex.test(ciphertext!)
  );
}

/**
 * Check if a string is a plaintext PGP private key (unencrypted storage)
 */
export function isPlaintextPrivateKey(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }
  return value.includes('-----BEGIN PGP PRIVATE KEY BLOCK-----');
}

/**
 * Securely clear a Uint8Array from memory
 */
export function secureClearBytes(arr: Uint8Array): void {
  // Overwrite with zeros
  arr.fill(0);
}

/**
 * Verify that the passphrase is correct by attempting to decrypt test data
 * This is used to validate the passphrase before performing operations
 *
 * @param encryptedTestData - Previously encrypted test data
 * @param passphrase - Passphrase to verify
 * @returns true if passphrase is correct, false otherwise
 */
export async function verifyPassphrase(
  encryptedTestData: string,
  passphrase: string
): Promise<boolean> {
  try {
    await decryptPrivateKey(encryptedTestData, passphrase);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a verification token that can be used to verify the passphrase
 * without storing it in plaintext
 *
 * @param passphrase - The master passphrase
 * @returns Encrypted verification token
 */
export async function generateVerificationToken(
  passphrase: string
): Promise<string> {
  // Use a known plaintext that we can verify later
  const verificationPlaintext = 'KRIPT_VERIFICATION_TOKEN_V1';
  return encryptPrivateKey(verificationPlaintext, passphrase);
}

/**
 * Verify a passphrase using the verification token
 *
 * @param verificationToken - The encrypted verification token
 * @param passphrase - The passphrase to verify
 * @returns true if the passphrase is correct
 */
export async function verifyWithToken(
  verificationToken: string,
  passphrase: string
): Promise<boolean> {
  try {
    const decrypted = await decryptPrivateKey(verificationToken, passphrase);
    return decrypted === 'KRIPT_VERIFICATION_TOKEN_V1';
  } catch {
    return false;
  }
}

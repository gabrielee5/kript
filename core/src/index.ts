/**
 * Kript Core Module
 *
 * A modern, local-first PGP encryption library built on OpenPGP.js
 */

// Types
export * from './types.js';

// Utilities
export * from './utils.js';

// Key management
export {
  generateKeyPair,
  readKey,
  readKeys,
  importKeys,
  exportKey,
  extractKeyInfo,
  decryptPrivateKey,
  changePassphrase,
  generateRevocationCertificate,
  validateKey,
  getPrimaryUserId,
} from './keys.js';

// Encryption
export {
  encrypt,
  decrypt,
  encryptFile,
  decryptFile,
  encryptWithPassword,
  decryptWithPassword,
} from './encrypt.js';

// Signing
export {
  sign,
  verify,
  signFile,
  verifyFile,
  extractCleartextMessage,
} from './sign.js';

// Keyring
export {
  Keyring,
  MemoryStorageAdapter,
  LocalStorageAdapter,
  IndexedDBStorageAdapter,
  type KeyringWarningCallback,
} from './keyring.js';

// Crypto utilities for keyring encryption
export {
  encryptData,
  decryptData,
  encryptPrivateKey as encryptPrivateKeyData,
  decryptPrivateKey as decryptPrivateKeyData,
  deriveKey,
  generateRandomBytes,
  isEncryptedPrivateKey,
  isPlaintextPrivateKey,
  generateVerificationToken,
  verifyWithToken,
  uint8ArrayToBase64,
  base64ToUint8Array,
  CRYPTO_CONFIG,
  type EncryptedData,
} from './crypto.js';

// Version
export const VERSION = '1.0.0';

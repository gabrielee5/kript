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
} from './keyring.js';

// Version
export const VERSION = '1.0.0';

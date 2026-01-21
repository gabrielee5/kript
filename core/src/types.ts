/**
 * Core types for Kript
 */

/** Supported key algorithms */
export type KeyAlgorithm = 'rsa2048' | 'rsa4096' | 'ecc' | 'curve25519';

/** Key type identifier */
export type KeyType = 'public' | 'private';

/** Key usage flags */
export interface KeyUsage {
  certify: boolean;
  sign: boolean;
  encrypt: boolean;
  authenticate: boolean;
}

/** User identity attached to a key */
export interface UserId {
  name: string;
  email: string;
  comment?: string;
}

/** Subkey information */
export interface SubkeyInfo {
  keyId: string;
  fingerprint: string;
  algorithm: string;
  bitLength?: number;
  curve?: string;
  creationTime: Date;
  expirationTime?: Date;
  usage: KeyUsage;
  revoked: boolean;
}

/** Key metadata */
export interface KeyInfo {
  keyId: string;
  fingerprint: string;
  algorithm: string;
  bitLength?: number;
  curve?: string;
  creationTime: Date;
  expirationTime?: Date;
  userIds: UserId[];
  usage: KeyUsage;
  revoked: boolean;
  isPrivate: boolean;
  subkeys: SubkeyInfo[];
}

/** Options for key generation */
export interface KeyGenerationOptions {
  algorithm: KeyAlgorithm;
  userIds: UserId[];
  passphrase?: string;
  expirationTime?: number; // seconds from now, 0 = never
  keyExpirationTime?: number; // deprecated, use expirationTime
}

/** Options for encryption */
export interface EncryptOptions {
  message: string | Uint8Array;
  encryptionKeys: string[]; // armored public keys
  signingKey?: string; // armored private key
  signingKeyPassphrase?: string;
  armor?: boolean; // default true
  format?: 'utf8' | 'binary';
}

/** Options for decryption */
export interface DecryptOptions {
  message: string | Uint8Array;
  decryptionKey: string; // armored private key
  passphrase?: string;
  verificationKeys?: string[]; // armored public keys for signature verification
  expectBinary?: boolean; // If true, return Uint8Array. If undefined, auto-detect from message type.
}

/** Options for signing */
export interface SignOptions {
  message: string | Uint8Array;
  signingKey: string; // armored private key
  passphrase?: string;
  detached?: boolean;
  armor?: boolean;
}

/** Options for verification */
export interface VerifyOptions {
  message: string | Uint8Array;
  signature?: string | Uint8Array; // for detached signatures
  verificationKeys: string[]; // armored public keys
}

/** Signature verification result */
export interface VerificationResult {
  valid: boolean;
  keyId: string;
  fingerprint?: string;
  signedBy?: UserId;
  signatureTime?: Date;
  error?: string;
}

/** Decryption result */
export interface DecryptResult {
  data: string | Uint8Array;
  signatures: VerificationResult[];
  filename?: string;
}

/** Encryption result */
export interface EncryptResult {
  data: string | Uint8Array;
  signature?: string | Uint8Array;
}

/** Sign result */
export interface SignResult {
  data: string | Uint8Array;
  signature?: string | Uint8Array; // only for detached
}

/** Key pair result from generation */
export interface KeyPair {
  publicKey: string;
  privateKey: string;
  revocationCertificate: string;
  keyInfo: KeyInfo;
}

/** Export options */
export interface ExportOptions {
  armor?: boolean;
  includePrivate?: boolean;
  passphrase?: string; // required if exporting private key
}

/** Import result */
export interface ImportResult {
  keys: KeyInfo[];
  errors: string[];
}

/** Storage adapter interface for cross-platform key storage */
export interface StorageAdapter {
  save(key: string, value: string): Promise<void>;
  load(key: string): Promise<string | null>;
  delete(key: string): Promise<boolean>;
  list(): Promise<string[]>;
  clear(): Promise<void>;
}

/** Keyring entry */
export interface KeyringEntry {
  keyId: string;
  fingerprint: string;
  publicKey: string;
  privateKey?: string;
  keyInfo: KeyInfo;
  addedAt: Date;
  lastUsed?: Date;
}

/** Encrypted keyring storage format */
export interface EncryptedKeyringData {
  /** Indicates the keyring uses encryption */
  encrypted: true;
  /** Encryption format version for future migrations */
  version: number;
  /** Token used to verify passphrase without storing it */
  verificationToken: string;
  /** The keyring entries (private keys are encrypted) */
  entries: Record<string, KeyringEntry>;
}

/** Unencrypted keyring storage format (legacy) */
export interface UnencryptedKeyringData {
  /** Indicates the keyring does not use encryption */
  encrypted?: false;
  /** The keyring entries (private keys are plaintext) */
  entries?: Record<string, KeyringEntry>;
}

/** Combined keyring data type */
export type KeyringData = EncryptedKeyringData | UnencryptedKeyringData | Record<string, KeyringEntry>;

/** Options for initializing an encrypted keyring */
export interface KeyringOptions {
  /** Master passphrase for encrypting private keys */
  passphrase?: string;
  /** If true, require encryption for all private keys */
  requireEncryption?: boolean;
}

/** Progress callback for long operations */
export type ProgressCallback = (progress: {
  operation: string;
  percent: number;
  message?: string;
}) => void;

/** Error codes */
export enum ErrorCode {
  INVALID_KEY = 'INVALID_KEY',
  INVALID_PASSPHRASE = 'INVALID_PASSPHRASE',
  INVALID_MESSAGE = 'INVALID_MESSAGE',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  KEY_NOT_FOUND = 'KEY_NOT_FOUND',
  KEY_EXPIRED = 'KEY_EXPIRED',
  KEY_REVOKED = 'KEY_REVOKED',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  SIGNING_FAILED = 'SIGNING_FAILED',
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  STORAGE_ERROR = 'STORAGE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  KEYRING_LOCKED = 'KEYRING_LOCKED',
  KEYRING_NOT_ENCRYPTED = 'KEYRING_NOT_ENCRYPTED',
}

/** Custom error class for PGP operations */
export class PGPError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'PGPError';
  }
}

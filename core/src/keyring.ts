/**
 * Keyring management for Kript
 *
 * Provides secure storage for PGP keys with AES-256-GCM encryption
 * for private keys using PBKDF2 key derivation.
 */

import {
  KeyringEntry,
  StorageAdapter,
  PGPError,
  ErrorCode,
  KeyringOptions,
  EncryptedKeyringData,
  KeyringData,
} from './types.js';
import { readKey, extractKeyInfo } from './keys.js';
import {
  encryptPrivateKey,
  decryptPrivateKey,
  isEncryptedPrivateKey,
  isPlaintextPrivateKey,
  generateVerificationToken,
  verifyWithToken,
  encryptData,
  decryptData,
} from './crypto.js';

const KEYRING_STORAGE_KEY = 'kript_keyring';
const KEYRING_FORMAT_VERSION = 1;

/**
 * Warning callback type for backward compatibility warnings
 */
export type KeyringWarningCallback = (message: string) => void;

/**
 * Keyring class for managing PGP keys with encrypted private key storage
 *
 * Security features:
 * - Private keys are encrypted with AES-256-GCM before storage
 * - Key derivation uses PBKDF2 with 120,000 iterations
 * - Each encryption uses a unique salt and IV
 * - Lock/unlock mechanism to protect private keys
 *
 * Usage:
 * ```typescript
 * const keyring = new Keyring(storage);
 * await keyring.load();
 *
 * // For encrypted keyrings, unlock before operations
 * await keyring.unlock('my-master-passphrase');
 *
 * // Add keys, perform operations...
 * await keyring.addKey(publicKey, privateKey);
 *
 * // Lock when done to clear passphrase from memory
 * keyring.lock();
 * ```
 */
export class Keyring {
  private entries: Map<string, KeyringEntry> = new Map();
  private storage: StorageAdapter;
  private loaded = false;
  private masterPassphrase: string | null = null;
  private isEncrypted = false;
  private verificationToken: string | null = null;
  private warningCallback: KeyringWarningCallback | null = null;
  private hasUnencryptedWarning = false;

  constructor(storage: StorageAdapter, options?: KeyringOptions) {
    this.storage = storage;
    if (options?.passphrase) {
      this.masterPassphrase = options.passphrase;
    }
  }

  /**
   * Set a callback for warnings (e.g., loading unencrypted keyring)
   */
  setWarningCallback(callback: KeyringWarningCallback | null): void {
    this.warningCallback = callback;
  }

  /**
   * Emit a warning message
   */
  private warn(message: string): void {
    if (this.warningCallback) {
      this.warningCallback(message);
    } else {
      console.warn(`[Kript Keyring Warning] ${message}`);
    }
  }

  /**
   * Check if the keyring is currently locked
   * A locked keyring cannot access private keys
   */
  isLocked(): boolean {
    // If keyring is encrypted and no passphrase is set, it's locked
    if (this.isEncrypted && !this.masterPassphrase) {
      return true;
    }
    return false;
  }

  /**
   * Check if the keyring has encryption enabled
   */
  hasEncryption(): boolean {
    return this.isEncrypted;
  }

  /**
   * Lock the keyring, clearing the master passphrase from memory
   * After locking, private keys cannot be accessed until unlock() is called
   */
  lock(): void {
    // Clear passphrase from memory (best effort)
    if (this.masterPassphrase) {
      // Overwrite the string reference
      this.masterPassphrase = null;
    }
  }

  /**
   * Unlock the keyring with the master passphrase
   * Required before performing operations that need private key access
   *
   * @param passphrase - The master passphrase
   * @throws PGPError if passphrase is incorrect
   */
  async unlock(passphrase: string): Promise<void> {
    if (!passphrase || passphrase.length === 0) {
      throw new PGPError(
        ErrorCode.INVALID_PASSPHRASE,
        'Passphrase is required to unlock the keyring'
      );
    }

    // If we have a verification token, verify the passphrase
    if (this.verificationToken) {
      const isValid = await verifyWithToken(this.verificationToken, passphrase);
      if (!isValid) {
        throw new PGPError(
          ErrorCode.INVALID_PASSPHRASE,
          'Incorrect passphrase'
        );
      }
    }

    this.masterPassphrase = passphrase;
  }

  /**
   * Set the master passphrase for encryption
   * This will enable encryption for the keyring if not already enabled
   *
   * @param passphrase - The master passphrase for encrypting private keys
   */
  async setMasterPassphrase(passphrase: string): Promise<void> {
    if (!passphrase || passphrase.length === 0) {
      throw new PGPError(
        ErrorCode.INVALID_PASSPHRASE,
        'Passphrase cannot be empty'
      );
    }

    const previousPassphrase = this.masterPassphrase;
    this.masterPassphrase = passphrase;

    // Generate a new verification token
    this.verificationToken = await generateVerificationToken(passphrase);

    // If we have existing entries with encrypted private keys using old passphrase,
    // re-encrypt them with the new passphrase
    if (this.isEncrypted && previousPassphrase && previousPassphrase !== passphrase) {
      for (const [fingerprint, entry] of this.entries) {
        if (entry.privateKey && isEncryptedPrivateKey(entry.privateKey)) {
          try {
            // Decrypt with old passphrase
            const decryptedKey = await decryptPrivateKey(entry.privateKey, previousPassphrase);
            // Re-encrypt with new passphrase
            entry.privateKey = await encryptPrivateKey(decryptedKey, passphrase);
            this.entries.set(fingerprint, entry);
          } catch (error) {
            throw new PGPError(
              ErrorCode.DECRYPTION_FAILED,
              `Failed to re-encrypt private key for ${fingerprint}: ${error instanceof Error ? error.message : 'Unknown error'}`,
              error instanceof Error ? error : undefined
            );
          }
        }
      }
    }

    // If we have plaintext private keys, encrypt them now
    for (const [fingerprint, entry] of this.entries) {
      if (entry.privateKey && isPlaintextPrivateKey(entry.privateKey)) {
        entry.privateKey = await encryptPrivateKey(entry.privateKey, passphrase);
        this.entries.set(fingerprint, entry);
      }
    }

    this.isEncrypted = true;
    await this.save();
  }

  /**
   * Change the master passphrase
   *
   * @param currentPassphrase - The current passphrase (for verification)
   * @param newPassphrase - The new passphrase
   */
  async changePassphrase(currentPassphrase: string, newPassphrase: string): Promise<void> {
    if (!this.isEncrypted) {
      throw new PGPError(
        ErrorCode.KEYRING_NOT_ENCRYPTED,
        'Keyring is not encrypted. Use setMasterPassphrase() to enable encryption.'
      );
    }

    // Verify current passphrase
    if (this.verificationToken) {
      const isValid = await verifyWithToken(this.verificationToken, currentPassphrase);
      if (!isValid) {
        throw new PGPError(
          ErrorCode.INVALID_PASSPHRASE,
          'Current passphrase is incorrect'
        );
      }
    }

    // Temporarily set the current passphrase for re-encryption
    this.masterPassphrase = currentPassphrase;

    // Now set the new passphrase (this will re-encrypt all private keys)
    await this.setMasterPassphrase(newPassphrase);
  }

  /**
   * Load keyring from storage
   */
  async load(): Promise<void> {
    try {
      const data = await this.storage.load(KEYRING_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data) as KeyringData;

        // Check if this is the new encrypted format
        if (this.isEncryptedKeyringData(parsed)) {
          this.isEncrypted = true;
          this.verificationToken = parsed.verificationToken;
          this.loadEntries(parsed.entries);
        } else if (this.isUnencryptedKeyringData(parsed)) {
          // New format but unencrypted
          this.isEncrypted = false;
          if (parsed.entries) {
            this.loadEntries(parsed.entries);
            this.checkForPlaintextPrivateKeys();
          }
        } else {
          // Legacy format: direct Record<string, KeyringEntry>
          this.isEncrypted = false;
          this.loadEntries(parsed as Record<string, KeyringEntry>);
          this.checkForPlaintextPrivateKeys();
        }
      }
      this.loaded = true;
    } catch (error) {
      throw new PGPError(
        ErrorCode.STORAGE_ERROR,
        `Failed to load keyring: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Type guard for encrypted keyring data
   */
  private isEncryptedKeyringData(data: KeyringData): data is EncryptedKeyringData {
    return (
      typeof data === 'object' &&
      data !== null &&
      'encrypted' in data &&
      data.encrypted === true &&
      'verificationToken' in data &&
      'entries' in data
    );
  }

  /**
   * Type guard for unencrypted keyring data (new format)
   */
  private isUnencryptedKeyringData(data: KeyringData): data is { encrypted?: false; entries?: Record<string, KeyringEntry> } {
    return (
      typeof data === 'object' &&
      data !== null &&
      'entries' in data &&
      (!('encrypted' in data) || data.encrypted === false)
    );
  }

  /**
   * Load entries from parsed data, reconstructing Date objects
   */
  private loadEntries(entries: Record<string, KeyringEntry>): void {
    this.entries = new Map(
      Object.entries(entries).map(([key, entry]) => [
        key,
        {
          ...entry,
          addedAt: new Date(entry.addedAt),
          lastUsed: entry.lastUsed ? new Date(entry.lastUsed) : undefined,
          keyInfo: {
            ...entry.keyInfo,
            creationTime: new Date(entry.keyInfo.creationTime),
            expirationTime: entry.keyInfo.expirationTime
              ? new Date(entry.keyInfo.expirationTime)
              : undefined,
            subkeys: entry.keyInfo.subkeys.map((sk) => ({
              ...sk,
              creationTime: new Date(sk.creationTime),
              expirationTime: sk.expirationTime ? new Date(sk.expirationTime) : undefined,
            })),
          },
        },
      ])
    );
  }

  /**
   * Check for plaintext private keys and emit warning
   */
  private checkForPlaintextPrivateKeys(): void {
    for (const entry of this.entries.values()) {
      if (entry.privateKey && isPlaintextPrivateKey(entry.privateKey)) {
        if (!this.hasUnencryptedWarning) {
          this.hasUnencryptedWarning = true;
          this.warn(
            'SECURITY WARNING: Keyring contains unencrypted private keys. ' +
            'Call setMasterPassphrase() to enable encryption and protect your private keys.'
          );
        }
        return;
      }
    }
  }

  /**
   * Save keyring to storage
   */
  async save(): Promise<void> {
    try {
      let dataToSave: EncryptedKeyringData | { entries: Record<string, KeyringEntry> };

      const entriesObject: Record<string, KeyringEntry> = {};
      for (const [key, entry] of this.entries) {
        entriesObject[key] = entry;
      }

      if (this.isEncrypted && this.verificationToken) {
        dataToSave = {
          encrypted: true,
          version: KEYRING_FORMAT_VERSION,
          verificationToken: this.verificationToken,
          entries: entriesObject,
        };
      } else {
        dataToSave = {
          entries: entriesObject,
        };
      }

      await this.storage.save(KEYRING_STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (error) {
      throw new PGPError(
        ErrorCode.STORAGE_ERROR,
        `Failed to save keyring: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Ensure keyring is loaded
   */
  private async ensureLoaded(): Promise<void> {
    if (!this.loaded) {
      await this.load();
    }
  }

  /**
   * Ensure keyring is unlocked for operations requiring private key access
   */
  private ensureUnlocked(): void {
    if (this.isEncrypted && !this.masterPassphrase) {
      throw new PGPError(
        ErrorCode.KEYRING_LOCKED,
        'Keyring is locked. Call unlock() with the master passphrase before accessing private keys.'
      );
    }
  }

  /**
   * Add a key to the keyring
   *
   * @param publicKey - The armored public key
   * @param privateKey - Optional armored private key (will be encrypted if passphrase is set)
   */
  async addKey(publicKey: string, privateKey?: string): Promise<KeyringEntry> {
    await this.ensureLoaded();

    // If adding a private key and keyring is encrypted, ensure we're unlocked
    if (privateKey && this.isEncrypted) {
      this.ensureUnlocked();
    }

    try {
      const key = await readKey(privateKey || publicKey);
      const keyInfo = await extractKeyInfo(key);

      // Encrypt private key if we have a passphrase
      let storedPrivateKey = privateKey;
      if (privateKey && this.masterPassphrase) {
        storedPrivateKey = await encryptPrivateKey(privateKey, this.masterPassphrase);
      } else if (privateKey && !this.masterPassphrase && !this.isEncrypted) {
        // Warn about storing unencrypted private key
        this.warn(
          `Adding private key without encryption. ` +
          `Call setMasterPassphrase() to enable encryption.`
        );
      }

      const entry: KeyringEntry = {
        keyId: keyInfo.keyId,
        fingerprint: keyInfo.fingerprint,
        publicKey,
        privateKey: storedPrivateKey,
        keyInfo,
        addedAt: new Date(),
      };

      this.entries.set(keyInfo.fingerprint, entry);
      await this.save();

      return entry;
    } catch (error) {
      if (error instanceof PGPError) {
        throw error;
      }
      throw new PGPError(
        ErrorCode.INVALID_KEY,
        `Failed to add key: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get a key by fingerprint or key ID
   * Note: If the keyring is encrypted and locked, private keys will not be decrypted
   */
  async getKey(identifier: string): Promise<KeyringEntry | null> {
    await this.ensureLoaded();

    const normalized = identifier.replace(/\s/g, '').toUpperCase();

    // Try exact fingerprint match
    if (this.entries.has(normalized)) {
      return this.entries.get(normalized) ?? null;
    }

    // Try key ID match (search by suffix)
    for (const [fingerprint, entry] of this.entries) {
      if (fingerprint.endsWith(normalized) || entry.keyId === normalized) {
        return entry;
      }
    }

    return null;
  }

  /**
   * Get a key with decrypted private key
   *
   * @param identifier - Fingerprint or key ID
   * @returns Entry with decrypted private key, or null if not found
   * @throws PGPError if keyring is locked or decryption fails
   */
  async getKeyDecrypted(identifier: string): Promise<KeyringEntry | null> {
    const entry = await this.getKey(identifier);
    if (!entry) {
      return null;
    }

    if (!entry.privateKey) {
      return entry;
    }

    // Check if private key is encrypted
    if (isEncryptedPrivateKey(entry.privateKey)) {
      this.ensureUnlocked();

      try {
        const decryptedPrivateKey = await decryptPrivateKey(
          entry.privateKey,
          this.masterPassphrase!
        );

        // Return a copy with decrypted private key
        return {
          ...entry,
          privateKey: decryptedPrivateKey,
        };
      } catch (error) {
        throw new PGPError(
          ErrorCode.DECRYPTION_FAILED,
          `Failed to decrypt private key: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error instanceof Error ? error : undefined
        );
      }
    }

    // Private key is not encrypted (legacy or unencrypted keyring)
    return entry;
  }

  /**
   * Get all keys
   */
  async getAllKeys(): Promise<KeyringEntry[]> {
    await this.ensureLoaded();
    return Array.from(this.entries.values());
  }

  /**
   * Get public keys only
   */
  async getPublicKeys(): Promise<KeyringEntry[]> {
    await this.ensureLoaded();
    return Array.from(this.entries.values());
  }

  /**
   * Get private keys only
   */
  async getPrivateKeys(): Promise<KeyringEntry[]> {
    await this.ensureLoaded();
    return Array.from(this.entries.values()).filter((entry) => entry.privateKey);
  }

  /**
   * Get private keys with decrypted private key data
   *
   * @throws PGPError if keyring is locked
   */
  async getPrivateKeysDecrypted(): Promise<KeyringEntry[]> {
    await this.ensureLoaded();

    const privateEntries = Array.from(this.entries.values()).filter(
      (entry) => entry.privateKey
    );

    if (privateEntries.length === 0) {
      return [];
    }

    // Check if any private keys are encrypted
    const hasEncryptedKeys = privateEntries.some(
      (entry) => entry.privateKey && isEncryptedPrivateKey(entry.privateKey)
    );

    if (hasEncryptedKeys) {
      this.ensureUnlocked();
    }

    const decrypted: KeyringEntry[] = [];
    for (const entry of privateEntries) {
      if (entry.privateKey && isEncryptedPrivateKey(entry.privateKey)) {
        const decryptedKey = await decryptPrivateKey(
          entry.privateKey,
          this.masterPassphrase!
        );
        decrypted.push({
          ...entry,
          privateKey: decryptedKey,
        });
      } else {
        decrypted.push(entry);
      }
    }

    return decrypted;
  }

  /**
   * Search keys by user ID (name or email)
   */
  async searchKeys(query: string): Promise<KeyringEntry[]> {
    await this.ensureLoaded();

    const normalizedQuery = query.toLowerCase();
    const results: KeyringEntry[] = [];

    for (const entry of this.entries.values()) {
      for (const userId of entry.keyInfo.userIds) {
        if (
          userId.name.toLowerCase().includes(normalizedQuery) ||
          userId.email.toLowerCase().includes(normalizedQuery)
        ) {
          results.push(entry);
          break;
        }
      }
    }

    return results;
  }

  /**
   * Delete a key by fingerprint or key ID
   */
  async deleteKey(identifier: string): Promise<boolean> {
    await this.ensureLoaded();

    const entry = await this.getKey(identifier);
    if (!entry) {
      return false;
    }

    this.entries.delete(entry.fingerprint);
    await this.save();
    return true;
  }

  /**
   * Update last used timestamp
   */
  async updateLastUsed(identifier: string): Promise<void> {
    await this.ensureLoaded();

    const entry = await this.getKey(identifier);
    if (entry) {
      entry.lastUsed = new Date();
      await this.save();
    }
  }

  /**
   * Clear all keys
   */
  async clear(): Promise<void> {
    this.entries.clear();
    await this.save();
  }

  /**
   * Get keyring statistics
   */
  async getStats(): Promise<{
    totalKeys: number;
    publicKeys: number;
    privateKeys: number;
    expiredKeys: number;
    revokedKeys: number;
    encrypted: boolean;
    locked: boolean;
  }> {
    await this.ensureLoaded();

    let publicKeys = 0;
    let privateKeys = 0;
    let expiredKeys = 0;
    let revokedKeys = 0;

    for (const entry of this.entries.values()) {
      publicKeys++;
      if (entry.privateKey) {
        privateKeys++;
      }
      if (entry.keyInfo.revoked) {
        revokedKeys++;
      }
      if (entry.keyInfo.expirationTime && entry.keyInfo.expirationTime < new Date()) {
        expiredKeys++;
      }
    }

    return {
      totalKeys: this.entries.size,
      publicKeys,
      privateKeys,
      expiredKeys,
      revokedKeys,
      encrypted: this.isEncrypted,
      locked: this.isLocked(),
    };
  }

  /**
   * Export all keys for backup
   * WARNING: Exports encrypted private keys as-is (still encrypted)
   */
  async exportAll(): Promise<string> {
    await this.ensureLoaded();
    return JSON.stringify(Object.fromEntries(this.entries));
  }

  /**
   * Export all keys with decrypted private keys (for unencrypted backup)
   *
   * WARNING: This exports private keys in PLAINTEXT. Use exportEncrypted() for secure backups.
   *
   * @throws PGPError if keyring is locked
   * @deprecated Use exportEncrypted() for secure backup exports
   */
  async exportAllDecrypted(): Promise<string> {
    await this.ensureLoaded();

    // Emit warning about plaintext export
    if (this.warningCallback) {
      this.warningCallback(
        'Exporting private keys in PLAINTEXT. This is insecure. Use exportEncrypted() for secure backups.'
      );
    } else {
      console.warn(
        '[Kript Keyring Security Warning] Exporting private keys in PLAINTEXT. Use exportEncrypted() for secure backups.'
      );
    }

    const exportEntries: Record<string, KeyringEntry> = {};

    for (const [fingerprint, entry] of this.entries) {
      if (entry.privateKey && isEncryptedPrivateKey(entry.privateKey)) {
        this.ensureUnlocked();
        const decryptedKey = await decryptPrivateKey(
          entry.privateKey,
          this.masterPassphrase!
        );
        exportEntries[fingerprint] = {
          ...entry,
          privateKey: decryptedKey,
        };
      } else {
        exportEntries[fingerprint] = entry;
      }
    }

    return JSON.stringify(exportEntries);
  }

  /**
   * Export all keys with encryption for secure backup
   *
   * The backup is encrypted with the provided passphrase using AES-256-GCM.
   * The backup can be imported using importEncryptedBackup().
   *
   * @param backupPassphrase Passphrase to encrypt the backup (can be different from master passphrase)
   * @returns Encrypted backup string that can be safely stored
   */
  async exportEncrypted(backupPassphrase: string): Promise<string> {
    await this.ensureLoaded();

    if (!backupPassphrase || backupPassphrase.length < 8) {
      throw new PGPError(
        ErrorCode.INVALID_PASSPHRASE,
        'Backup passphrase must be at least 8 characters'
      );
    }

    // Get all entries with decrypted private keys if we have encryption enabled
    const exportEntries: Record<string, KeyringEntry> = {};

    for (const [fingerprint, entry] of this.entries) {
      if (entry.privateKey && isEncryptedPrivateKey(entry.privateKey)) {
        this.ensureUnlocked();
        const decryptedKey = await decryptPrivateKey(
          entry.privateKey,
          this.masterPassphrase!
        );
        exportEntries[fingerprint] = {
          ...entry,
          privateKey: decryptedKey,
        };
      } else {
        exportEntries[fingerprint] = entry;
      }
    }

    // Create backup data
    const backupData = {
      version: 1,
      encrypted: true,
      exportedAt: new Date().toISOString(),
      keyCount: Object.keys(exportEntries).length,
      entries: exportEntries,
    };

    // Encrypt the backup
    const plaintext = JSON.stringify(backupData);
    const encrypted = await encryptData(plaintext, backupPassphrase);

    // Serialize encrypted data to compact format: version:salt:iv:ciphertext
    const encryptedString = `${encrypted.version}:${encrypted.salt}:${encrypted.iv}:${encrypted.ciphertext}`;

    // Return as a recognizable format
    return JSON.stringify({
      format: 'kript-encrypted-backup',
      version: 1,
      data: encryptedString,
    });
  }

  /**
   * Import keys from an encrypted backup
   *
   * @param encryptedBackup The encrypted backup string from exportEncrypted()
   * @param backupPassphrase The passphrase used to encrypt the backup
   * @returns Number of keys imported
   */
  async importEncryptedBackup(encryptedBackup: string, backupPassphrase: string): Promise<number> {
    // Parse the backup wrapper
    let wrapper: { format: string; version: number; data: string };
    try {
      wrapper = JSON.parse(encryptedBackup);
    } catch {
      throw new PGPError(ErrorCode.INVALID_KEY, 'Invalid backup format');
    }

    if (wrapper.format !== 'kript-encrypted-backup') {
      throw new PGPError(
        ErrorCode.INVALID_KEY,
        'Invalid backup format. Expected encrypted backup from exportEncrypted()'
      );
    }

    // Parse the encrypted data string format: version:salt:iv:ciphertext
    const parts = wrapper.data.split(':');
    if (parts.length !== 4) {
      throw new PGPError(ErrorCode.INVALID_KEY, 'Invalid encrypted backup data format');
    }

    const [versionStr, salt, iv, ciphertext] = parts;
    const encryptedData = {
      version: parseInt(versionStr!, 10),
      salt: salt!,
      iv: iv!,
      ciphertext: ciphertext!,
    };

    // Decrypt the backup
    let decrypted: string;
    try {
      decrypted = await decryptData(encryptedData, backupPassphrase);
    } catch {
      throw new PGPError(ErrorCode.INVALID_PASSPHRASE, 'Incorrect backup passphrase');
    }

    // Parse the decrypted data
    const backupData = JSON.parse(decrypted) as {
      version: number;
      encrypted: boolean;
      entries: Record<string, KeyringEntry>;
    };

    // Import the keys
    let imported = 0;
    for (const entry of Object.values(backupData.entries)) {
      try {
        await this.addKey(entry.publicKey, entry.privateKey);
        imported++;
      } catch {
        // Skip invalid keys
      }
    }

    return imported;
  }

  /**
   * Import keys from backup
   */
  async importFromBackup(backup: string): Promise<number> {
    const data = JSON.parse(backup) as Record<string, KeyringEntry>;
    let imported = 0;

    for (const entry of Object.values(data)) {
      try {
        await this.addKey(entry.publicKey, entry.privateKey);
        imported++;
      } catch {
        // Skip invalid keys
      }
    }

    return imported;
  }
}

/**
 * In-memory storage adapter (for testing)
 */
export class MemoryStorageAdapter implements StorageAdapter {
  private data: Map<string, string> = new Map();

  async save(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async load(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async delete(key: string): Promise<boolean> {
    return this.data.delete(key);
  }

  async list(): Promise<string[]> {
    return Array.from(this.data.keys());
  }

  async clear(): Promise<void> {
    this.data.clear();
  }
}

/**
 * Browser localStorage adapter
 */
export class LocalStorageAdapter implements StorageAdapter {
  private prefix: string;

  constructor(prefix = 'kript_') {
    this.prefix = prefix;
  }

  async save(key: string, value: string): Promise<void> {
    if (typeof localStorage === 'undefined') {
      throw new Error('localStorage not available');
    }
    localStorage.setItem(this.prefix + key, value);
  }

  async load(key: string): Promise<string | null> {
    if (typeof localStorage === 'undefined') {
      throw new Error('localStorage not available');
    }
    return localStorage.getItem(this.prefix + key);
  }

  async delete(key: string): Promise<boolean> {
    if (typeof localStorage === 'undefined') {
      throw new Error('localStorage not available');
    }
    const existed = localStorage.getItem(this.prefix + key) !== null;
    localStorage.removeItem(this.prefix + key);
    return existed;
  }

  async list(): Promise<string[]> {
    if (typeof localStorage === 'undefined') {
      throw new Error('localStorage not available');
    }
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix)) {
        keys.push(key.slice(this.prefix.length));
      }
    }
    return keys;
  }

  async clear(): Promise<void> {
    const keys = await this.list();
    for (const key of keys) {
      await this.delete(key);
    }
  }
}

/**
 * IndexedDB adapter for larger key storage
 */
export class IndexedDBStorageAdapter implements StorageAdapter {
  private dbName: string;
  private storeName = 'keyring';
  private db: IDBDatabase | null = null;

  constructor(dbName = 'kript') {
    this.dbName = dbName;
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  async save(key: string, value: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.put(value, key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async load(key: string): Promise<string | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result ?? null);
    });
  }

  async delete(key: string): Promise<boolean> {
    const db = await this.getDB();
    const existed = (await this.load(key)) !== null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(existed);
    });
  }

  async list(): Promise<string[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAllKeys();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as string[]);
    });
  }

  async clear(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

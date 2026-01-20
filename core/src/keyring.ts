/**
 * Keyring management for Kript
 */

import {
  KeyringEntry,
  StorageAdapter,
  PGPError,
  ErrorCode,
} from './types.js';
import { readKey, extractKeyInfo } from './keys.js';

const KEYRING_STORAGE_KEY = 'kript_keyring';

/**
 * Keyring class for managing PGP keys
 */
export class Keyring {
  private entries: Map<string, KeyringEntry> = new Map();
  private storage: StorageAdapter;
  private loaded = false;

  constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  /**
   * Load keyring from storage
   */
  async load(): Promise<void> {
    try {
      const data = await this.storage.load(KEYRING_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data) as Record<string, KeyringEntry>;
        this.entries = new Map(
          Object.entries(parsed).map(([key, entry]) => [
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
   * Save keyring to storage
   */
  async save(): Promise<void> {
    try {
      const data: Record<string, KeyringEntry> = {};
      for (const [key, entry] of this.entries) {
        data[key] = entry;
      }
      await this.storage.save(KEYRING_STORAGE_KEY, JSON.stringify(data));
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
   * Add a key to the keyring
   */
  async addKey(publicKey: string, privateKey?: string): Promise<KeyringEntry> {
    await this.ensureLoaded();

    try {
      const key = await readKey(privateKey || publicKey);
      const keyInfo = await extractKeyInfo(key);

      const entry: KeyringEntry = {
        keyId: keyInfo.keyId,
        fingerprint: keyInfo.fingerprint,
        publicKey,
        privateKey,
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
    };
  }

  /**
   * Export all keys for backup
   */
  async exportAll(): Promise<string> {
    await this.ensureLoaded();
    return JSON.stringify(Object.fromEntries(this.entries));
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

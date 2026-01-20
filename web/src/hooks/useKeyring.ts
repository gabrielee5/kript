import { useState, useEffect, useCallback } from 'react';
import {
  Keyring,
  IndexedDBStorageAdapter,
  KeyringEntry,
  KeyInfo,
  generateKeyPair,
  KeyAlgorithm,
  UserId,
} from '@kript/core';

// Create singleton keyring instance
let keyringInstance: Keyring | null = null;

function getKeyring(): Keyring {
  if (!keyringInstance) {
    const storage = new IndexedDBStorageAdapter('kript');
    keyringInstance = new Keyring(storage);
  }
  return keyringInstance;
}

export interface UseKeyringReturn {
  keys: KeyringEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addKey: (publicKey: string, privateKey?: string) => Promise<KeyringEntry>;
  deleteKey: (identifier: string) => Promise<boolean>;
  getKey: (identifier: string) => Promise<KeyringEntry | null>;
  searchKeys: (query: string) => Promise<KeyringEntry[]>;
  generateKey: (options: {
    algorithm: KeyAlgorithm;
    userIds: UserId[];
    passphrase?: string;
    expirationDays?: number;
  }) => Promise<{ publicKey: string; privateKey: string; keyInfo: KeyInfo; revocationCertificate: string }>;
}

export function useKeyring(): UseKeyringReturn {
  const [keys, setKeys] = useState<KeyringEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const keyring = getKeyring();
      await keyring.load();
      const allKeys = await keyring.getAllKeys();
      setKeys(allKeys);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addKey = useCallback(async (publicKey: string, privateKey?: string): Promise<KeyringEntry> => {
    const keyring = getKeyring();
    const entry = await keyring.addKey(publicKey, privateKey);
    await refresh();
    return entry;
  }, [refresh]);

  const deleteKey = useCallback(async (identifier: string): Promise<boolean> => {
    const keyring = getKeyring();
    const result = await keyring.deleteKey(identifier);
    await refresh();
    return result;
  }, [refresh]);

  const getKey = useCallback(async (identifier: string): Promise<KeyringEntry | null> => {
    const keyring = getKeyring();
    return keyring.getKey(identifier);
  }, []);

  const searchKeys = useCallback(async (query: string): Promise<KeyringEntry[]> => {
    const keyring = getKeyring();
    return keyring.searchKeys(query);
  }, []);

  const generateKey = useCallback(async (options: {
    algorithm: KeyAlgorithm;
    userIds: UserId[];
    passphrase?: string;
    expirationDays?: number;
  }) => {
    const expirationTime = options.expirationDays ? options.expirationDays * 24 * 60 * 60 : undefined;

    const result = await generateKeyPair({
      algorithm: options.algorithm,
      userIds: options.userIds,
      passphrase: options.passphrase,
      expirationTime,
    });

    // Add to keyring
    const keyring = getKeyring();
    await keyring.addKey(result.publicKey, result.privateKey);
    await refresh();

    return result;
  }, [refresh]);

  return {
    keys,
    loading,
    error,
    refresh,
    addKey,
    deleteKey,
    getKey,
    searchKeys,
    generateKey,
  };
}

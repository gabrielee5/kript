import { describe, it, expect, beforeEach } from 'vitest';
import { Keyring, MemoryStorageAdapter } from './keyring';
import { generateKeyPair } from './keys';

describe('Keyring', () => {
  let keyring: Keyring;
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
    keyring = new Keyring(storage);
  });

  describe('Basic Operations', () => {
    it('should add a key to the keyring', async () => {
      const keyPair = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'Test', email: 'test@example.com' }],
      });

      const entry = await keyring.addKey(keyPair.publicKey, keyPair.privateKey);

      expect(entry.keyId).toBeDefined();
      expect(entry.fingerprint).toBeDefined();
      expect(entry.keyInfo.userIds[0]?.email).toBe('test@example.com');
    });

    it('should get a key by fingerprint', async () => {
      const keyPair = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'Test', email: 'test@example.com' }],
      });

      const added = await keyring.addKey(keyPair.publicKey);
      const retrieved = await keyring.getKey(added.fingerprint);

      expect(retrieved).toBeDefined();
      expect(retrieved?.fingerprint).toBe(added.fingerprint);
    });

    it('should get a key by short key ID', async () => {
      const keyPair = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'Test', email: 'test@example.com' }],
      });

      const added = await keyring.addKey(keyPair.publicKey);
      const retrieved = await keyring.getKey(added.keyId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.keyId).toBe(added.keyId);
    });

    it('should return null for non-existent key', async () => {
      const retrieved = await keyring.getKey('NONEXISTENT');
      expect(retrieved).toBeNull();
    });

    it('should delete a key', async () => {
      const keyPair = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'Test', email: 'test@example.com' }],
      });

      const added = await keyring.addKey(keyPair.publicKey);
      const deleted = await keyring.deleteKey(added.fingerprint);

      expect(deleted).toBe(true);

      const retrieved = await keyring.getKey(added.fingerprint);
      expect(retrieved).toBeNull();
    });

    it('should return false when deleting non-existent key', async () => {
      const deleted = await keyring.deleteKey('NONEXISTENT');
      expect(deleted).toBe(false);
    });
  });

  describe('Listing Keys', () => {
    it('should list all keys', async () => {
      const keyPair1 = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'User 1', email: 'user1@example.com' }],
      });
      const keyPair2 = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'User 2', email: 'user2@example.com' }],
      });

      await keyring.addKey(keyPair1.publicKey, keyPair1.privateKey);
      await keyring.addKey(keyPair2.publicKey);

      const allKeys = await keyring.getAllKeys();
      expect(allKeys.length).toBe(2);
    });

    it('should list only public keys', async () => {
      const keyPair = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'Test', email: 'test@example.com' }],
      });

      await keyring.addKey(keyPair.publicKey);

      const publicKeys = await keyring.getPublicKeys();
      expect(publicKeys.length).toBe(1);
    });

    it('should list only private keys', async () => {
      const keyPair1 = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'User 1', email: 'user1@example.com' }],
      });
      const keyPair2 = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'User 2', email: 'user2@example.com' }],
      });

      await keyring.addKey(keyPair1.publicKey, keyPair1.privateKey);
      await keyring.addKey(keyPair2.publicKey); // No private key

      const privateKeys = await keyring.getPrivateKeys();
      expect(privateKeys.length).toBe(1);
    });
  });

  describe('Searching Keys', () => {
    it('should search by name', async () => {
      const keyPair1 = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'Alice Smith', email: 'alice@example.com' }],
      });
      const keyPair2 = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'Bob Jones', email: 'bob@example.com' }],
      });

      await keyring.addKey(keyPair1.publicKey);
      await keyring.addKey(keyPair2.publicKey);

      const results = await keyring.searchKeys('Alice');
      expect(results.length).toBe(1);
      expect(results[0]?.keyInfo.userIds[0]?.name).toBe('Alice Smith');
    });

    it('should search by email', async () => {
      const keyPair = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'Test User', email: 'findme@example.com' }],
      });

      await keyring.addKey(keyPair.publicKey);

      const results = await keyring.searchKeys('findme');
      expect(results.length).toBe(1);
    });

    it('should be case insensitive', async () => {
      const keyPair = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'Case Test', email: 'case@example.com' }],
      });

      await keyring.addKey(keyPair.publicKey);

      const results = await keyring.searchKeys('CASE');
      expect(results.length).toBe(1);
    });
  });

  describe('Statistics', () => {
    it('should return correct stats', async () => {
      const keyPair1 = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'User 1', email: 'user1@example.com' }],
      });
      const keyPair2 = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'User 2', email: 'user2@example.com' }],
      });

      await keyring.addKey(keyPair1.publicKey, keyPair1.privateKey);
      await keyring.addKey(keyPair2.publicKey);

      const stats = await keyring.getStats();
      expect(stats.totalKeys).toBe(2);
      expect(stats.publicKeys).toBe(2);
      expect(stats.privateKeys).toBe(1);
    });
  });

  describe('Persistence', () => {
    it('should persist and reload keys', async () => {
      const keyPair = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'Persist Test', email: 'persist@example.com' }],
      });

      await keyring.addKey(keyPair.publicKey);

      // Create new keyring with same storage
      const newKeyring = new Keyring(storage);
      await newKeyring.load();

      const keys = await newKeyring.getAllKeys();
      expect(keys.length).toBe(1);
      expect(keys[0]?.keyInfo.userIds[0]?.email).toBe('persist@example.com');
    });
  });

  describe('Clear', () => {
    it('should clear all keys', async () => {
      const keyPair = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'Clear Test', email: 'clear@example.com' }],
      });

      await keyring.addKey(keyPair.publicKey);
      await keyring.clear();

      const keys = await keyring.getAllKeys();
      expect(keys.length).toBe(0);
    });
  });

  describe('Export/Import', () => {
    it('should export all keys', async () => {
      const keyPair = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'Export Test', email: 'export@example.com' }],
      });

      await keyring.addKey(keyPair.publicKey, keyPair.privateKey);

      const exported = await keyring.exportAll();
      expect(exported).toBeDefined();
      expect(typeof exported).toBe('string');

      const parsed = JSON.parse(exported);
      expect(Object.keys(parsed).length).toBe(1);
    });

    it('should import from backup', async () => {
      const keyPair = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'Backup Test', email: 'backup@example.com' }],
      });

      await keyring.addKey(keyPair.publicKey, keyPair.privateKey);
      const exported = await keyring.exportAll();

      // Clear and reimport
      await keyring.clear();
      const imported = await keyring.importFromBackup(exported);

      expect(imported).toBe(1);

      const keys = await keyring.getAllKeys();
      expect(keys.length).toBe(1);
    });
  });

  describe('Last Used Tracking', () => {
    it('should update last used timestamp', async () => {
      const keyPair = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'Track Test', email: 'track@example.com' }],
      });

      const entry = await keyring.addKey(keyPair.publicKey);
      expect(entry.lastUsed).toBeUndefined();

      await keyring.updateLastUsed(entry.fingerprint);

      const updated = await keyring.getKey(entry.fingerprint);
      expect(updated?.lastUsed).toBeDefined();
    });
  });
});

describe('MemoryStorageAdapter', () => {
  it('should save and load data', async () => {
    const storage = new MemoryStorageAdapter();

    await storage.save('test-key', 'test-value');
    const loaded = await storage.load('test-key');

    expect(loaded).toBe('test-value');
  });

  it('should return null for non-existent key', async () => {
    const storage = new MemoryStorageAdapter();
    const loaded = await storage.load('non-existent');

    expect(loaded).toBeNull();
  });

  it('should delete data', async () => {
    const storage = new MemoryStorageAdapter();

    await storage.save('test-key', 'test-value');
    const deleted = await storage.delete('test-key');

    expect(deleted).toBe(true);
    expect(await storage.load('test-key')).toBeNull();
  });

  it('should list all keys', async () => {
    const storage = new MemoryStorageAdapter();

    await storage.save('key1', 'value1');
    await storage.save('key2', 'value2');

    const keys = await storage.list();
    expect(keys).toContain('key1');
    expect(keys).toContain('key2');
  });

  it('should clear all data', async () => {
    const storage = new MemoryStorageAdapter();

    await storage.save('key1', 'value1');
    await storage.save('key2', 'value2');
    await storage.clear();

    const keys = await storage.list();
    expect(keys.length).toBe(0);
  });
});

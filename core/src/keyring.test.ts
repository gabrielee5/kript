import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Keyring, MemoryStorageAdapter } from './keyring';
import { generateKeyPair } from './keys';
import { isEncryptedPrivateKey, isPlaintextPrivateKey } from './crypto';
import { ErrorCode } from './types';

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
      expect(stats.encrypted).toBe(false);
      expect(stats.locked).toBe(false);
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

describe('Keyring Encryption', () => {
  let keyring: Keyring;
  let storage: MemoryStorageAdapter;
  const masterPassphrase = 'super-secure-master-passphrase-123!';

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
    keyring = new Keyring(storage);
    // Suppress console warnings in tests
    keyring.setWarningCallback(() => {});
  });

  describe('Lock/Unlock', () => {
    it('should start unlocked when no encryption', async () => {
      expect(keyring.isLocked()).toBe(false);
      expect(keyring.hasEncryption()).toBe(false);
    });

    it('should lock after setting passphrase and calling lock()', async () => {
      await keyring.setMasterPassphrase(masterPassphrase);

      expect(keyring.hasEncryption()).toBe(true);
      expect(keyring.isLocked()).toBe(false);

      keyring.lock();

      expect(keyring.isLocked()).toBe(true);
    });

    it('should unlock with correct passphrase', async () => {
      await keyring.setMasterPassphrase(masterPassphrase);
      keyring.lock();

      await keyring.unlock(masterPassphrase);

      expect(keyring.isLocked()).toBe(false);
    });

    it('should reject incorrect passphrase', async () => {
      await keyring.setMasterPassphrase(masterPassphrase);
      keyring.lock();

      await expect(keyring.unlock('wrong-passphrase')).rejects.toMatchObject({
        code: ErrorCode.INVALID_PASSPHRASE,
      });

      expect(keyring.isLocked()).toBe(true);
    });

    it('should reject empty passphrase', async () => {
      await keyring.setMasterPassphrase(masterPassphrase);
      keyring.lock();

      await expect(keyring.unlock('')).rejects.toMatchObject({
        code: ErrorCode.INVALID_PASSPHRASE,
      });
    });
  });

  describe('Encrypted Private Key Storage', () => {
    it('should encrypt private keys when passphrase is set', async () => {
      await keyring.setMasterPassphrase(masterPassphrase);

      const keyPair = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'Encrypted', email: 'encrypted@example.com' }],
      });

      const entry = await keyring.addKey(keyPair.publicKey, keyPair.privateKey);

      // The stored private key should be encrypted
      expect(entry.privateKey).toBeDefined();
      expect(isEncryptedPrivateKey(entry.privateKey!)).toBe(true);
      expect(isPlaintextPrivateKey(entry.privateKey!)).toBe(false);
    });

    it('should decrypt private keys on retrieval', async () => {
      await keyring.setMasterPassphrase(masterPassphrase);

      const keyPair = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'Decrypt Test', email: 'decrypt@example.com' }],
      });

      await keyring.addKey(keyPair.publicKey, keyPair.privateKey);

      // Get decrypted entry
      const decryptedEntry = await keyring.getKeyDecrypted(keyPair.keyInfo.fingerprint);

      expect(decryptedEntry).toBeDefined();
      expect(decryptedEntry?.privateKey).toBe(keyPair.privateKey);
      expect(isPlaintextPrivateKey(decryptedEntry!.privateKey!)).toBe(true);
    });

    it('should fail to decrypt when locked', async () => {
      await keyring.setMasterPassphrase(masterPassphrase);

      const keyPair = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'Locked Test', email: 'locked@example.com' }],
      });

      await keyring.addKey(keyPair.publicKey, keyPair.privateKey);
      keyring.lock();

      await expect(
        keyring.getKeyDecrypted(keyPair.keyInfo.fingerprint)
      ).rejects.toMatchObject({
        code: ErrorCode.KEYRING_LOCKED,
      });
    });

    it('should not encrypt public keys', async () => {
      await keyring.setMasterPassphrase(masterPassphrase);

      const keyPair = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'Public Only', email: 'public@example.com' }],
      });

      const entry = await keyring.addKey(keyPair.publicKey);

      // Public key should not be encrypted
      expect(entry.publicKey).toBe(keyPair.publicKey);
      expect(entry.publicKey).toContain('-----BEGIN PGP PUBLIC KEY BLOCK-----');
    });
  });

  describe('Encrypt Existing Keys', () => {
    it('should encrypt existing plaintext private keys when setting passphrase', async () => {
      // First add a key without encryption
      const keyPair = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'Convert Test', email: 'convert@example.com' }],
      });

      await keyring.addKey(keyPair.publicKey, keyPair.privateKey);

      // Verify it's stored in plaintext
      let entry = await keyring.getKey(keyPair.keyInfo.fingerprint);
      expect(isPlaintextPrivateKey(entry!.privateKey!)).toBe(true);

      // Now set passphrase
      await keyring.setMasterPassphrase(masterPassphrase);

      // Verify it's now encrypted
      entry = await keyring.getKey(keyPair.keyInfo.fingerprint);
      expect(isEncryptedPrivateKey(entry!.privateKey!)).toBe(true);

      // Verify we can still decrypt it
      const decrypted = await keyring.getKeyDecrypted(keyPair.keyInfo.fingerprint);
      expect(decrypted!.privateKey).toBe(keyPair.privateKey);
    });
  });

  describe('Persistence with Encryption', () => {
    it('should persist encrypted keyring format', async () => {
      await keyring.setMasterPassphrase(masterPassphrase);

      const keyPair = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'Persist Encrypted', email: 'persist-enc@example.com' }],
      });

      await keyring.addKey(keyPair.publicKey, keyPair.privateKey);

      // Load into new keyring
      const newKeyring = new Keyring(storage);
      newKeyring.setWarningCallback(() => {});
      await newKeyring.load();

      // Should be encrypted and locked
      expect(newKeyring.hasEncryption()).toBe(true);
      expect(newKeyring.isLocked()).toBe(true);

      // Unlock and verify
      await newKeyring.unlock(masterPassphrase);

      const decrypted = await newKeyring.getKeyDecrypted(keyPair.keyInfo.fingerprint);
      expect(decrypted!.privateKey).toBe(keyPair.privateKey);
    });

    it('should preserve encryption status when reloading', async () => {
      await keyring.setMasterPassphrase(masterPassphrase);

      const keyPair = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'Reload Test', email: 'reload@example.com' }],
      });

      await keyring.addKey(keyPair.publicKey, keyPair.privateKey);

      // Create new keyring, load, unlock
      const keyring2 = new Keyring(storage);
      keyring2.setWarningCallback(() => {});
      await keyring2.load();
      await keyring2.unlock(masterPassphrase);

      // Get stats to verify encryption status
      const stats = await keyring2.getStats();
      expect(stats.encrypted).toBe(true);
    });
  });

  describe('Change Passphrase', () => {
    it('should change passphrase and re-encrypt all keys', async () => {
      await keyring.setMasterPassphrase(masterPassphrase);

      const keyPair = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'Change Pass', email: 'change@example.com' }],
      });

      await keyring.addKey(keyPair.publicKey, keyPair.privateKey);

      const newPassphrase = 'new-super-secure-passphrase-456!';
      await keyring.changePassphrase(masterPassphrase, newPassphrase);

      // Lock and try to unlock with old passphrase
      keyring.lock();

      await expect(keyring.unlock(masterPassphrase)).rejects.toMatchObject({
        code: ErrorCode.INVALID_PASSPHRASE,
      });

      // Unlock with new passphrase
      await keyring.unlock(newPassphrase);

      // Verify we can still decrypt
      const decrypted = await keyring.getKeyDecrypted(keyPair.keyInfo.fingerprint);
      expect(decrypted!.privateKey).toBe(keyPair.privateKey);
    });

    it('should reject changePassphrase if not encrypted', async () => {
      await expect(
        keyring.changePassphrase('old', 'new')
      ).rejects.toMatchObject({
        code: ErrorCode.KEYRING_NOT_ENCRYPTED,
      });
    });

    it('should reject changePassphrase with wrong current passphrase', async () => {
      await keyring.setMasterPassphrase(masterPassphrase);

      await expect(
        keyring.changePassphrase('wrong-passphrase', 'new-passphrase')
      ).rejects.toMatchObject({
        code: ErrorCode.INVALID_PASSPHRASE,
      });
    });
  });

  describe('Backward Compatibility', () => {
    it('should load legacy unencrypted keyring format', async () => {
      // Simulate legacy storage format (direct Record<string, KeyringEntry>)
      const keyPair = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'Legacy', email: 'legacy@example.com' }],
      });

      const legacyData = {
        [keyPair.keyInfo.fingerprint]: {
          keyId: keyPair.keyInfo.keyId,
          fingerprint: keyPair.keyInfo.fingerprint,
          publicKey: keyPair.publicKey,
          privateKey: keyPair.privateKey, // Plaintext!
          keyInfo: keyPair.keyInfo,
          addedAt: new Date().toISOString(),
        },
      };

      await storage.save('kript_keyring', JSON.stringify(legacyData));

      // Load into new keyring
      const newKeyring = new Keyring(storage);
      const warnings: string[] = [];
      newKeyring.setWarningCallback((msg) => warnings.push(msg));

      await newKeyring.load();

      // Should warn about unencrypted keys
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0]).toContain('unencrypted');

      // Should still be able to access keys
      const keys = await newKeyring.getAllKeys();
      expect(keys.length).toBe(1);
      expect(keys[0]?.keyInfo.userIds[0]?.email).toBe('legacy@example.com');
    });

    it('should not warn for unencrypted keyring without private keys', async () => {
      const keyPair = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'Public Only', email: 'public@example.com' }],
      });

      // Add only public key
      await keyring.addKey(keyPair.publicKey);

      // Create new keyring and load
      const newKeyring = new Keyring(storage);
      const warnings: string[] = [];
      newKeyring.setWarningCallback((msg) => warnings.push(msg));

      await newKeyring.load();

      // Should not warn (no private keys to encrypt)
      expect(warnings.length).toBe(0);
    });
  });

  describe('getPrivateKeysDecrypted', () => {
    it('should return all private keys decrypted', async () => {
      await keyring.setMasterPassphrase(masterPassphrase);

      const keyPair1 = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'User 1', email: 'user1@example.com' }],
      });
      const keyPair2 = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'User 2', email: 'user2@example.com' }],
      });

      await keyring.addKey(keyPair1.publicKey, keyPair1.privateKey);
      await keyring.addKey(keyPair2.publicKey, keyPair2.privateKey);

      const decryptedKeys = await keyring.getPrivateKeysDecrypted();

      expect(decryptedKeys.length).toBe(2);
      expect(isPlaintextPrivateKey(decryptedKeys[0]!.privateKey!)).toBe(true);
      expect(isPlaintextPrivateKey(decryptedKeys[1]!.privateKey!)).toBe(true);
    });

    it('should throw when locked', async () => {
      await keyring.setMasterPassphrase(masterPassphrase);

      const keyPair = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'Test', email: 'test@example.com' }],
      });

      await keyring.addKey(keyPair.publicKey, keyPair.privateKey);
      keyring.lock();

      await expect(keyring.getPrivateKeysDecrypted()).rejects.toMatchObject({
        code: ErrorCode.KEYRING_LOCKED,
      });
    });
  });

  describe('exportAllDecrypted', () => {
    it('should export with decrypted private keys', async () => {
      await keyring.setMasterPassphrase(masterPassphrase);

      const keyPair = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'Export Decrypted', email: 'export-dec@example.com' }],
      });

      await keyring.addKey(keyPair.publicKey, keyPair.privateKey);

      const exported = await keyring.exportAllDecrypted();
      const parsed = JSON.parse(exported);

      const entry = Object.values(parsed)[0] as { privateKey: string };
      expect(isPlaintextPrivateKey(entry.privateKey)).toBe(true);
    });

    it('should throw when locked', async () => {
      await keyring.setMasterPassphrase(masterPassphrase);

      const keyPair = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'Test', email: 'test@example.com' }],
      });

      await keyring.addKey(keyPair.publicKey, keyPair.privateKey);
      keyring.lock();

      await expect(keyring.exportAllDecrypted()).rejects.toMatchObject({
        code: ErrorCode.KEYRING_LOCKED,
      });
    });
  });

  describe('Constructor with passphrase option', () => {
    it('should accept passphrase in constructor options', async () => {
      const keyringWithPass = new Keyring(storage, { passphrase: masterPassphrase });
      keyringWithPass.setWarningCallback(() => {});

      const keyPair = await generateKeyPair({
        algorithm: 'curve25519',
        userIds: [{ name: 'Constructor Test', email: 'constructor@example.com' }],
      });

      // Private key should be encrypted because passphrase was provided
      const entry = await keyringWithPass.addKey(keyPair.publicKey, keyPair.privateKey);
      expect(isEncryptedPrivateKey(entry.privateKey!)).toBe(true);
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

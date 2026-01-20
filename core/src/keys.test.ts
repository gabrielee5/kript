import { describe, it, expect, beforeAll } from 'vitest';
import {
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
} from './keys';
import { KeyAlgorithm, PGPError, ErrorCode } from './types';

describe('Key Generation', () => {
  it('should generate a Curve25519 key pair', async () => {
    const result = await generateKeyPair({
      algorithm: 'curve25519',
      userIds: [{ name: 'Test User', email: 'test@example.com' }],
    });

    expect(result.publicKey).toContain('-----BEGIN PGP PUBLIC KEY BLOCK-----');
    expect(result.privateKey).toContain('-----BEGIN PGP PRIVATE KEY BLOCK-----');
    expect(result.revocationCertificate).toBeDefined();
    expect(result.keyInfo.userIds[0]?.email).toBe('test@example.com');
    expect(result.keyInfo.algorithm).toContain('ECC');
  });

  it('should generate an RSA 2048 key pair', async () => {
    const result = await generateKeyPair({
      algorithm: 'rsa2048',
      userIds: [{ name: 'RSA User', email: 'rsa@example.com' }],
    });

    expect(result.publicKey).toContain('-----BEGIN PGP PUBLIC KEY BLOCK-----');
    expect(result.keyInfo.algorithm).toContain('RSA');
    expect(result.keyInfo.bitLength).toBe(2048);
  });

  it('should generate a key with passphrase', async () => {
    const result = await generateKeyPair({
      algorithm: 'curve25519',
      userIds: [{ name: 'Protected User', email: 'protected@example.com' }],
      passphrase: 'test-passphrase-123',
    });

    expect(result.privateKey).toContain('-----BEGIN PGP PRIVATE KEY BLOCK-----');
    expect(result.keyInfo.isPrivate).toBe(true);
  });

  it('should generate a key with expiration', async () => {
    const result = await generateKeyPair({
      algorithm: 'curve25519',
      userIds: [{ name: 'Expiring User', email: 'expire@example.com' }],
      expirationTime: 86400, // 1 day
    });

    expect(result.keyInfo.expirationTime).toBeDefined();
  });

  it('should generate a key with comment', async () => {
    const result = await generateKeyPair({
      algorithm: 'curve25519',
      userIds: [{ name: 'Comment User', email: 'comment@example.com', comment: 'Test Key' }],
    });

    expect(result.keyInfo.userIds[0]?.comment).toBe('Test Key');
  });
});

describe('Key Reading and Parsing', () => {
  let testKeyPair: Awaited<ReturnType<typeof generateKeyPair>>;

  beforeAll(async () => {
    testKeyPair = await generateKeyPair({
      algorithm: 'curve25519',
      userIds: [{ name: 'Parse Test', email: 'parse@example.com' }],
    });
  });

  it('should read a public key', async () => {
    const key = await readKey(testKeyPair.publicKey);
    expect(key).toBeDefined();
    expect(key.isPrivate()).toBe(false);
  });

  it('should read a private key', async () => {
    const key = await readKey(testKeyPair.privateKey);
    expect(key).toBeDefined();
    expect(key.isPrivate()).toBe(true);
  });

  it('should extract key info', async () => {
    const key = await readKey(testKeyPair.publicKey);
    const info = await extractKeyInfo(key);

    expect(info.fingerprint).toBeDefined();
    expect(info.keyId).toBeDefined();
    expect(info.userIds.length).toBeGreaterThan(0);
    expect(info.userIds[0]?.email).toBe('parse@example.com');
  });

  it('should throw on invalid key', async () => {
    await expect(readKey('not a valid key')).rejects.toThrow(PGPError);
  });
});

describe('Key Import/Export', () => {
  let testKeyPair: Awaited<ReturnType<typeof generateKeyPair>>;

  beforeAll(async () => {
    testKeyPair = await generateKeyPair({
      algorithm: 'curve25519',
      userIds: [{ name: 'Import Test', email: 'import@example.com' }],
    });
  });

  it('should import keys from armored text', async () => {
    const result = await importKeys(testKeyPair.publicKey);

    expect(result.keys.length).toBe(1);
    expect(result.errors.length).toBe(0);
    expect(result.keys[0]?.userIds[0]?.email).toBe('import@example.com');
  });

  it('should export a public key', async () => {
    const key = await readKey(testKeyPair.privateKey);
    const exported = await exportKey(key, { includePrivate: false });

    expect(exported).toContain('-----BEGIN PGP PUBLIC KEY BLOCK-----');
    expect(exported).not.toContain('-----BEGIN PGP PRIVATE KEY BLOCK-----');
  });
});

describe('Passphrase Operations', () => {
  it('should decrypt a private key with correct passphrase', async () => {
    const result = await generateKeyPair({
      algorithm: 'curve25519',
      userIds: [{ name: 'Decrypt Test', email: 'decrypt@example.com' }],
      passphrase: 'correct-passphrase',
    });

    const decrypted = await decryptPrivateKey(result.privateKey, 'correct-passphrase');
    expect(decrypted).toBeDefined();
    expect(decrypted.isDecrypted()).toBe(true);
  });

  it('should fail to decrypt with wrong passphrase', async () => {
    const result = await generateKeyPair({
      algorithm: 'curve25519',
      userIds: [{ name: 'Wrong Pass', email: 'wrong@example.com' }],
      passphrase: 'correct-passphrase',
    });

    await expect(
      decryptPrivateKey(result.privateKey, 'wrong-passphrase')
    ).rejects.toThrow(PGPError);
  });

  it('should change passphrase', async () => {
    const result = await generateKeyPair({
      algorithm: 'curve25519',
      userIds: [{ name: 'Change Pass', email: 'change@example.com' }],
      passphrase: 'old-passphrase',
    });

    const newKey = await changePassphrase(result.privateKey, 'old-passphrase', 'new-passphrase');
    expect(newKey).toContain('-----BEGIN PGP PRIVATE KEY BLOCK-----');

    // Verify new passphrase works
    const decrypted = await decryptPrivateKey(newKey, 'new-passphrase');
    expect(decrypted.isDecrypted()).toBe(true);
  });
});

describe('Key Validation', () => {
  it('should validate a good key', async () => {
    const result = await generateKeyPair({
      algorithm: 'curve25519',
      userIds: [{ name: 'Valid Key', email: 'valid@example.com' }],
    });

    const key = await readKey(result.publicKey);
    const validation = await validateKey(key);

    expect(validation.valid).toBe(true);
    expect(validation.errors.length).toBe(0);
  });
});

describe('Revocation', () => {
  it('should generate a revocation certificate', async () => {
    const result = await generateKeyPair({
      algorithm: 'curve25519',
      userIds: [{ name: 'Revoke Test', email: 'revoke@example.com' }],
    });

    const revocation = await generateRevocationCertificate(
      result.privateKey,
      undefined,
      'Testing revocation'
    );

    expect(revocation).toContain('-----BEGIN PGP PUBLIC KEY BLOCK-----');
  });
});

describe('User ID Extraction', () => {
  it('should get primary user ID', async () => {
    const result = await generateKeyPair({
      algorithm: 'curve25519',
      userIds: [{ name: 'Primary User', email: 'primary@example.com', comment: 'Test' }],
    });

    const key = await readKey(result.publicKey);
    const userId = getPrimaryUserId(key);

    expect(userId?.name).toBe('Primary User');
    expect(userId?.email).toBe('primary@example.com');
    expect(userId?.comment).toBe('Test');
  });
});

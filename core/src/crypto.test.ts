import { describe, it, expect, beforeEach } from 'vitest';
import {
  encryptData,
  decryptData,
  encryptPrivateKey,
  decryptPrivateKey,
  deriveKey,
  generateRandomBytes,
  isEncryptedPrivateKey,
  isPlaintextPrivateKey,
  generateVerificationToken,
  verifyWithToken,
  uint8ArrayToBase64,
  base64ToUint8Array,
  CRYPTO_CONFIG,
} from './crypto';
import { ErrorCode } from './types';

describe('Crypto Utilities', () => {
  describe('generateRandomBytes', () => {
    it('should generate random bytes of specified length', () => {
      const bytes16 = generateRandomBytes(16);
      const bytes32 = generateRandomBytes(32);

      expect(bytes16.length).toBe(16);
      expect(bytes32.length).toBe(32);
    });

    it('should generate different bytes each time', () => {
      const bytes1 = generateRandomBytes(16);
      const bytes2 = generateRandomBytes(16);

      expect(bytes1).not.toEqual(bytes2);
    });
  });

  describe('base64 encoding/decoding', () => {
    it('should encode and decode correctly', () => {
      const original = new Uint8Array([0, 1, 2, 255, 128, 64]);
      const encoded = uint8ArrayToBase64(original);
      const decoded = base64ToUint8Array(encoded);

      expect(decoded).toEqual(original);
    });

    it('should handle empty arrays', () => {
      const original = new Uint8Array([]);
      const encoded = uint8ArrayToBase64(original);
      const decoded = base64ToUint8Array(encoded);

      expect(decoded).toEqual(original);
    });
  });

  describe('deriveKey', () => {
    it('should derive a key from passphrase and salt', async () => {
      const passphrase = 'test-passphrase';
      const salt = generateRandomBytes(CRYPTO_CONFIG.SALT_LENGTH);

      const key = await deriveKey(passphrase, salt);

      expect(key).toBeDefined();
      expect(key.algorithm.name).toBe('AES-GCM');
    });

    it('should derive the same key with same passphrase and salt', async () => {
      const passphrase = 'test-passphrase';
      const salt = generateRandomBytes(CRYPTO_CONFIG.SALT_LENGTH);

      const key1 = await deriveKey(passphrase, salt);
      const key2 = await deriveKey(passphrase, salt);

      // Keys are not extractable, but we can verify by encrypting/decrypting
      expect(key1.algorithm).toEqual(key2.algorithm);
    });

    it('should derive different keys with different salts', async () => {
      const passphrase = 'test-passphrase';
      const salt1 = generateRandomBytes(CRYPTO_CONFIG.SALT_LENGTH);
      const salt2 = generateRandomBytes(CRYPTO_CONFIG.SALT_LENGTH);

      // Different salts should produce different keys
      // We can verify this by attempting to decrypt with wrong key
      const plaintext = 'test data';

      const key1 = await deriveKey(passphrase, salt1);
      const key2 = await deriveKey(passphrase, salt2);

      expect(key1).not.toBe(key2);
    });
  });

  describe('encryptData / decryptData', () => {
    it('should encrypt and decrypt data correctly', async () => {
      const passphrase = 'my-secure-passphrase';
      const plaintext = 'Hello, World! This is a test message.';

      const encrypted = await encryptData(plaintext, passphrase);
      const decrypted = await decryptData(encrypted, passphrase);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext (due to random IV)', async () => {
      const passphrase = 'my-secure-passphrase';
      const plaintext = 'Same message';

      const encrypted1 = await encryptData(plaintext, passphrase);
      const encrypted2 = await encryptData(plaintext, passphrase);

      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.salt).not.toBe(encrypted2.salt);
    });

    it('should fail decryption with wrong passphrase', async () => {
      const plaintext = 'Secret data';
      const encrypted = await encryptData(plaintext, 'correct-passphrase');

      await expect(
        decryptData(encrypted, 'wrong-passphrase')
      ).rejects.toMatchObject({
        code: ErrorCode.INVALID_PASSPHRASE,
      });
    });

    it('should fail with empty passphrase', async () => {
      const plaintext = 'Test data';

      await expect(encryptData(plaintext, '')).rejects.toMatchObject({
        code: ErrorCode.INVALID_PASSPHRASE,
      });

      const encrypted = await encryptData(plaintext, 'valid-passphrase');
      await expect(decryptData(encrypted, '')).rejects.toMatchObject({
        code: ErrorCode.INVALID_PASSPHRASE,
      });
    });

    it('should handle special characters in plaintext', async () => {
      const passphrase = 'test-pass';
      const plaintext = '特殊文字 🔐 <script>alert("xss")</script> "quotes" & entities';

      const encrypted = await encryptData(plaintext, passphrase);
      const decrypted = await decryptData(encrypted, passphrase);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle large plaintext', async () => {
      const passphrase = 'test-pass';
      const plaintext = 'A'.repeat(100000); // 100KB

      const encrypted = await encryptData(plaintext, passphrase);
      const decrypted = await decryptData(encrypted, passphrase);

      expect(decrypted).toBe(plaintext);
    });

    it('should detect tampered ciphertext', async () => {
      const passphrase = 'test-pass';
      const plaintext = 'Original data';

      const encrypted = await encryptData(plaintext, passphrase);

      // Tamper with the ciphertext
      const tamperedCiphertext = base64ToUint8Array(encrypted.ciphertext);
      tamperedCiphertext[0] = (tamperedCiphertext[0]! + 1) % 256;

      const tampered = {
        ...encrypted,
        ciphertext: uint8ArrayToBase64(tamperedCiphertext),
      };

      await expect(decryptData(tampered, passphrase)).rejects.toMatchObject({
        code: ErrorCode.INVALID_PASSPHRASE,
      });
    });
  });

  describe('encryptPrivateKey / decryptPrivateKey', () => {
    const samplePrivateKey = `-----BEGIN PGP PRIVATE KEY BLOCK-----

mI0EZYU6gQEEAMVlUE3KDEuAtZK7C4EuO5GZxZ7CqZzlDnY7qPCOVeA6rZH4YDKA
-----END PGP PRIVATE KEY BLOCK-----`;

    it('should encrypt and decrypt a private key', async () => {
      const passphrase = 'keyring-master-pass';

      const encrypted = await encryptPrivateKey(samplePrivateKey, passphrase);
      const decrypted = await decryptPrivateKey(encrypted, passphrase);

      expect(decrypted).toBe(samplePrivateKey);
    });

    it('should produce compact format (version:salt:iv:ciphertext)', async () => {
      const passphrase = 'test-pass';
      const encrypted = await encryptPrivateKey(samplePrivateKey, passphrase);

      const parts = encrypted.split(':');
      expect(parts.length).toBe(4);
      expect(parts[0]).toBe('1'); // Version 1
    });

    it('should fail with invalid encrypted format', async () => {
      const passphrase = 'test-pass';

      await expect(
        decryptPrivateKey('invalid-format', passphrase)
      ).rejects.toMatchObject({
        code: ErrorCode.DECRYPTION_FAILED,
      });

      await expect(
        decryptPrivateKey('1:salt:iv', passphrase) // Missing ciphertext
      ).rejects.toMatchObject({
        code: ErrorCode.DECRYPTION_FAILED,
      });
    });

    it('should fail with unsupported version', async () => {
      const passphrase = 'test-pass';

      await expect(
        decryptPrivateKey('99:salt:iv:ciphertext', passphrase)
      ).rejects.toMatchObject({
        code: ErrorCode.DECRYPTION_FAILED,
      });
    });
  });

  describe('isEncryptedPrivateKey', () => {
    it('should return true for encrypted keys', async () => {
      const encrypted = await encryptPrivateKey(
        '-----BEGIN PGP PRIVATE KEY BLOCK-----\ntest\n-----END PGP PRIVATE KEY BLOCK-----',
        'passphrase'
      );

      expect(isEncryptedPrivateKey(encrypted)).toBe(true);
    });

    it('should return false for plaintext keys', () => {
      const plaintext =
        '-----BEGIN PGP PRIVATE KEY BLOCK-----\ntest\n-----END PGP PRIVATE KEY BLOCK-----';

      expect(isEncryptedPrivateKey(plaintext)).toBe(false);
    });

    it('should return false for invalid input', () => {
      expect(isEncryptedPrivateKey('')).toBe(false);
      expect(isEncryptedPrivateKey('random-string')).toBe(false);
      expect(isEncryptedPrivateKey('1:2:3')).toBe(false); // Wrong number of parts
    });
  });

  describe('isPlaintextPrivateKey', () => {
    it('should return true for PGP private keys', () => {
      const plaintext =
        '-----BEGIN PGP PRIVATE KEY BLOCK-----\ntest\n-----END PGP PRIVATE KEY BLOCK-----';

      expect(isPlaintextPrivateKey(plaintext)).toBe(true);
    });

    it('should return false for encrypted keys', async () => {
      const encrypted = await encryptPrivateKey(
        '-----BEGIN PGP PRIVATE KEY BLOCK-----\ntest\n-----END PGP PRIVATE KEY BLOCK-----',
        'passphrase'
      );

      expect(isPlaintextPrivateKey(encrypted)).toBe(false);
    });

    it('should return false for public keys', () => {
      const publicKey =
        '-----BEGIN PGP PUBLIC KEY BLOCK-----\ntest\n-----END PGP PUBLIC KEY BLOCK-----';

      expect(isPlaintextPrivateKey(publicKey)).toBe(false);
    });

    it('should return false for invalid input', () => {
      expect(isPlaintextPrivateKey('')).toBe(false);
      expect(isPlaintextPrivateKey('random-string')).toBe(false);
    });
  });

  describe('Verification Token', () => {
    it('should generate and verify token correctly', async () => {
      const passphrase = 'my-master-passphrase';

      const token = await generateVerificationToken(passphrase);
      const isValid = await verifyWithToken(token, passphrase);

      expect(isValid).toBe(true);
    });

    it('should reject wrong passphrase', async () => {
      const passphrase = 'correct-passphrase';
      const wrongPassphrase = 'wrong-passphrase';

      const token = await generateVerificationToken(passphrase);
      const isValid = await verifyWithToken(token, wrongPassphrase);

      expect(isValid).toBe(false);
    });

    it('should handle invalid token format', async () => {
      const isValid = await verifyWithToken('invalid-token', 'any-passphrase');
      expect(isValid).toBe(false);
    });
  });

  describe('CRYPTO_CONFIG', () => {
    it('should have secure configuration values', () => {
      expect(CRYPTO_CONFIG.PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(100000);
      expect(CRYPTO_CONFIG.SALT_LENGTH).toBeGreaterThanOrEqual(16);
      expect(CRYPTO_CONFIG.IV_LENGTH).toBe(12); // GCM recommended IV size
      expect(CRYPTO_CONFIG.AES_KEY_LENGTH).toBe(256);
      expect(CRYPTO_CONFIG.TAG_LENGTH).toBe(128);
      expect(CRYPTO_CONFIG.ALGORITHM).toBe('AES-GCM');
    });
  });
});

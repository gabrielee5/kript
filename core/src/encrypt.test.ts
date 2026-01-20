import { describe, it, expect, beforeAll } from 'vitest';
import { generateKeyPair } from './keys';
import {
  encrypt,
  decrypt,
  encryptFile,
  decryptFile,
  encryptWithPassword,
  decryptWithPassword,
} from './encrypt';
import { PGPError, ErrorCode } from './types';

describe('Encryption', () => {
  let aliceKeyPair: Awaited<ReturnType<typeof generateKeyPair>>;
  let bobKeyPair: Awaited<ReturnType<typeof generateKeyPair>>;

  beforeAll(async () => {
    aliceKeyPair = await generateKeyPair({
      algorithm: 'curve25519',
      userIds: [{ name: 'Alice', email: 'alice@example.com' }],
      passphrase: 'alice-pass',
    });

    bobKeyPair = await generateKeyPair({
      algorithm: 'curve25519',
      userIds: [{ name: 'Bob', email: 'bob@example.com' }],
      passphrase: 'bob-pass',
    });
  });

  describe('Asymmetric Encryption', () => {
    it('should encrypt and decrypt a message', async () => {
      const originalMessage = 'Hello, this is a secret message!';

      const encrypted = await encrypt({
        message: originalMessage,
        encryptionKeys: [bobKeyPair.publicKey],
      });

      expect(encrypted.data).toContain('-----BEGIN PGP MESSAGE-----');

      const decrypted = await decrypt({
        message: encrypted.data,
        decryptionKey: bobKeyPair.privateKey,
        passphrase: 'bob-pass',
      });

      expect(decrypted.data).toBe(originalMessage);
    });

    it('should encrypt to multiple recipients', async () => {
      const originalMessage = 'Message for multiple recipients';

      const encrypted = await encrypt({
        message: originalMessage,
        encryptionKeys: [aliceKeyPair.publicKey, bobKeyPair.publicKey],
      });

      // Alice can decrypt
      const decryptedAlice = await decrypt({
        message: encrypted.data,
        decryptionKey: aliceKeyPair.privateKey,
        passphrase: 'alice-pass',
      });
      expect(decryptedAlice.data).toBe(originalMessage);

      // Bob can decrypt
      const decryptedBob = await decrypt({
        message: encrypted.data,
        decryptionKey: bobKeyPair.privateKey,
        passphrase: 'bob-pass',
      });
      expect(decryptedBob.data).toBe(originalMessage);
    });

    it('should encrypt and sign a message', async () => {
      const originalMessage = 'Signed and encrypted message';

      const encrypted = await encrypt({
        message: originalMessage,
        encryptionKeys: [bobKeyPair.publicKey],
        signingKey: aliceKeyPair.privateKey,
        signingKeyPassphrase: 'alice-pass',
      });

      const decrypted = await decrypt({
        message: encrypted.data,
        decryptionKey: bobKeyPair.privateKey,
        passphrase: 'bob-pass',
        verificationKeys: [aliceKeyPair.publicKey],
      });

      expect(decrypted.data).toBe(originalMessage);
      expect(decrypted.signatures.length).toBeGreaterThan(0);
      expect(decrypted.signatures[0]?.valid).toBe(true);
    });

    it('should fail to decrypt with wrong key', async () => {
      const encrypted = await encrypt({
        message: 'Secret message',
        encryptionKeys: [aliceKeyPair.publicKey],
      });

      // Bob should not be able to decrypt a message encrypted for Alice
      await expect(
        decrypt({
          message: encrypted.data,
          decryptionKey: bobKeyPair.privateKey,
          passphrase: 'bob-pass',
        })
      ).rejects.toThrow();
    });

    it('should handle binary data', async () => {
      const binaryData = new Uint8Array([0, 1, 2, 3, 4, 5, 255, 254, 253]);

      const encrypted = await encrypt({
        message: binaryData,
        encryptionKeys: [bobKeyPair.publicKey],
      });

      const decrypted = await decrypt({
        message: encrypted.data,
        decryptionKey: bobKeyPair.privateKey,
        passphrase: 'bob-pass',
      });

      expect(decrypted.data).toEqual(binaryData);
    });
  });

  describe('Symmetric Encryption', () => {
    it('should encrypt and decrypt with password', async () => {
      const originalMessage = 'Password protected message';
      const password = 'super-secret-password';

      const encrypted = await encryptWithPassword(originalMessage, password);
      expect(encrypted).toContain('-----BEGIN PGP MESSAGE-----');

      const decrypted = await decryptWithPassword(encrypted as string, password);
      expect(decrypted).toBe(originalMessage);
    });

    it('should fail to decrypt with wrong password', async () => {
      const encrypted = await encryptWithPassword('Secret', 'correct-password');

      await expect(
        decryptWithPassword(encrypted as string, 'wrong-password')
      ).rejects.toThrow(PGPError);
    });

    it('should handle binary data with password', async () => {
      const binaryData = new Uint8Array([10, 20, 30, 40, 50]);
      const password = 'binary-password';

      const encrypted = await encryptWithPassword(binaryData, password, false);
      const decrypted = await decryptWithPassword(encrypted, password);

      expect(decrypted).toEqual(binaryData);
    });
  });

  describe('File Encryption', () => {
    it('should encrypt and decrypt a file', async () => {
      const fileContent = new TextEncoder().encode('File content here');
      const filename = 'test.txt';

      const encrypted = await encryptFile(
        fileContent,
        filename,
        [bobKeyPair.publicKey]
      );

      expect(encrypted).toBeInstanceOf(Uint8Array);

      const decrypted = await decryptFile(
        encrypted,
        bobKeyPair.privateKey,
        'bob-pass'
      );

      expect(decrypted.data).toEqual(fileContent);
      expect(decrypted.filename).toBe(filename);
    });

    it('should encrypt and verify signed file', async () => {
      const fileContent = new Uint8Array([1, 2, 3, 4, 5]);

      const encrypted = await encryptFile(
        fileContent,
        'data.bin',
        [bobKeyPair.publicKey],
        aliceKeyPair.privateKey,
        'alice-pass'
      );

      const decrypted = await decryptFile(
        encrypted,
        bobKeyPair.privateKey,
        'bob-pass',
        [aliceKeyPair.publicKey]
      );

      expect(decrypted.data).toEqual(fileContent);
      expect(decrypted.signatures.length).toBeGreaterThan(0);
      expect(decrypted.signatures[0]?.valid).toBe(true);
    });
  });
});

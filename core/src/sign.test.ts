import { describe, it, expect, beforeAll } from 'vitest';
import { generateKeyPair } from './keys';
import { sign, verify, signFile, verifyFile, extractCleartextMessage } from './sign';
import { PGPError } from './types';

describe('Signing', () => {
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
    });
  });

  describe('Cleartext Signing', () => {
    it('should sign and verify a message', async () => {
      const message = 'This is a signed message';

      const signResult = await sign({
        message,
        signingKey: aliceKeyPair.privateKey,
        passphrase: 'alice-pass',
      });

      expect(signResult.data).toContain('-----BEGIN PGP SIGNED MESSAGE-----');

      const verifyResult = await verify({
        message: signResult.data as string,
        verificationKeys: [aliceKeyPair.publicKey],
      });

      expect(verifyResult.length).toBeGreaterThan(0);
      expect(verifyResult[0]?.valid).toBe(true);
    });

    it('should fail verification with wrong key', async () => {
      const message = 'Signed by Alice';

      const signResult = await sign({
        message,
        signingKey: aliceKeyPair.privateKey,
        passphrase: 'alice-pass',
      });

      // Verify with Bob's key (should fail)
      const verifyResult = await verify({
        message: signResult.data as string,
        verificationKeys: [bobKeyPair.publicKey],
      });

      expect(verifyResult[0]?.valid).toBe(false);
    });
  });

  describe('Detached Signatures', () => {
    it('should create and verify detached signature', async () => {
      const message = 'Message with detached signature';

      const signResult = await sign({
        message,
        signingKey: aliceKeyPair.privateKey,
        passphrase: 'alice-pass',
        detached: true,
      });

      expect(signResult.data).toBe(message);
      expect(signResult.signature).toContain('-----BEGIN PGP SIGNATURE-----');

      const verifyResult = await verify({
        message,
        signature: signResult.signature,
        verificationKeys: [aliceKeyPair.publicKey],
      });

      expect(verifyResult.length).toBeGreaterThan(0);
      expect(verifyResult[0]?.valid).toBe(true);
    });

    it('should fail verification if message is modified', async () => {
      const originalMessage = 'Original message';

      const signResult = await sign({
        message: originalMessage,
        signingKey: aliceKeyPair.privateKey,
        passphrase: 'alice-pass',
        detached: true,
      });

      const modifiedMessage = 'Modified message';

      const verifyResult = await verify({
        message: modifiedMessage,
        signature: signResult.signature,
        verificationKeys: [aliceKeyPair.publicKey],
      });

      expect(verifyResult[0]?.valid).toBe(false);
    });
  });

  describe('File Signing', () => {
    it('should sign and verify a file', async () => {
      const fileContent = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

      const signature = await signFile(
        fileContent,
        aliceKeyPair.privateKey,
        'alice-pass'
      );

      expect(signature).toContain('-----BEGIN PGP SIGNATURE-----');

      const verifyResult = await verifyFile(
        fileContent,
        signature,
        [aliceKeyPair.publicKey]
      );

      expect(verifyResult.length).toBeGreaterThan(0);
      expect(verifyResult[0]?.valid).toBe(true);
    });
  });

  describe('Message Extraction', () => {
    it('should extract cleartext message from signed message', async () => {
      const originalMessage = 'Extract this message';

      const signResult = await sign({
        message: originalMessage,
        signingKey: aliceKeyPair.privateKey,
        passphrase: 'alice-pass',
      });

      const extracted = await extractCleartextMessage(signResult.data as string);
      expect(extracted).toBe(originalMessage);
    });
  });

  describe('Binary Signing', () => {
    it('should sign binary data', async () => {
      const binaryData = new Uint8Array([0, 255, 128, 64, 32]);

      const signResult = await sign({
        message: binaryData,
        signingKey: aliceKeyPair.privateKey,
        passphrase: 'alice-pass',
        detached: true,
      });

      expect(signResult.signature).toBeDefined();

      const verifyResult = await verify({
        message: binaryData,
        signature: signResult.signature,
        verificationKeys: [aliceKeyPair.publicKey],
      });

      expect(verifyResult[0]?.valid).toBe(true);
    });
  });
});

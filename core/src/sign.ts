/**
 * Signing and verification functions for Kript
 */

import * as openpgp from 'openpgp';
import {
  SignOptions,
  SignResult,
  VerifyOptions,
  VerificationResult,
  PGPError,
  ErrorCode,
} from './types.js';
import { readKey, getPrimaryUserId } from './keys.js';
import { getShortKeyId } from './utils.js';

/**
 * Helper to convert a stream or value to string
 */
async function streamToString(stream: unknown): Promise<string> {
  if (typeof stream === 'string') return stream;
  // Handle ReadableStream-like objects (including WebStream)
  const readable = stream as ReadableStream<string>;
  const reader = readable.getReader();
  const chunks: string[] = [];
  let done = false;
  while (!done) {
    const result = await reader.read();
    done = result.done;
    if (result.value) chunks.push(result.value);
  }
  return chunks.join('');
}

/**
 * Helper to convert a stream or value to Uint8Array
 */
async function streamToUint8Array(stream: unknown): Promise<Uint8Array> {
  if (stream instanceof Uint8Array) return stream;
  // Handle ReadableStream-like objects (including WebStream)
  const readable = stream as ReadableStream<Uint8Array>;
  const reader = readable.getReader();
  const chunks: Uint8Array[] = [];
  let done = false;
  let totalLength = 0;
  while (!done) {
    const result = await reader.read();
    done = result.done;
    if (result.value) {
      chunks.push(result.value);
      totalLength += result.value.length;
    }
  }
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  return combined;
}

/**
 * Sign a message
 */
export async function sign(options: SignOptions): Promise<SignResult> {
  const { message, signingKey, passphrase, detached = false, armor = true } = options;

  try {
    // Read and decrypt the signing key
    let privateKey = await openpgp.readPrivateKey({ armoredKey: signingKey });
    if (!privateKey.isDecrypted()) {
      if (!passphrase) {
        throw new PGPError(ErrorCode.INVALID_PASSPHRASE, 'Passphrase required for encrypted key');
      }
      privateKey = await openpgp.decryptKey({ privateKey, passphrase });
    }

    // Create message
    let pgpMessage: openpgp.Message<openpgp.MaybeStream<Uint8Array | string>>;
    if (typeof message === 'string') {
      pgpMessage = await openpgp.createMessage({ text: message });
    } else {
      pgpMessage = await openpgp.createMessage({ binary: message });
    }

    if (detached) {
      // Create detached signature
      let signature: string | Uint8Array;
      if (armor) {
        const result = await openpgp.sign({
          message: pgpMessage,
          signingKeys: [privateKey],
          detached: true,
          format: 'armored',
        });
        signature = typeof result === 'string' ? result : await streamToString(result);
      } else {
        const binaryResult = await openpgp.sign({
          message: pgpMessage,
          signingKeys: [privateKey],
          detached: true,
          format: 'binary',
        });
        signature = binaryResult instanceof Uint8Array
          ? binaryResult
          : await streamToUint8Array(binaryResult);
      }

      return {
        data: message,
        signature,
      };
    } else {
      // Create cleartext signed message
      if (typeof message === 'string') {
        const cleartextMessage = await openpgp.createCleartextMessage({ text: message });
        const signed = await openpgp.sign({
          message: cleartextMessage,
          signingKeys: [privateKey],
        });

        return {
          data: typeof signed === 'string' ? signed : await streamToString(signed),
        };
      } else {
        // For binary, we need to create a signed message
        let signed: string | Uint8Array;
        if (armor) {
          const result = await openpgp.sign({
            message: pgpMessage,
            signingKeys: [privateKey],
            format: 'armored',
          });
          signed = typeof result === 'string' ? result : await streamToString(result);
        } else {
          const binaryResult = await openpgp.sign({
            message: pgpMessage,
            signingKeys: [privateKey],
            format: 'binary',
          });
          signed = binaryResult instanceof Uint8Array
            ? binaryResult
            : await streamToUint8Array(binaryResult);
        }

        return {
          data: signed,
        };
      }
    }
  } catch (error) {
    if (error instanceof PGPError) {
      throw error;
    }
    throw new PGPError(
      ErrorCode.SIGNING_FAILED,
      `Signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Verify a signature
 */
export async function verify(options: VerifyOptions): Promise<VerificationResult[]> {
  const { message, signature, verificationKeys } = options;

  try {
    // Parse verification keys
    const publicKeys = await Promise.all(
      verificationKeys.map(async (armoredKey) => {
        const key = await readKey(armoredKey);
        return key.toPublic();
      })
    );

    const results: VerificationResult[] = [];

    if (signature) {
      // Detached signature verification
      let pgpMessage: openpgp.Message<openpgp.MaybeStream<Uint8Array | string>>;
      if (typeof message === 'string') {
        pgpMessage = await openpgp.createMessage({ text: message });
      } else {
        pgpMessage = await openpgp.createMessage({ binary: message });
      }

      let pgpSignature: openpgp.Signature;
      if (typeof signature === 'string') {
        pgpSignature = await openpgp.readSignature({ armoredSignature: signature });
      } else {
        pgpSignature = await openpgp.readSignature({ binarySignature: signature });
      }

      const verification = await openpgp.verify({
        message: pgpMessage,
        signature: pgpSignature,
        verificationKeys: publicKeys,
      });

      for (const sig of verification.signatures) {
        try {
          const verified = await sig.verified;
          const keyId = sig.keyID.toHex().toUpperCase();

          // Find signing key info
          let signedBy = undefined;
          let fingerprint = keyId;
          for (const pubKey of publicKeys) {
            const fp = pubKey.getFingerprint().toUpperCase();
            if (fp.endsWith(keyId) || keyId.endsWith(getShortKeyId(fp))) {
              signedBy = getPrimaryUserId(pubKey) ?? undefined;
              fingerprint = fp;
              break;
            }
          }

          results.push({
            valid: verified,
            keyId: getShortKeyId(keyId),
            fingerprint,
            signedBy,
          });
        } catch (error) {
          results.push({
            valid: false,
            keyId: sig.keyID.toHex().slice(-8).toUpperCase(),
            error: error instanceof Error ? error.message : 'Verification failed',
          });
        }
      }
    } else {
      // Inline/cleartext signature verification
      let verificationData: openpgp.VerifyMessageResult<openpgp.MaybeStream<openpgp.Data>>;

      if (typeof message === 'string') {
        // Try cleartext first
        if (message.includes('-----BEGIN PGP SIGNED MESSAGE-----')) {
          const cleartextMessage = await openpgp.readCleartextMessage({
            cleartextMessage: message,
          });
          verificationData = await openpgp.verify({
            message: cleartextMessage,
            verificationKeys: publicKeys,
          });
        } else {
          // Try as armored signed message
          const signedMessage = await openpgp.readMessage({ armoredMessage: message });
          verificationData = await openpgp.verify({
            message: signedMessage,
            verificationKeys: publicKeys,
          });
        }
      } else {
        const signedMessage = await openpgp.readMessage({ binaryMessage: message });
        verificationData = await openpgp.verify({
          message: signedMessage,
          verificationKeys: publicKeys,
        });
      }

      for (const sig of verificationData.signatures) {
        try {
          const verified = await sig.verified;
          const keyId = sig.keyID.toHex().toUpperCase();

          // Find signing key info
          let signedBy = undefined;
          let fingerprint = keyId;
          for (const pubKey of publicKeys) {
            const fp = pubKey.getFingerprint().toUpperCase();
            if (fp.endsWith(keyId) || keyId.endsWith(getShortKeyId(fp))) {
              signedBy = getPrimaryUserId(pubKey) ?? undefined;
              fingerprint = fp;
              break;
            }
          }

          results.push({
            valid: verified,
            keyId: getShortKeyId(keyId),
            fingerprint,
            signedBy,
          });
        } catch (error) {
          results.push({
            valid: false,
            keyId: sig.keyID.toHex().slice(-8).toUpperCase(),
            error: error instanceof Error ? error.message : 'Verification failed',
          });
        }
      }
    }

    return results;
  } catch (error) {
    if (error instanceof PGPError) {
      throw error;
    }
    throw new PGPError(
      ErrorCode.VERIFICATION_FAILED,
      `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Create a detached signature for a file
 */
export async function signFile(
  data: Uint8Array,
  signingKey: string,
  passphrase?: string
): Promise<string> {
  const result = await sign({
    message: data,
    signingKey,
    passphrase,
    detached: true,
    armor: true,
  });

  return result.signature as string;
}

/**
 * Verify a detached file signature
 */
export async function verifyFile(
  data: Uint8Array,
  signature: string,
  verificationKeys: string[]
): Promise<VerificationResult[]> {
  return verify({
    message: data,
    signature,
    verificationKeys,
  });
}

/**
 * Extract the original message from a cleartext signed message
 */
export async function extractCleartextMessage(signedMessage: string): Promise<string> {
  try {
    const message = await openpgp.readCleartextMessage({ cleartextMessage: signedMessage });
    return message.getText();
  } catch (error) {
    throw new PGPError(
      ErrorCode.INVALID_SIGNATURE,
      `Failed to extract message: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error instanceof Error ? error : undefined
    );
  }
}

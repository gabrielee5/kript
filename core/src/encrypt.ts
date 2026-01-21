/**
 * Encryption and decryption functions for Kript
 */

import * as openpgp from 'openpgp';
import {
  EncryptOptions,
  EncryptResult,
  DecryptOptions,
  DecryptResult,
  VerificationResult,
  PGPError,
  ErrorCode,
} from './types.js';
import { readKey, getPrimaryUserId } from './keys.js';

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
 * Encrypt a message or file
 */
export async function encrypt(options: EncryptOptions): Promise<EncryptResult> {
  const {
    message,
    encryptionKeys,
    signingKey,
    signingKeyPassphrase,
    armor = true,
  } = options;

  try {
    // Parse encryption keys (public keys)
    const publicKeys = await Promise.all(
      encryptionKeys.map(async (armoredKey) => {
        const key = await readKey(armoredKey);
        return key.toPublic();
      })
    );

    // Create message object
    let pgpMessage: openpgp.Message<openpgp.MaybeStream<Uint8Array | string>>;
    if (typeof message === 'string') {
      pgpMessage = await openpgp.createMessage({ text: message });
    } else {
      pgpMessage = await openpgp.createMessage({ binary: message });
    }

    // Prepare signing key if provided
    let privateKey: openpgp.PrivateKey | undefined;
    if (signingKey) {
      privateKey = await openpgp.readPrivateKey({ armoredKey: signingKey });
      if (!privateKey.isDecrypted() && signingKeyPassphrase) {
        privateKey = await openpgp.decryptKey({
          privateKey,
          passphrase: signingKeyPassphrase,
        });
      }
    }

    // Encrypt
    let encrypted: string | Uint8Array;
    if (armor) {
      const result = await openpgp.encrypt({
        message: pgpMessage,
        encryptionKeys: publicKeys,
        signingKeys: privateKey ? [privateKey] : undefined,
        format: 'armored',
      });
      // Handle stream or string result
      encrypted = typeof result === 'string' ? result : await streamToString(result);
    } else {
      const binaryResult = await openpgp.encrypt({
        message: pgpMessage,
        encryptionKeys: publicKeys,
        signingKeys: privateKey ? [privateKey] : undefined,
        format: 'binary',
      });
      // Handle stream or Uint8Array result
      encrypted = binaryResult instanceof Uint8Array
        ? binaryResult
        : await streamToUint8Array(binaryResult);
    }

    return {
      data: encrypted,
    };
  } catch (error) {
    if (error instanceof PGPError) {
      throw error;
    }
    throw new PGPError(
      ErrorCode.ENCRYPTION_FAILED,
      `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Decrypt a message or file
 */
export async function decrypt(options: DecryptOptions): Promise<DecryptResult> {
  const { message, decryptionKey, passphrase, verificationKeys = [], expectBinary } = options;

  try {
    // Determine if we should return binary based on input type or explicit flag
    const returnBinary = expectBinary ?? (message instanceof Uint8Array);

    // Read the encrypted message
    let pgpMessage: openpgp.Message<openpgp.MaybeStream<openpgp.Data>>;
    if (typeof message === 'string') {
      pgpMessage = await openpgp.readMessage({ armoredMessage: message });
    } else {
      pgpMessage = await openpgp.readMessage({ binaryMessage: message });
    }

    // Prepare decryption key
    let privateKey = await openpgp.readPrivateKey({ armoredKey: decryptionKey });
    if (!privateKey.isDecrypted()) {
      if (!passphrase) {
        throw new PGPError(ErrorCode.INVALID_PASSPHRASE, 'Passphrase required for encrypted key');
      }
      privateKey = await openpgp.decryptKey({ privateKey, passphrase });
    }

    // Parse verification keys if provided
    const publicKeys = await Promise.all(
      verificationKeys.map(async (armoredKey) => {
        const key = await readKey(armoredKey);
        return key.toPublic();
      })
    );

    // Decrypt with appropriate format
    const decrypted = returnBinary
      ? await openpgp.decrypt({
          message: pgpMessage,
          decryptionKeys: [privateKey],
          verificationKeys: publicKeys.length > 0 ? publicKeys : undefined,
          format: 'binary',
        })
      : await openpgp.decrypt({
          message: pgpMessage,
          decryptionKeys: [privateKey],
          verificationKeys: publicKeys.length > 0 ? publicKeys : undefined,
        });

    // Process verification results
    const signatures: VerificationResult[] = [];
    if (decrypted.signatures && decrypted.signatures.length > 0) {
      for (const sig of decrypted.signatures) {
        try {
          const verified = await sig.verified;
          const sigKeyId = sig.keyID.toHex().toUpperCase();

          // Find the signing key
          let signedBy = undefined;
          for (const pubKey of publicKeys) {
            const fingerprint = pubKey.getFingerprint().toUpperCase();
            if (fingerprint.endsWith(sigKeyId)) {
              signedBy = getPrimaryUserId(pubKey) ?? undefined;
              break;
            }
          }

          signatures.push({
            valid: verified,
            keyId: sigKeyId.slice(-8),
            fingerprint: sigKeyId,
            signedBy,
          });
        } catch (error) {
          signatures.push({
            valid: false,
            keyId: sig.keyID.toHex().slice(-8).toUpperCase(),
            error: error instanceof Error ? error.message : 'Verification failed',
          });
        }
      }
    }

    // Get the decrypted data - handle based on expected type
    let data: string | Uint8Array;
    if (returnBinary) {
      if (decrypted.data instanceof Uint8Array) {
        data = decrypted.data;
      } else {
        // Handle stream case for binary
        const response = new Response(decrypted.data as ReadableStream);
        data = new Uint8Array(await response.arrayBuffer());
      }
    } else {
      if (typeof decrypted.data === 'string') {
        data = decrypted.data;
      } else if (decrypted.data instanceof Uint8Array) {
        data = new TextDecoder().decode(decrypted.data);
      } else {
        // Handle stream case for text
        const response = new Response(decrypted.data as ReadableStream);
        const buffer = await response.arrayBuffer();
        data = new TextDecoder().decode(buffer);
      }
    }

    return {
      data,
      signatures,
      filename: decrypted.filename || undefined,
    };
  } catch (error) {
    if (error instanceof PGPError) {
      throw error;
    }

    // Check for specific error types
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('passphrase') || errorMessage.includes('decrypt')) {
      throw new PGPError(
        ErrorCode.INVALID_PASSPHRASE,
        'Failed to decrypt: incorrect passphrase or key',
        error instanceof Error ? error : undefined
      );
    }

    throw new PGPError(
      ErrorCode.DECRYPTION_FAILED,
      `Decryption failed: ${errorMessage}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Encrypt a file with a filename hint
 */
export async function encryptFile(
  data: Uint8Array,
  filename: string,
  encryptionKeys: string[],
  signingKey?: string,
  signingKeyPassphrase?: string
): Promise<Uint8Array> {
  try {
    // Parse encryption keys
    const publicKeys = await Promise.all(
      encryptionKeys.map(async (armoredKey) => {
        const key = await readKey(armoredKey);
        return key.toPublic();
      })
    );

    // Create message with filename
    const message = await openpgp.createMessage({
      binary: data,
      filename,
    });

    // Prepare signing key if provided
    let privateKey: openpgp.PrivateKey | undefined;
    if (signingKey) {
      privateKey = await openpgp.readPrivateKey({ armoredKey: signingKey });
      if (!privateKey.isDecrypted() && signingKeyPassphrase) {
        privateKey = await openpgp.decryptKey({
          privateKey,
          passphrase: signingKeyPassphrase,
        });
      }
    }

    // Encrypt
    const encrypted = await openpgp.encrypt({
      message,
      encryptionKeys: publicKeys,
      signingKeys: privateKey ? [privateKey] : undefined,
      format: 'binary',
    });

    return encrypted as Uint8Array;
  } catch (error) {
    if (error instanceof PGPError) {
      throw error;
    }
    throw new PGPError(
      ErrorCode.ENCRYPTION_FAILED,
      `File encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Decrypt a file
 */
export async function decryptFile(
  encryptedData: Uint8Array | string,
  decryptionKey: string,
  passphrase?: string,
  verificationKeys?: string[]
): Promise<{ data: Uint8Array; filename?: string; signatures: VerificationResult[] }> {
  const result = await decrypt({
    message: encryptedData,
    decryptionKey,
    passphrase,
    verificationKeys,
  });

  // Ensure data is Uint8Array
  let data: Uint8Array;
  if (typeof result.data === 'string') {
    data = new TextEncoder().encode(result.data);
  } else {
    data = result.data as Uint8Array;
  }

  return {
    data,
    filename: result.filename,
    signatures: result.signatures,
  };
}

/**
 * Encrypt with password (symmetric encryption)
 */
export async function encryptWithPassword(
  message: string | Uint8Array,
  password: string,
  armor = true
): Promise<string | Uint8Array> {
  try {
    let pgpMessage: openpgp.Message<openpgp.MaybeStream<Uint8Array | string>>;
    if (typeof message === 'string') {
      pgpMessage = await openpgp.createMessage({ text: message });
    } else {
      pgpMessage = await openpgp.createMessage({ binary: message });
    }

    let encrypted: string | Uint8Array;
    if (armor) {
      const result = await openpgp.encrypt({
        message: pgpMessage,
        passwords: [password],
        format: 'armored',
      });
      encrypted = typeof result === 'string' ? result : await streamToString(result);
    } else {
      const binaryResult = await openpgp.encrypt({
        message: pgpMessage,
        passwords: [password],
        format: 'binary',
      });
      encrypted = binaryResult instanceof Uint8Array
        ? binaryResult
        : await streamToUint8Array(binaryResult);
    }

    return encrypted;
  } catch (error) {
    throw new PGPError(
      ErrorCode.ENCRYPTION_FAILED,
      `Symmetric encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Decrypt with password (symmetric decryption)
 *
 * @param encrypted - The encrypted message (armored string or binary Uint8Array)
 * @param password - The password used for encryption
 * @param expectBinary - If true, always return Uint8Array. If undefined, auto-detect from input type.
 */
export async function decryptWithPassword(
  encrypted: string | Uint8Array,
  password: string,
  expectBinary?: boolean
): Promise<string | Uint8Array> {
  try {
    // Determine if we should return binary based on input type or explicit flag
    const returnBinary = expectBinary ?? (encrypted instanceof Uint8Array);

    let pgpMessage: openpgp.Message<openpgp.MaybeStream<openpgp.Data>>;
    if (typeof encrypted === 'string') {
      pgpMessage = await openpgp.readMessage({ armoredMessage: encrypted });
    } else {
      pgpMessage = await openpgp.readMessage({ binaryMessage: encrypted });
    }

    if (returnBinary) {
      // Decrypt as binary to preserve Uint8Array type
      const decrypted = await openpgp.decrypt({
        message: pgpMessage,
        passwords: [password],
        format: 'binary',
      });

      // Handle the result
      if (decrypted.data instanceof Uint8Array) {
        return decrypted.data;
      } else {
        // Handle stream case
        const response = new Response(decrypted.data as ReadableStream);
        return new Uint8Array(await response.arrayBuffer());
      }
    } else {
      // Decrypt as text (default behavior for armored messages)
      const decrypted = await openpgp.decrypt({
        message: pgpMessage,
        passwords: [password],
      });

      // Handle stream if necessary
      if (typeof decrypted.data === 'string') {
        return decrypted.data;
      } else if (decrypted.data instanceof Uint8Array) {
        return new TextDecoder().decode(decrypted.data);
      } else {
        const response = new Response(decrypted.data as ReadableStream);
        const buffer = await response.arrayBuffer();
        return new TextDecoder().decode(buffer);
      }
    }
  } catch (error) {
    throw new PGPError(
      ErrorCode.DECRYPTION_FAILED,
      `Symmetric decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error instanceof Error ? error : undefined
    );
  }
}

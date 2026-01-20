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
import { readKey, decryptPrivateKey, getPrimaryUserId } from './keys.js';
import { getShortKeyId } from './utils.js';

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
    format = 'utf8',
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
    const encrypted = await openpgp.encrypt({
      message: pgpMessage,
      encryptionKeys: publicKeys,
      signingKeys: privateKey ? [privateKey] : undefined,
      format: armor ? 'armored' : 'binary',
    });

    return {
      data: encrypted as string | Uint8Array,
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
  const { message, decryptionKey, passphrase, verificationKeys = [] } = options;

  try {
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

    // Decrypt
    const decrypted = await openpgp.decrypt({
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
            signatureTime: sig.signature.then ? undefined : new Date(),
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

    // Get the decrypted data
    const data = decrypted.data;

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

    const encrypted = await openpgp.encrypt({
      message: pgpMessage,
      passwords: [password],
      format: armor ? 'armored' : 'binary',
    });

    return encrypted as string | Uint8Array;
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
 */
export async function decryptWithPassword(
  encrypted: string | Uint8Array,
  password: string
): Promise<string | Uint8Array> {
  try {
    let pgpMessage: openpgp.Message<openpgp.MaybeStream<openpgp.Data>>;
    if (typeof encrypted === 'string') {
      pgpMessage = await openpgp.readMessage({ armoredMessage: encrypted });
    } else {
      pgpMessage = await openpgp.readMessage({ binaryMessage: encrypted });
    }

    const decrypted = await openpgp.decrypt({
      message: pgpMessage,
      passwords: [password],
    });

    return decrypted.data;
  } catch (error) {
    throw new PGPError(
      ErrorCode.DECRYPTION_FAILED,
      `Symmetric decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error instanceof Error ? error : undefined
    );
  }
}

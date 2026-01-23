/**
 * Key management functions for Kript
 */

import * as openpgp from 'openpgp';
import {
  KeyAlgorithm,
  KeyGenerationOptions,
  KeyInfo,
  KeyPair,
  KeyUsage,
  SubkeyInfo,
  UserId,
  ExportOptions,
  ImportResult,
  PGPError,
  ErrorCode,
} from './types.js';
import { getShortKeyId, withSecurePassphrase, secureClear } from './utils.js';

/**
 * Map our algorithm names to OpenPGP.js config
 */
function getAlgorithmConfig(algorithm: KeyAlgorithm): {
  type: 'rsa' | 'ecc';
  rsaBits?: number;
  curve?: openpgp.EllipticCurveName;
} {
  switch (algorithm) {
    case 'rsa2048':
      return { type: 'rsa', rsaBits: 2048 };
    case 'rsa4096':
      return { type: 'rsa', rsaBits: 4096 };
    case 'ecc':
    case 'curve25519':
      return { type: 'ecc', curve: 'curve25519' };
    default:
      return { type: 'ecc', curve: 'curve25519' };
  }
}

/**
 * Extract key usage flags from an OpenPGP key
 */
function extractKeyUsage(key: openpgp.Key): KeyUsage {
  // OpenPGP.js doesn't expose flags directly, so we check capabilities
  let canEncrypt = false;
  try {
    canEncrypt = key.getEncryptionKey(undefined, undefined, undefined) !== undefined;
  } catch {
    canEncrypt = false;
  }
  return {
    certify: true, // Primary keys can always certify
    sign: true,
    encrypt: canEncrypt,
    authenticate: false,
  };
}

/**
 * Extract key info from an OpenPGP key
 */
export async function extractKeyInfo(key: openpgp.Key): Promise<KeyInfo> {
  const keyPacket = key.keyPacket;
  const fingerprint = key.getFingerprint().toUpperCase();
  const keyId = getShortKeyId(fingerprint);

  // Get user IDs
  const userIds: UserId[] = key.users.map((user) => {
    const userId = user.userID;
    return {
      name: userId?.name ?? '',
      email: userId?.email ?? '',
      comment: userId?.comment || undefined,
    };
  });

  // Get algorithm info using numeric algorithm enum
  let algorithm = 'Unknown';
  let bitLength: number | undefined;
  let curve: string | undefined;

  const algoNum = keyPacket.algorithm;
  const publicParams = (keyPacket as { publicParams?: { n?: Uint8Array; oid?: unknown } }).publicParams;

  // RSA algorithms: 1 = rsaEncryptSign, 2 = rsaEncrypt, 3 = rsaSign
  if (algoNum === 1 || algoNum === 2 || algoNum === 3) {
    if (publicParams?.n) {
      bitLength = publicParams.n.length * 8;
    }
    algorithm = bitLength ? `RSA-${bitLength}` : 'RSA';
  } else if (algoNum >= 18) {
    // ECC algorithms: 18 = ecdh, 19 = ecdsa, 22 = eddsa/ed25519Legacy, 25 = x25519, 27 = ed25519
    curve = 'curve25519';
    algorithm = 'ECC (Curve25519)';
  }

  // Get expiration
  const expirationTime = await key.getExpirationTime();
  const expiration =
    expirationTime && expirationTime !== Infinity ? new Date(expirationTime) : undefined;

  // Check revocation
  const revoked = await key.isRevoked();

  // Get subkeys
  const subkeys: SubkeyInfo[] = await Promise.all(
    key.subkeys.map(async (subkey) => {
      const subFingerprint = subkey.getFingerprint().toUpperCase();
      const subKeyPacket = subkey.keyPacket;

      let subAlgorithm = 'Unknown';
      let subBitLength: number | undefined;
      let subCurve: string | undefined;

      const subAlgoNum = subKeyPacket.algorithm;
      const subPublicParams = (subKeyPacket as { publicParams?: { n?: Uint8Array; oid?: unknown } }).publicParams;

      // RSA algorithms: 1 = rsaEncryptSign, 2 = rsaEncrypt, 3 = rsaSign
      if (subAlgoNum === 1 || subAlgoNum === 2 || subAlgoNum === 3) {
        if (subPublicParams?.n) {
          subBitLength = subPublicParams.n.length * 8;
        }
        subAlgorithm = subBitLength ? `RSA-${subBitLength}` : 'RSA';
      } else if (subAlgoNum >= 18) {
        // ECC algorithms
        subCurve = 'curve25519';
        subAlgorithm = 'ECC (Curve25519)';
      }

      const subExpiration = await subkey.getExpirationTime();

      return {
        keyId: getShortKeyId(subFingerprint),
        fingerprint: subFingerprint,
        algorithm: subAlgorithm,
        bitLength: subBitLength,
        curve: subCurve,
        creationTime: subKeyPacket.created,
        expirationTime: subExpiration && subExpiration !== Infinity ? new Date(subExpiration) : undefined,
        usage: {
          certify: false,
          sign: false,
          encrypt: true,
          authenticate: false,
        },
        revoked: false, // Subkey revocation check simplified
      };
    })
  );

  return {
    keyId,
    fingerprint,
    algorithm,
    bitLength,
    curve,
    creationTime: keyPacket.created,
    expirationTime: expiration,
    userIds,
    usage: extractKeyUsage(key),
    revoked,
    isPrivate: key.isPrivate(),
    subkeys,
  };
}

/**
 * Generate a new PGP key pair
 */
export async function generateKeyPair(options: KeyGenerationOptions): Promise<KeyPair> {
  const { algorithm, userIds, passphrase, expirationTime } = options;
  const algoConfig = getAlgorithmConfig(algorithm);

  // Save original config for restoration
  const originalComment = openpgp.config.commentString;
  const originalShowComment = openpgp.config.showComment;

  try {
    // Set Kript branding in armor headers
    openpgp.config.commentString = 'Generated with Kript.xyz';
    openpgp.config.showComment = true;

    const { privateKey, publicKey, revocationCertificate } = await openpgp.generateKey({
      type: algoConfig.type,
      rsaBits: algoConfig.rsaBits,
      curve: algoConfig.curve,
      userIDs: userIds.map((uid) => ({
        name: uid.name,
        email: uid.email,
        comment: uid.comment,
      })),
      passphrase: passphrase || undefined,
      keyExpirationTime: expirationTime,
      format: 'armored',
    });

    // Parse the generated key to extract info
    const parsedKey = await openpgp.readKey({ armoredKey: privateKey });
    const keyInfo = await extractKeyInfo(parsedKey);

    return {
      publicKey,
      privateKey,
      revocationCertificate,
      keyInfo,
    };
  } catch (error) {
    throw new PGPError(
      ErrorCode.ENCRYPTION_FAILED,
      `Failed to generate key pair: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error instanceof Error ? error : undefined
    );
  } finally {
    // Always restore original config
    openpgp.config.commentString = originalComment;
    openpgp.config.showComment = originalShowComment;
  }
}

/**
 * Read and parse an armored key
 */
export async function readKey(armoredKey: string): Promise<openpgp.Key> {
  try {
    // Try reading as public key first
    const key = await openpgp.readKey({ armoredKey });
    return key;
  } catch {
    // Try as private key
    try {
      const privateKey = await openpgp.readPrivateKey({ armoredKey });
      return privateKey;
    } catch (error) {
      throw new PGPError(
        ErrorCode.INVALID_KEY,
        `Failed to parse key: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }
}

/**
 * Read multiple keys from armored text
 */
export async function readKeys(armoredKeys: string): Promise<openpgp.Key[]> {
  try {
    const keys = await openpgp.readKeys({ armoredKeys });
    return keys;
  } catch {
    // Try reading as single key
    try {
      const key = await readKey(armoredKeys);
      return [key];
    } catch (error) {
      throw new PGPError(
        ErrorCode.INVALID_KEY,
        `Failed to parse keys: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }
}

/**
 * Import keys from armored text
 */
export async function importKeys(armoredKeys: string): Promise<ImportResult> {
  const result: ImportResult = {
    keys: [],
    errors: [],
  };

  try {
    const keys = await readKeys(armoredKeys);

    for (const key of keys) {
      try {
        const keyInfo = await extractKeyInfo(key);
        result.keys.push(keyInfo);
      } catch (error) {
        result.errors.push(
          `Failed to extract info from key: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  } catch (error) {
    result.errors.push(
      `Failed to parse keys: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  return result;
}

/**
 * Export a key in armored format
 */
export async function exportKey(
  key: openpgp.Key,
  options: ExportOptions = {}
): Promise<string> {
  const { includePrivate = false, passphrase } = options;

  try {
    if (includePrivate && key.isPrivate()) {
      if (passphrase) {
        // Decrypt with passphrase first if needed, then re-encrypt
        let decryptedKey = key;
        if (!key.isDecrypted()) {
          decryptedKey = await openpgp.decryptKey({
            privateKey: key as openpgp.PrivateKey,
            passphrase,
          });
        }
        const encrypted = await openpgp.encryptKey({
          privateKey: decryptedKey as openpgp.PrivateKey,
          passphrase,
        });
        return encrypted.armor();
      }
      return key.armor();
    }

    // Export public key only
    return key.toPublic().armor();
  } catch (error) {
    throw new PGPError(
      ErrorCode.INVALID_KEY,
      `Failed to export key: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Decrypt a private key with passphrase
 * Uses secure passphrase handling to clear the passphrase from memory after use
 */
export async function decryptPrivateKey(
  armoredKey: string,
  passphrase: string
): Promise<openpgp.PrivateKey> {
  return withSecurePassphrase(passphrase, async (securePass) => {
    try {
      const key = await openpgp.readPrivateKey({ armoredKey });
      const decrypted = await openpgp.decryptKey({
        privateKey: key,
        passphrase: securePass,
      });
      return decrypted;
    } catch (error) {
      if (error instanceof Error && error.message.includes('passphrase')) {
        throw new PGPError(ErrorCode.INVALID_PASSPHRASE, 'Incorrect passphrase');
      }
      throw new PGPError(
        ErrorCode.INVALID_KEY,
        `Failed to decrypt key: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  });
}

/**
 * Change the passphrase of a private key
 * Uses secure passphrase handling to clear passphrases from memory after use
 */
export async function changePassphrase(
  armoredKey: string,
  oldPassphrase: string,
  newPassphrase: string
): Promise<string> {
  try {
    // decryptPrivateKey already handles oldPassphrase securely
    const decrypted = await decryptPrivateKey(armoredKey, oldPassphrase);

    // Use withSecurePassphrase for the new passphrase
    return await withSecurePassphrase(newPassphrase, async (secureNewPass) => {
      const encrypted = await openpgp.encryptKey({
        privateKey: decrypted,
        passphrase: secureNewPass,
      });
      return encrypted.armor();
    });
  } catch (error) {
    if (error instanceof PGPError) {
      throw error;
    }
    throw new PGPError(
      ErrorCode.INVALID_KEY,
      `Failed to change passphrase: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error instanceof Error ? error : undefined
    );
  } finally {
    // Attempt to clear original passphrase strings
    secureClear(oldPassphrase);
    secureClear(newPassphrase);
  }
}

/**
 * Generate a revocation certificate for a key
 * Uses secure passphrase handling to clear the passphrase from memory after use
 */
export async function generateRevocationCertificate(
  armoredPrivateKey: string,
  passphrase?: string,
  reason?: string
): Promise<string> {
  const doRevoke = async (securePass?: string): Promise<string> => {
    try {
      let privateKey = await openpgp.readPrivateKey({ armoredKey: armoredPrivateKey });

      if (!privateKey.isDecrypted() && securePass) {
        privateKey = await openpgp.decryptKey({ privateKey, passphrase: securePass });
      }

      const { publicKey: revokedKey } = await openpgp.revokeKey({
        key: privateKey,
        reasonForRevocation: {
          flag: openpgp.enums.reasonForRevocation.noReason,
          string: reason || 'Key revoked',
        },
      });

      // revokeKey returns a string in format: 'armored'
      return revokedKey as string;
    } catch (error) {
      throw new PGPError(
        ErrorCode.INVALID_KEY,
        `Failed to generate revocation certificate: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  };

  if (passphrase) {
    return withSecurePassphrase(passphrase, doRevoke);
  }
  return doRevoke();
}

/**
 * Check if a key is valid (not expired, not revoked)
 */
export async function validateKey(key: openpgp.Key): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  // Check revocation
  if (await key.isRevoked()) {
    errors.push('Key has been revoked');
  }

  // Check expiration
  const expiration = await key.getExpirationTime();
  if (expiration && expiration !== Infinity && new Date(expiration) < new Date()) {
    errors.push('Key has expired');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get the primary user ID from a key
 */
export function getPrimaryUserId(key: openpgp.Key): UserId | null {
  const primaryUser = key.users[0];
  if (!primaryUser?.userID) {
    return null;
  }

  return {
    name: primaryUser.userID.name ?? '',
    email: primaryUser.userID.email ?? '',
    comment: primaryUser.userID.comment || undefined,
  };
}

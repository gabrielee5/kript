/**
 * LocalPGP Basic Usage Examples
 *
 * This file demonstrates common use cases for the LocalPGP library.
 * Run with: npx ts-node examples/basic-usage.ts
 */

import {
  generateKeyPair,
  encrypt,
  decrypt,
  sign,
  verify,
  Keyring,
  MemoryStorageAdapter,
} from '@localpgp/core';

async function main() {
  console.log('=== LocalPGP Basic Usage Examples ===\n');

  // 1. Generate Key Pairs
  console.log('1. Generating key pairs...');

  const aliceKeys = await generateKeyPair({
    algorithm: 'curve25519',
    userIds: [{ name: 'Alice', email: 'alice@example.com' }],
    passphrase: 'alice-secret-passphrase',
    expirationTime: 365 * 24 * 60 * 60, // 1 year
  });
  console.log(`   Alice's key ID: ${aliceKeys.keyInfo.keyId}`);

  const bobKeys = await generateKeyPair({
    algorithm: 'curve25519',
    userIds: [{ name: 'Bob', email: 'bob@example.com' }],
    passphrase: 'bob-secret-passphrase',
  });
  console.log(`   Bob's key ID: ${bobKeys.keyInfo.keyId}`);

  // 2. Encrypt a message from Alice to Bob
  console.log('\n2. Encrypting a message from Alice to Bob...');

  const secretMessage = 'Hello Bob! This is a secret message from Alice.';

  const encryptedResult = await encrypt({
    message: secretMessage,
    encryptionKeys: [bobKeys.publicKey],
    signingKey: aliceKeys.privateKey,
    signingKeyPassphrase: 'alice-secret-passphrase',
  });

  console.log('   Encrypted message (truncated):');
  console.log(`   ${(encryptedResult.data as string).substring(0, 100)}...`);

  // 3. Bob decrypts the message
  console.log('\n3. Bob decrypts the message...');

  const decryptedResult = await decrypt({
    message: encryptedResult.data,
    decryptionKey: bobKeys.privateKey,
    passphrase: 'bob-secret-passphrase',
    verificationKeys: [aliceKeys.publicKey],
  });

  console.log(`   Decrypted message: ${decryptedResult.data}`);
  console.log(`   Signature valid: ${decryptedResult.signatures[0]?.valid}`);

  // 4. Sign a message
  console.log('\n4. Signing a message...');

  const messageToSign = 'This document is officially signed by Alice.';

  const signedResult = await sign({
    message: messageToSign,
    signingKey: aliceKeys.privateKey,
    passphrase: 'alice-secret-passphrase',
    detached: false,
  });

  console.log('   Signed message (truncated):');
  console.log(`   ${(signedResult.data as string).substring(0, 100)}...`);

  // 5. Verify the signature
  console.log('\n5. Verifying the signature...');

  const verifyResult = await verify({
    message: signedResult.data as string,
    verificationKeys: [aliceKeys.publicKey],
  });

  console.log(`   Signature valid: ${verifyResult[0]?.valid}`);
  console.log(`   Signed by: ${verifyResult[0]?.signedBy?.email}`);

  // 6. Using the Keyring
  console.log('\n6. Using the Keyring...');

  const storage = new MemoryStorageAdapter();
  const keyring = new Keyring(storage);

  await keyring.addKey(aliceKeys.publicKey, aliceKeys.privateKey);
  await keyring.addKey(bobKeys.publicKey, bobKeys.privateKey);

  const allKeys = await keyring.getAllKeys();
  console.log(`   Keys in keyring: ${allKeys.length}`);

  const searchResults = await keyring.searchKeys('alice');
  console.log(`   Found keys matching 'alice': ${searchResults.length}`);

  const stats = await keyring.getStats();
  console.log(`   Keyring stats: ${stats.totalKeys} total, ${stats.privateKeys} private`);

  console.log('\n=== Examples completed successfully! ===');
}

main().catch(console.error);

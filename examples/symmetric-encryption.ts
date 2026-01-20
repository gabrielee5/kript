/**
 * Kript Symmetric (Password) Encryption Example
 *
 * This example demonstrates encrypting with a password instead of public keys.
 */

import { encryptWithPassword, decryptWithPassword } from '@kript/core';

async function main() {
  console.log('=== Symmetric Encryption Example ===\n');

  const password = 'my-super-secret-password';
  const message = 'This message is encrypted with a password, not a public key.';

  console.log('Original message:');
  console.log(`  "${message}"`);

  // Encrypt with password
  console.log('\nEncrypting with password...');
  const encrypted = await encryptWithPassword(message, password, true);

  console.log('Encrypted (ASCII armor):');
  console.log((encrypted as string).substring(0, 150) + '...');

  // Decrypt with password
  console.log('\nDecrypting with password...');
  const decrypted = await decryptWithPassword(encrypted as string, password);

  console.log('Decrypted message:');
  console.log(`  "${decrypted}"`);

  // Try with wrong password
  console.log('\nTrying to decrypt with wrong password...');
  try {
    await decryptWithPassword(encrypted as string, 'wrong-password');
    console.log('  ERROR: Should have thrown!');
  } catch (error) {
    console.log('  Correctly rejected wrong password!');
  }

  // Binary data example
  console.log('\n--- Binary Data Example ---');

  const binaryData = new Uint8Array([0, 1, 2, 3, 255, 254, 253, 128, 64, 32]);
  console.log(`Original binary: [${Array.from(binaryData).join(', ')}]`);

  const encryptedBinary = await encryptWithPassword(binaryData, password, false);
  console.log(`Encrypted length: ${(encryptedBinary as Uint8Array).length} bytes`);

  const decryptedBinary = await decryptWithPassword(encryptedBinary, password);
  console.log(`Decrypted binary: [${Array.from(decryptedBinary as Uint8Array).join(', ')}]`);

  console.log('\n=== Symmetric encryption example completed! ===');
}

main().catch(console.error);

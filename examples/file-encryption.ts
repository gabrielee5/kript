/**
 * LocalPGP File Encryption Example
 *
 * This example demonstrates encrypting and decrypting files.
 */

import { generateKeyPair, encryptFile, decryptFile } from '@localpgp/core';

async function main() {
  console.log('=== File Encryption Example ===\n');

  // Generate a key pair
  console.log('Generating key pair...');
  const keys = await generateKeyPair({
    algorithm: 'curve25519',
    userIds: [{ name: 'File User', email: 'files@example.com' }],
    passphrase: 'file-passphrase',
  });

  // Simulate file content
  const fileContent = new TextEncoder().encode(
    'This is the content of a sensitive file.\n' +
    'It contains multiple lines.\n' +
    'And should be encrypted securely.'
  );
  const fileName = 'sensitive-document.txt';

  console.log(`Original file: ${fileName}`);
  console.log(`Original size: ${fileContent.length} bytes`);

  // Encrypt the file
  console.log('\nEncrypting file...');
  const encryptedData = await encryptFile(
    fileContent,
    fileName,
    [keys.publicKey],
    keys.privateKey,
    'file-passphrase'
  );

  console.log(`Encrypted size: ${encryptedData.length} bytes`);

  // Decrypt the file
  console.log('\nDecrypting file...');
  const decrypted = await decryptFile(
    encryptedData,
    keys.privateKey,
    'file-passphrase',
    [keys.publicKey]
  );

  console.log(`Decrypted filename: ${decrypted.filename}`);
  console.log(`Decrypted size: ${decrypted.data.length} bytes`);
  console.log(`Signature valid: ${decrypted.signatures[0]?.valid}`);

  // Verify content matches
  const decryptedText = new TextDecoder().decode(decrypted.data);
  const originalText = new TextDecoder().decode(fileContent);
  console.log(`\nContent matches: ${decryptedText === originalText}`);

  console.log('\n=== File encryption example completed! ===');
}

main().catch(console.error);

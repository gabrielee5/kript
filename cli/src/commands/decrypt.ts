/**
 * Decrypt command
 */

import { Command } from 'commander';
import { resolve } from 'node:path';
import chalk from 'chalk';
import {
  decrypt,
  decryptFile,
  decryptWithPassword,
  Keyring,
} from '@kript/core';
import { FileStorageAdapter, readFileBinary, readFileContent, writeFileContent, writeFileBinary, fileExists } from '../storage.js';
import {
  createSpinner,
  success,
  error,
  info,
  warning,
  promptSelect,
  promptPassphrase,
  readStdin,
  hasStdin,
} from '../utils.js';

export function createDecryptCommand(): Command {
  const cmd = new Command('decrypt')
    .alias('dec')
    .description('Decrypt a message or file')
    .argument('[file]', 'File to decrypt (omit to read from stdin)')
    .option('-o, --output <file>', 'Output file')
    .option('-k, --key <keyid>', 'Decryption key ID')
    .option('-c, --symmetric', 'Use symmetric decryption with password')
    .action(async (file, options) => {
      try {
        const storage = new FileStorageAdapter();
        const keyring = new Keyring(storage);
        await keyring.load();

        // Determine input
        let inputData: string | Uint8Array;

        if (file) {
          const filePath = resolve(file as string);
          if (!(await fileExists(filePath))) {
            error(`File not found: ${filePath}`);
            process.exit(1);
          }
          // Try to read as text first
          try {
            inputData = await readFileContent(filePath);
            // Check if it's actually armored PGP
            if (!inputData.includes('-----BEGIN PGP')) {
              inputData = await readFileBinary(filePath);
            }
          } catch {
            inputData = await readFileBinary(filePath);
          }
        } else if (hasStdin()) {
          inputData = await readStdin();
        } else {
          error('No input provided. Specify a file or pipe data to stdin.');
          process.exit(1);
        }

        // Symmetric decryption
        if (options.symmetric) {
          const password = await promptPassphrase('Enter decryption password:');

          const spinner = createSpinner('Decrypting...');
          spinner.start();

          const decrypted = await decryptWithPassword(inputData, password);

          spinner.stop();

          // Output
          if (options.output) {
            const outputPath = resolve(options.output as string);
            if (typeof decrypted === 'string') {
              await writeFileContent(outputPath, decrypted);
            } else {
              await writeFileBinary(outputPath, decrypted as Uint8Array);
            }
            success(`Decrypted output written to: ${outputPath}`);
          } else {
            console.log(decrypted);
          }

          return;
        }

        // Get decryption key
        let keyId = options.key as string | undefined;

        if (!keyId) {
          const privateKeys = await keyring.getPrivateKeys();
          if (privateKeys.length === 0) {
            error('No private keys in keyring. Import or generate a key first.');
            process.exit(1);
          }

          if (privateKeys.length === 1) {
            keyId = privateKeys[0]!.fingerprint;
          } else {
            keyId = await promptSelect('Decrypt with:',
              privateKeys.map((entry) => ({
                name: `${entry.keyInfo.userIds[0]?.email || 'Unknown'} (${entry.keyId})`,
                value: entry.fingerprint,
              }))
            );
          }
        }

        const keyEntry = await keyring.getKey(keyId);
        if (!keyEntry?.privateKey) {
          error(`Private key not found: ${keyId}`);
          process.exit(1);
        }

        // Get passphrase
        const passphrase = await promptPassphrase('Enter passphrase:');

        // Get verification keys
        const allKeys = await keyring.getAllKeys();
        const verificationKeys = allKeys.map((entry) => entry.publicKey);

        // Decrypt
        const spinner = createSpinner('Decrypting...');
        spinner.start();

        const result = await decrypt({
          message: inputData,
          decryptionKey: keyEntry.privateKey,
          passphrase,
          verificationKeys,
        });

        spinner.stop();

        // Show signature verification results
        if (result.signatures.length > 0) {
          console.log();
          for (const sig of result.signatures) {
            if (sig.valid) {
              success(
                `Signature verified from ${sig.signedBy?.email || sig.keyId}`
              );
            } else {
              warning(
                `Signature verification failed: ${sig.error || 'Unknown signer'}`
              );
            }
          }
          console.log();
        }

        // Output
        const data = result.data;
        if (options.output) {
          const outputPath = resolve(options.output as string);
          if (typeof data === 'string') {
            await writeFileContent(outputPath, data);
          } else {
            await writeFileBinary(outputPath, data as Uint8Array);
          }
          success(`Decrypted output written to: ${outputPath}`);
          if (result.filename) {
            info(`Original filename: ${result.filename}`);
          }
        } else {
          if (typeof data === 'string') {
            console.log(data);
          } else {
            process.stdout.write(data as Uint8Array);
          }
        }
      } catch (err) {
        error(err instanceof Error ? err.message : 'Decryption failed');
        process.exit(1);
      }
    });

  return cmd;
}

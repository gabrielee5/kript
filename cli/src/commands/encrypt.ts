/**
 * Encrypt command
 */

import { Command } from 'commander';
import { resolve } from 'node:path';
import {
  encrypt,
  encryptFile,
  encryptWithPassword,
  Keyring,
} from '@localpgp/core';
import { FileStorageAdapter, readFileBinary, writeFileContent, writeFileBinary, fileExists } from '../storage.js';
import {
  createSpinner,
  success,
  error,
  info,
  promptSelect,
  promptPassphrase,
  readStdin,
  hasStdin,
  formatKeyInfo,
} from '../utils.js';

export function createEncryptCommand(): Command {
  const cmd = new Command('encrypt')
    .alias('enc')
    .description('Encrypt a message or file')
    .argument('[file]', 'File to encrypt (omit to read from stdin)')
    .option('-r, --recipient <keyid>', 'Recipient key ID or fingerprint (can be used multiple times)', collectOptions, [])
    .option('-o, --output <file>', 'Output file')
    .option('-a, --armor', 'Output ASCII armored text', true)
    .option('--binary', 'Output binary format')
    .option('-s, --sign', 'Sign the message')
    .option('--sign-key <keyid>', 'Key ID to sign with')
    .option('-c, --symmetric', 'Use symmetric encryption with password')
    .action(async (file, options) => {
      try {
        const storage = new FileStorageAdapter();
        const keyring = new Keyring(storage);
        await keyring.load();

        // Determine input
        let inputData: string | Uint8Array;
        let inputFilename: string | undefined;

        if (file) {
          const filePath = resolve(file as string);
          if (!(await fileExists(filePath))) {
            error(`File not found: ${filePath}`);
            process.exit(1);
          }
          inputData = await readFileBinary(filePath);
          inputFilename = file as string;
        } else if (hasStdin()) {
          inputData = await readStdin();
        } else {
          error('No input provided. Specify a file or pipe data to stdin.');
          process.exit(1);
        }

        // Symmetric encryption
        if (options.symmetric) {
          const password = await promptPassphrase('Enter encryption password:');
          const confirmPassword = await promptPassphrase('Confirm password:');

          if (password !== confirmPassword) {
            error('Passwords do not match');
            process.exit(1);
          }

          const spinner = createSpinner('Encrypting...');
          spinner.start();

          const encrypted = await encryptWithPassword(
            inputData,
            password,
            !options.binary
          );

          spinner.stop();

          // Output
          if (options.output) {
            const outputPath = resolve(options.output as string);
            if (typeof encrypted === 'string') {
              await writeFileContent(outputPath, encrypted);
            } else {
              await writeFileBinary(outputPath, encrypted);
            }
            success(`Encrypted output written to: ${outputPath}`);
          } else {
            console.log(encrypted);
          }

          return;
        }

        // Get recipient keys
        let recipientKeyIds = options.recipient as string[];

        if (recipientKeyIds.length === 0) {
          // Interactive selection
          const allKeys = await keyring.getAllKeys();
          if (allKeys.length === 0) {
            error('No keys in keyring. Import or generate a key first.');
            process.exit(1);
          }

          info('Select recipient(s):');
          const selected = await promptSelect('Encrypt to:',
            allKeys.map((entry) => ({
              name: `${entry.keyInfo.userIds[0]?.email || 'Unknown'} (${entry.keyId})`,
              value: entry.fingerprint,
            }))
          );
          recipientKeyIds = [selected];
        }

        // Resolve recipient keys
        const recipientKeys: string[] = [];
        for (const keyId of recipientKeyIds) {
          const entry = await keyring.getKey(keyId);
          if (!entry) {
            error(`Key not found: ${keyId}`);
            process.exit(1);
          }
          recipientKeys.push(entry.publicKey);
        }

        // Signing key
        let signingKey: string | undefined;
        let signingPassphrase: string | undefined;

        if (options.sign || options.signKey) {
          let signKeyId = options.signKey as string | undefined;

          if (!signKeyId) {
            const privateKeys = await keyring.getPrivateKeys();
            if (privateKeys.length === 0) {
              error('No private keys available for signing');
              process.exit(1);
            }

            signKeyId = await promptSelect('Sign with:',
              privateKeys.map((entry) => ({
                name: `${entry.keyInfo.userIds[0]?.email || 'Unknown'} (${entry.keyId})`,
                value: entry.fingerprint,
              }))
            );
          }

          const signEntry = await keyring.getKey(signKeyId);
          if (!signEntry?.privateKey) {
            error(`Private key not found: ${signKeyId}`);
            process.exit(1);
          }

          signingKey = signEntry.privateKey;
          signingPassphrase = await promptPassphrase('Enter passphrase for signing key:');
        }

        // Encrypt
        const spinner = createSpinner('Encrypting...');
        spinner.start();

        let result: string | Uint8Array;

        if (inputFilename && inputData instanceof Uint8Array) {
          result = await encryptFile(
            inputData,
            inputFilename,
            recipientKeys,
            signingKey,
            signingPassphrase
          );
        } else {
          const encResult = await encrypt({
            message: inputData,
            encryptionKeys: recipientKeys,
            signingKey,
            signingKeyPassphrase: signingPassphrase,
            armor: !options.binary,
          });
          result = encResult.data;
        }

        spinner.stop();

        // Output
        if (options.output) {
          const outputPath = resolve(options.output as string);
          if (typeof result === 'string') {
            await writeFileContent(outputPath, result);
          } else {
            await writeFileBinary(outputPath, result);
          }
          success(`Encrypted output written to: ${outputPath}`);
        } else {
          if (result instanceof Uint8Array) {
            process.stdout.write(result);
          } else {
            console.log(result);
          }
        }
      } catch (err) {
        error(err instanceof Error ? err.message : 'Encryption failed');
        process.exit(1);
      }
    });

  return cmd;
}

function collectOptions(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

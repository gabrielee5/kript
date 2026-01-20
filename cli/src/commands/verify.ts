/**
 * Verify command
 */

import { Command } from 'commander';
import { resolve } from 'node:path';
import chalk from 'chalk';
import { verify, extractCleartextMessage, Keyring } from '@kript/core';
import { FileStorageAdapter, readFileBinary, readFileContent, fileExists } from '../storage.js';
import {
  createSpinner,
  success,
  error,
  readStdin,
  hasStdin,
} from '../utils.js';

export function createVerifyCommand(): Command {
  const cmd = new Command('verify')
    .description('Verify a signature')
    .argument('[file]', 'Signed file or message (omit to read from stdin)')
    .option('-s, --signature <file>', 'Detached signature file')
    .option('--show-message', 'Display the signed message content')
    .action(async (file, options) => {
      try {
        const storage = new FileStorageAdapter();
        const keyring = new Keyring(storage);
        await keyring.load();

        // Get verification keys
        const allKeys = await keyring.getAllKeys();
        if (allKeys.length === 0) {
          error('No keys in keyring. Import keys first.');
          process.exit(1);
        }
        const verificationKeys = allKeys.map((entry) => entry.publicKey);

        // Determine input
        let inputData: string | Uint8Array;
        let signatureData: string | undefined;

        if (file) {
          const filePath = resolve(file as string);
          if (!(await fileExists(filePath))) {
            error(`File not found: ${filePath}`);
            process.exit(1);
          }

          // Check for detached signature
          if (options.signature) {
            const sigPath = resolve(options.signature as string);
            if (!(await fileExists(sigPath))) {
              error(`Signature file not found: ${sigPath}`);
              process.exit(1);
            }
            inputData = await readFileBinary(filePath);
            signatureData = await readFileContent(sigPath);
          } else {
            // Try to read as text first (for cleartext signatures)
            try {
              inputData = await readFileContent(filePath);
            } catch {
              inputData = await readFileBinary(filePath);
            }
          }
        } else if (hasStdin()) {
          inputData = await readStdin();
        } else {
          error('No input provided. Specify a file or pipe data to stdin.');
          process.exit(1);
        }

        // Verify
        const spinner = createSpinner('Verifying signature...');
        spinner.start();

        let results;
        if (signatureData) {
          // Detached signature
          results = await verify({
            message: inputData,
            signature: signatureData,
            verificationKeys,
          });
        } else {
          // Inline or cleartext signature
          results = await verify({
            message: inputData,
            verificationKeys,
          });
        }

        spinner.stop();

        // Display results
        console.log();
        let allValid = true;

        for (const result of results) {
          if (result.valid) {
            console.log(
              chalk.green('✓'),
              chalk.bold('Good signature from:')
            );
            if (result.signedBy) {
              console.log(
                `  ${result.signedBy.name} <${result.signedBy.email}>`
              );
            }
            console.log(`  Key ID: ${result.keyId}`);
            if (result.fingerprint) {
              console.log(`  Fingerprint: ${result.fingerprint}`);
            }
            if (result.signatureTime) {
              console.log(`  Signed at: ${result.signatureTime.toISOString()}`);
            }
          } else {
            allValid = false;
            console.log(
              chalk.red('✗'),
              chalk.bold('Bad signature:')
            );
            console.log(`  Key ID: ${result.keyId}`);
            if (result.error) {
              console.log(`  Error: ${result.error}`);
            }
          }
          console.log();
        }

        // Show message content if requested
        if (options.showMessage && typeof inputData === 'string') {
          if (inputData.includes('-----BEGIN PGP SIGNED MESSAGE-----')) {
            try {
              const message = await extractCleartextMessage(inputData);
              console.log(chalk.gray('─'.repeat(60)));
              console.log(chalk.bold('Message content:'));
              console.log(chalk.gray('─'.repeat(60)));
              console.log(message);
              console.log(chalk.gray('─'.repeat(60)));
            } catch {
              // Ignore extraction errors
            }
          }
        }

        if (allValid) {
          success('All signatures verified successfully');
        } else {
          error('One or more signatures failed verification');
          process.exit(1);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : 'Verification failed');
        process.exit(1);
      }
    });

  return cmd;
}

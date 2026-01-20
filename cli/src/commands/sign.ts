/**
 * Sign command
 */

import { Command } from 'commander';
import { resolve } from 'node:path';
import { sign, signFile, Keyring } from '@kript/core';
import { FileStorageAdapter, readFileBinary, readFileContent, writeFileContent, fileExists } from '../storage.js';
import {
  createSpinner,
  success,
  error,
  promptSelect,
  promptPassphrase,
  readStdin,
  hasStdin,
} from '../utils.js';

export function createSignCommand(): Command {
  const cmd = new Command('sign')
    .description('Sign a message or file')
    .argument('[file]', 'File to sign (omit to read from stdin)')
    .option('-o, --output <file>', 'Output file')
    .option('-k, --key <keyid>', 'Signing key ID')
    .option('-d, --detached', 'Create detached signature')
    .option('-a, --armor', 'Output ASCII armored text', true)
    .option('--binary', 'Output binary format')
    .action(async (file, options) => {
      try {
        const storage = new FileStorageAdapter();
        const keyring = new Keyring(storage);
        await keyring.load();

        // Determine input
        let inputData: string | Uint8Array;
        let isFile = false;

        if (file) {
          const filePath = resolve(file as string);
          if (!(await fileExists(filePath))) {
            error(`File not found: ${filePath}`);
            process.exit(1);
          }
          inputData = await readFileBinary(filePath);
          isFile = true;
        } else if (hasStdin()) {
          inputData = await readStdin();
        } else {
          error('No input provided. Specify a file or pipe data to stdin.');
          process.exit(1);
        }

        // Get signing key
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
            keyId = await promptSelect('Sign with:',
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

        // Sign
        const spinner = createSpinner('Signing...');
        spinner.start();

        let result: string;

        if (options.detached && isFile && inputData instanceof Uint8Array) {
          // Detached file signature
          result = await signFile(inputData, keyEntry.privateKey, passphrase);
        } else {
          // Inline or cleartext signature
          const signResult = await sign({
            message: inputData,
            signingKey: keyEntry.privateKey,
            passphrase,
            detached: options.detached,
            armor: !options.binary,
          });

          if (options.detached) {
            result = signResult.signature as string;
          } else {
            result = signResult.data as string;
          }
        }

        spinner.stop();

        // Output
        if (options.output) {
          const outputPath = resolve(options.output as string);
          await writeFileContent(outputPath, result);
          success(`Signature written to: ${outputPath}`);
        } else {
          console.log(result);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : 'Signing failed');
        process.exit(1);
      }
    });

  return cmd;
}

/**
 * Key management commands
 */

import { Command } from 'commander';
import { resolve } from 'node:path';
import chalk from 'chalk';
import {
  Keyring,
  importKeys,
  generateRevocationCertificate,
  readKey,
  exportKeyBinary,
} from '@kript/core';
import { FileStorageAdapter, readFileContent, writeFileContent, writeFileBinary, fileExists } from '../storage.js';
import {
  createSpinner,
  success,
  error,
  warning,
  info,
  formatKeyInfo,
  header,
  promptPassphrase,
  confirm,
  readStdin,
  hasStdin,
} from '../utils.js';

/**
 * List keys command
 */
export function createListKeysCommand(): Command {
  return new Command('list-keys')
    .alias('list')
    .alias('ls')
    .description('List all keys in the keyring')
    .option('-v, --verbose', 'Show detailed key information')
    .option('--public', 'Show only public keys')
    .option('--private', 'Show only private keys')
    .action(async (options) => {
      try {
        const storage = new FileStorageAdapter();
        const keyring = new Keyring(storage);
        await keyring.load();

        let keys = await keyring.getAllKeys();

        if (options.public && !options.private) {
          keys = keys.filter((k) => !k.privateKey);
        } else if (options.private && !options.public) {
          keys = keys.filter((k) => k.privateKey);
        }

        if (keys.length === 0) {
          info('No keys in keyring');
          return;
        }

        header(`Keyring (${keys.length} keys)`);

        for (const entry of keys) {
          console.log(formatKeyInfo(entry.keyInfo, options.verbose));
          console.log();
        }

        // Show stats
        const stats = await keyring.getStats();
        console.log(chalk.gray(`${stats.publicKeys} public, ${stats.privateKeys} private`));
        if (stats.expiredKeys > 0) {
          warning(`${stats.expiredKeys} expired key(s)`);
        }
        if (stats.revokedKeys > 0) {
          warning(`${stats.revokedKeys} revoked key(s)`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to list keys');
        process.exit(1);
      }
    });
}

/**
 * Import key command
 */
export function createImportKeyCommand(): Command {
  return new Command('import-key')
    .alias('import')
    .description('Import a key from file or stdin')
    .argument('[file]', 'Key file to import')
    .action(async (file) => {
      try {
        let keyData: string;

        if (file) {
          const filePath = resolve(file as string);
          if (!(await fileExists(filePath))) {
            error(`File not found: ${filePath}`);
            process.exit(1);
          }
          keyData = await readFileContent(filePath);
        } else if (hasStdin()) {
          keyData = await readStdin();
        } else {
          error('No input provided. Specify a file or pipe key data to stdin.');
          process.exit(1);
        }

        const spinner = createSpinner('Importing key...');
        spinner.start();

        const result = await importKeys(keyData);

        spinner.stop();

        if (result.errors.length > 0) {
          for (const err of result.errors) {
            warning(err);
          }
        }

        if (result.keys.length === 0) {
          error('No valid keys found in input');
          process.exit(1);
        }

        // Add to keyring
        const storage = new FileStorageAdapter();
        const keyring = new Keyring(storage);
        await keyring.load();

        for (const _key of result.keys) {
          // Determine if it's a private key
          const isPrivate = keyData.includes('-----BEGIN PGP PRIVATE KEY BLOCK-----');
          await keyring.addKey(keyData, isPrivate ? keyData : undefined);
        }

        success(`Imported ${result.keys.length} key(s)`);
        console.log();

        for (const keyInfo of result.keys) {
          console.log(formatKeyInfo(keyInfo));
          console.log();
        }
      } catch (err) {
        error(err instanceof Error ? err.message : 'Import failed');
        process.exit(1);
      }
    });
}

/**
 * Export key command
 */
export function createExportKeyCommand(): Command {
  return new Command('export-key')
    .alias('export')
    .description('Export a key to file (.asc or .gpg format)')
    .argument('<keyid>', 'Key ID or fingerprint to export')
    .option('-o, --output <file>', 'Output file (auto-detects format from extension, or uses .asc)')
    .option('--private', 'Export private key (requires passphrase)')
    .option('-f, --format <format>', 'Output format: asc (ASCII armored) or gpg (binary)', 'asc')
    .action(async (keyid, options) => {
      try {
        const storage = new FileStorageAdapter();
        const keyring = new Keyring(storage);
        await keyring.load();

        const entry = await keyring.getKey(keyid as string);
        if (!entry) {
          error(`Key not found: ${keyid}`);
          process.exit(1);
        }

        const isPrivate = options.private as boolean;

        if (isPrivate) {
          if (!entry.privateKey) {
            error('No private key available for this key');
            process.exit(1);
          }

          warning('Exporting private key!');
          const confirmed = await confirm('Are you sure you want to export the private key?');
          if (!confirmed) {
            info('Export cancelled');
            return;
          }
        }

        // Determine format from output file extension or --format option
        let format = (options.format as string).toLowerCase();
        let outputPath = options.output as string | undefined;

        if (outputPath) {
          outputPath = resolve(outputPath);
          // Auto-detect format from extension
          if (outputPath.endsWith('.gpg')) {
            format = 'gpg';
          } else if (outputPath.endsWith('.asc')) {
            format = 'asc';
          } else {
            // Add appropriate extension if missing
            outputPath = outputPath + (format === 'gpg' ? '.gpg' : '.asc');
          }
        }

        const keyData = isPrivate ? entry.privateKey! : entry.publicKey;

        if (format === 'gpg') {
          // Binary export
          const key = await readKey(keyData);
          const binary = await exportKeyBinary(key, { includePrivate: isPrivate });

          if (outputPath) {
            await writeFileBinary(outputPath, binary);
            success(`Key exported to: ${outputPath}`);
            info(`Format: Binary (.gpg)`);
          } else {
            // For binary, we must have an output file
            error('Binary format requires an output file. Use -o <file>');
            process.exit(1);
          }
        } else {
          // ASCII armored export (default)
          if (outputPath) {
            await writeFileContent(outputPath, keyData);
            success(`Key exported to: ${outputPath}`);
            info(`Format: ASCII armored (.asc)`);
          } else {
            console.log(keyData);
          }
        }
      } catch (err) {
        error(err instanceof Error ? err.message : 'Export failed');
        process.exit(1);
      }
    });
}

/**
 * Delete key command
 */
export function createDeleteKeyCommand(): Command {
  return new Command('delete-key')
    .alias('delete')
    .alias('rm')
    .description('Delete a key from the keyring')
    .argument('<keyid>', 'Key ID or fingerprint to delete')
    .option('-f, --force', 'Skip confirmation')
    .action(async (keyid, options) => {
      try {
        const storage = new FileStorageAdapter();
        const keyring = new Keyring(storage);
        await keyring.load();

        const entry = await keyring.getKey(keyid as string);
        if (!entry) {
          error(`Key not found: ${keyid}`);
          process.exit(1);
        }

        console.log(formatKeyInfo(entry.keyInfo));
        console.log();

        if (!options.force) {
          const confirmed = await confirm('Delete this key?');
          if (!confirmed) {
            info('Delete cancelled');
            return;
          }
        }

        await keyring.deleteKey(keyid as string);
        success('Key deleted');
      } catch (err) {
        error(err instanceof Error ? err.message : 'Delete failed');
        process.exit(1);
      }
    });
}

/**
 * Search keys command
 */
export function createSearchKeysCommand(): Command {
  return new Command('search')
    .description('Search keys by name or email')
    .argument('<query>', 'Search query')
    .option('-v, --verbose', 'Show detailed key information')
    .action(async (query, options) => {
      try {
        const storage = new FileStorageAdapter();
        const keyring = new Keyring(storage);
        await keyring.load();

        const results = await keyring.searchKeys(query as string);

        if (results.length === 0) {
          info(`No keys found matching: ${query}`);
          return;
        }

        header(`Search results for "${query}" (${results.length} found)`);

        for (const entry of results) {
          console.log(formatKeyInfo(entry.keyInfo, options.verbose));
          console.log();
        }
      } catch (err) {
        error(err instanceof Error ? err.message : 'Search failed');
        process.exit(1);
      }
    });
}

/**
 * Revoke key command
 */
export function createRevokeCommand(): Command {
  return new Command('revoke')
    .description('Generate a revocation certificate')
    .argument('<keyid>', 'Key ID or fingerprint to revoke')
    .option('-o, --output <file>', 'Output file')
    .option('-r, --reason <reason>', 'Reason for revocation')
    .action(async (keyid, options) => {
      try {
        const storage = new FileStorageAdapter();
        const keyring = new Keyring(storage);
        await keyring.load();

        const entry = await keyring.getKey(keyid as string);
        if (!entry?.privateKey) {
          error(`Private key not found: ${keyid}`);
          process.exit(1);
        }

        console.log(formatKeyInfo(entry.keyInfo));
        console.log();

        warning('This will generate a revocation certificate.');
        warning('Once published, this key will be marked as revoked.');
        console.log();

        const confirmed = await confirm('Generate revocation certificate?');
        if (!confirmed) {
          info('Revocation cancelled');
          return;
        }

        const passphrase = await promptPassphrase('Enter passphrase:');

        const spinner = createSpinner('Generating revocation certificate...');
        spinner.start();

        const revocation = await generateRevocationCertificate(
          entry.privateKey,
          passphrase,
          options.reason as string | undefined
        );

        spinner.stop();

        if (options.output) {
          const outputPath = resolve(options.output as string);
          await writeFileContent(outputPath, revocation);
          success(`Revocation certificate written to: ${outputPath}`);
        } else {
          console.log();
          console.log(chalk.gray('─'.repeat(60)));
          console.log(revocation);
          console.log(chalk.gray('─'.repeat(60)));
        }

        console.log();
        warning('Store this revocation certificate safely!');
        info('Import this certificate to revoke the key when needed.');
      } catch (err) {
        error(err instanceof Error ? err.message : 'Revocation failed');
        process.exit(1);
      }
    });
}

/**
 * Key info command
 */
export function createKeyInfoCommand(): Command {
  return new Command('key-info')
    .alias('info')
    .description('Show detailed information about a key')
    .argument('<keyid>', 'Key ID or fingerprint')
    .action(async (keyid) => {
      try {
        const storage = new FileStorageAdapter();
        const keyring = new Keyring(storage);
        await keyring.load();

        const entry = await keyring.getKey(keyid as string);
        if (!entry) {
          error(`Key not found: ${keyid}`);
          process.exit(1);
        }

        header('Key Information');
        console.log(formatKeyInfo(entry.keyInfo, true));
        console.log();

        console.log(chalk.bold('Added to keyring:'), entry.addedAt.toISOString());
        if (entry.lastUsed) {
          console.log(chalk.bold('Last used:'), entry.lastUsed.toISOString());
        }
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to get key info');
        process.exit(1);
      }
    });
}

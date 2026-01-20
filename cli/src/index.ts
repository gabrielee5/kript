#!/usr/bin/env node
/**
 * Kript CLI - A modern, local-first PGP encryption tool
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { VERSION } from '@kript/core';

// Import commands
import { createGenerateCommand } from './commands/generate.js';
import { createEncryptCommand } from './commands/encrypt.js';
import { createDecryptCommand } from './commands/decrypt.js';
import { createSignCommand } from './commands/sign.js';
import { createVerifyCommand } from './commands/verify.js';
import {
  createListKeysCommand,
  createImportKeyCommand,
  createExportKeyCommand,
  createDeleteKeyCommand,
  createSearchKeysCommand,
  createRevokeCommand,
  createKeyInfoCommand,
} from './commands/keys.js';
import { getConfigDir } from './storage.js';

const program = new Command();

// Program metadata
program
  .name('kript')
  .description('A modern, local-first PGP encryption tool')
  .version(VERSION, '-v, --version', 'Output the version number')
  .addHelpText('after', `
${chalk.bold('Examples:')}
  ${chalk.gray('# Generate a new key pair')}
  $ kript generate

  ${chalk.gray('# List all keys')}
  $ kript list-keys

  ${chalk.gray('# Encrypt a file')}
  $ kript encrypt -r recipient@example.com message.txt -o message.txt.pgp

  ${chalk.gray('# Decrypt a file')}
  $ kript decrypt message.txt.pgp -o message.txt

  ${chalk.gray('# Sign a message')}
  $ echo "Hello" | kript sign

  ${chalk.gray('# Verify a signature')}
  $ kript verify signed-message.asc

  ${chalk.gray('# Import a public key')}
  $ kript import-key pubkey.asc

  ${chalk.gray('# Export your public key')}
  $ kript export-key mykey@example.com -o pubkey.asc

${chalk.bold('Configuration:')}
  Keys are stored in: ${chalk.cyan(getConfigDir())}

${chalk.bold('More information:')}
  https://github.com/gabrielee5/kript
`);

// Register commands
program.addCommand(createGenerateCommand());
program.addCommand(createEncryptCommand());
program.addCommand(createDecryptCommand());
program.addCommand(createSignCommand());
program.addCommand(createVerifyCommand());
program.addCommand(createListKeysCommand());
program.addCommand(createImportKeyCommand());
program.addCommand(createExportKeyCommand());
program.addCommand(createDeleteKeyCommand());
program.addCommand(createSearchKeysCommand());
program.addCommand(createRevokeCommand());
program.addCommand(createKeyInfoCommand());

// Parse and execute
program.parse();

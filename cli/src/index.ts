#!/usr/bin/env node
/**
 * LocalPGP CLI - A modern, local-first PGP encryption tool
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { VERSION } from '@localpgp/core';

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
  .name('localpgp')
  .description('A modern, local-first PGP encryption tool')
  .version(VERSION, '-v, --version', 'Output the version number')
  .addHelpText('after', `
${chalk.bold('Examples:')}
  ${chalk.gray('# Generate a new key pair')}
  $ localpgp generate

  ${chalk.gray('# List all keys')}
  $ localpgp list-keys

  ${chalk.gray('# Encrypt a file')}
  $ localpgp encrypt -r recipient@example.com message.txt -o message.txt.pgp

  ${chalk.gray('# Decrypt a file')}
  $ localpgp decrypt message.txt.pgp -o message.txt

  ${chalk.gray('# Sign a message')}
  $ echo "Hello" | localpgp sign

  ${chalk.gray('# Verify a signature')}
  $ localpgp verify signed-message.asc

  ${chalk.gray('# Import a public key')}
  $ localpgp import-key pubkey.asc

  ${chalk.gray('# Export your public key')}
  $ localpgp export-key mykey@example.com -o pubkey.asc

${chalk.bold('Configuration:')}
  Keys are stored in: ${chalk.cyan(getConfigDir())}

${chalk.bold('More information:')}
  https://github.com/yourusername/localpgp
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

/**
 * CLI utility functions
 */

import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { KeyInfo, UserId, formatFingerprint, formatDate, daysUntilExpiration } from '@kript/core';

/**
 * Create a spinner for long operations
 */
export function createSpinner(text: string): Ora {
  return ora({ text, color: 'cyan' });
}

/**
 * Format a user ID for display
 */
export function formatUserIdDisplay(userId: UserId): string {
  let result = chalk.bold(userId.name);
  if (userId.comment) {
    result += chalk.gray(` (${userId.comment})`);
  }
  result += chalk.cyan(` <${userId.email}>`);
  return result;
}

/**
 * Format key info for display
 */
export function formatKeyInfo(keyInfo: KeyInfo, verbose = false): string {
  const lines: string[] = [];

  // Key type indicator
  const typeIcon = keyInfo.isPrivate ? chalk.yellow('sec') : chalk.green('pub');

  // Algorithm and key ID
  lines.push(
    `${typeIcon}   ${chalk.white(keyInfo.algorithm)}/${chalk.bold(keyInfo.keyId)} ${formatDate(keyInfo.creationTime)}`
  );

  // Fingerprint
  if (verbose) {
    lines.push(`      ${chalk.gray('Fingerprint:')} ${formatFingerprint(keyInfo.fingerprint)}`);
  }

  // User IDs
  for (const userId of keyInfo.userIds) {
    lines.push(`uid   ${formatUserIdDisplay(userId)}`);
  }

  // Expiration
  if (keyInfo.expirationTime) {
    const days = daysUntilExpiration(keyInfo.expirationTime);
    if (days !== null && days < 0) {
      lines.push(`      ${chalk.red('EXPIRED')} ${formatDate(keyInfo.expirationTime)}`);
    } else if (days !== null && days < 30) {
      lines.push(`      ${chalk.yellow(`Expires in ${days} days`)}`);
    } else {
      lines.push(`      ${chalk.gray(`Expires: ${formatDate(keyInfo.expirationTime)}`)}`);
    }
  }

  // Revoked status
  if (keyInfo.revoked) {
    lines.push(`      ${chalk.red.bold('REVOKED')}`);
  }

  // Subkeys
  if (verbose && keyInfo.subkeys.length > 0) {
    for (const subkey of keyInfo.subkeys) {
      const subTypeIcon = chalk.gray('sub');
      lines.push(
        `${subTypeIcon}   ${chalk.gray(subkey.algorithm)}/${chalk.gray(subkey.keyId)} ${formatDate(subkey.creationTime)}`
      );
    }
  }

  return lines.join('\n');
}

/**
 * Print success message
 */
export function success(message: string): void {
  console.log(chalk.green('✓'), message);
}

/**
 * Print error message
 */
export function error(message: string): void {
  console.error(chalk.red('✗'), message);
}

/**
 * Print warning message
 */
export function warning(message: string): void {
  console.log(chalk.yellow('⚠'), message);
}

/**
 * Print info message
 */
export function info(message: string): void {
  console.log(chalk.blue('ℹ'), message);
}

/**
 * Print a divider line
 */
export function divider(): void {
  console.log(chalk.gray('─'.repeat(60)));
}

/**
 * Print a header
 */
export function header(text: string): void {
  console.log();
  console.log(chalk.bold.white(text));
  divider();
}

/**
 * Format bytes for display
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Confirm action with user
 */
export async function confirm(message: string): Promise<boolean> {
  const inquirer = await import('inquirer');
  const { confirmed } = await inquirer.default.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message,
      default: false,
    },
  ]);
  return confirmed;
}

/**
 * Prompt for passphrase
 */
export async function promptPassphrase(message = 'Enter passphrase:'): Promise<string> {
  const inquirer = await import('inquirer');
  const { passphrase } = await inquirer.default.prompt([
    {
      type: 'password',
      name: 'passphrase',
      message,
      mask: '*',
    },
  ]);
  return passphrase;
}

/**
 * Prompt for passphrase with confirmation
 */
export async function promptPassphraseWithConfirm(
  message = 'Enter passphrase:'
): Promise<string | null> {
  const inquirer = await import('inquirer');

  const { passphrase } = await inquirer.default.prompt([
    {
      type: 'password',
      name: 'passphrase',
      message,
      mask: '*',
    },
  ]);

  const { confirm } = await inquirer.default.prompt([
    {
      type: 'password',
      name: 'confirm',
      message: 'Confirm passphrase:',
      mask: '*',
    },
  ]);

  if (passphrase !== confirm) {
    error('Passphrases do not match');
    return null;
  }

  return passphrase;
}

/**
 * Prompt for input
 */
export async function promptInput(
  message: string,
  defaultValue?: string
): Promise<string> {
  const inquirer = await import('inquirer');
  const { value } = await inquirer.default.prompt([
    {
      type: 'input',
      name: 'value',
      message,
      default: defaultValue,
    },
  ]);
  return value;
}

/**
 * Prompt for selection
 */
export async function promptSelect<T>(
  message: string,
  choices: { name: string; value: T }[]
): Promise<T> {
  const inquirer = await import('inquirer');
  const { value } = await inquirer.default.prompt([
    {
      type: 'list',
      name: 'value',
      message,
      choices,
    },
  ]);
  return value;
}

/**
 * Read from stdin
 */
export async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      resolve(data);
    });
    process.stdin.on('error', reject);
  });
}

/**
 * Check if stdin has data
 */
export function hasStdin(): boolean {
  return !process.stdin.isTTY;
}

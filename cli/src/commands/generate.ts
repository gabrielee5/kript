/**
 * Key generation command
 */

import { Command } from 'commander';
import chalk from 'chalk';
import {
  generateKeyPair,
  Keyring,
  KeyAlgorithm,
  checkPassphraseStrength,
} from '@localpgp/core';
import { FileStorageAdapter } from '../storage.js';
import {
  createSpinner,
  success,
  error,
  warning,
  info,
  formatKeyInfo,
  promptInput,
  promptPassphraseWithConfirm,
  promptSelect,
} from '../utils.js';

export function createGenerateCommand(): Command {
  const cmd = new Command('generate')
    .alias('gen')
    .description('Generate a new PGP key pair')
    .option('-n, --name <name>', 'Your name')
    .option('-e, --email <email>', 'Your email address')
    .option('-c, --comment <comment>', 'Comment for the key')
    .option(
      '-a, --algorithm <algorithm>',
      'Key algorithm (rsa2048, rsa4096, ecc, curve25519)',
      'curve25519'
    )
    .option('--expires <days>', 'Key expiration in days (0 = never)', '0')
    .option('--no-passphrase', 'Generate key without passphrase (not recommended)')
    .action(async (options) => {
      try {
        // Get name
        let name = options.name as string | undefined;
        if (!name) {
          name = await promptInput('Your name:');
        }
        if (!name?.trim()) {
          error('Name is required');
          process.exit(1);
        }

        // Get email
        let email = options.email as string | undefined;
        if (!email) {
          email = await promptInput('Your email:');
        }
        if (!email?.trim()) {
          error('Email is required');
          process.exit(1);
        }

        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          error('Invalid email format');
          process.exit(1);
        }

        // Get comment (optional)
        let comment = options.comment as string | undefined;
        if (comment === undefined) {
          comment = await promptInput('Comment (optional):');
        }

        // Get algorithm
        let algorithm = options.algorithm as KeyAlgorithm;
        if (
          !['rsa2048', 'rsa4096', 'ecc', 'curve25519'].includes(algorithm)
        ) {
          algorithm = await promptSelect('Select algorithm:', [
            { name: 'Curve25519 (recommended, fast)', value: 'curve25519' as KeyAlgorithm },
            { name: 'RSA 4096 (high security)', value: 'rsa4096' as KeyAlgorithm },
            { name: 'RSA 2048 (compatible)', value: 'rsa2048' as KeyAlgorithm },
          ]);
        }

        // Get passphrase
        let passphrase: string | undefined;
        if (options.passphrase !== false) {
          const pass = await promptPassphraseWithConfirm(
            'Enter passphrase (empty for no passphrase):'
          );
          if (pass === null) {
            process.exit(1);
          }
          passphrase = pass || undefined;

          // Check passphrase strength
          if (passphrase) {
            const strength = checkPassphraseStrength(passphrase);
            if (strength.score < 2) {
              warning('Weak passphrase detected:');
              for (const feedback of strength.feedback) {
                console.log(chalk.yellow(`  • ${feedback}`));
              }
              console.log();
            }
          } else {
            warning('No passphrase set. Your private key will be unprotected!');
          }
        }

        // Parse expiration
        const expiresInput = options.expires as string;
        const expiresDays = parseInt(expiresInput, 10);
        const expirationTime = expiresDays > 0 ? expiresDays * 24 * 60 * 60 : undefined;

        // Generate key
        const spinner = createSpinner('Generating key pair...');
        spinner.start();

        const keyPair = await generateKeyPair({
          algorithm,
          userIds: [
            {
              name: name.trim(),
              email: email.trim(),
              comment: comment?.trim() || undefined,
            },
          ],
          passphrase,
          expirationTime,
        });

        spinner.stop();

        // Add to keyring
        const storage = new FileStorageAdapter();
        const keyring = new Keyring(storage);
        await keyring.addKey(keyPair.publicKey, keyPair.privateKey);

        console.log();
        success('Key pair generated successfully!');
        console.log();
        console.log(formatKeyInfo(keyPair.keyInfo, true));
        console.log();

        // Show revocation certificate
        info('Revocation certificate saved. Store it safely!');
        console.log(chalk.gray('─'.repeat(60)));
        console.log(chalk.gray(keyPair.revocationCertificate));
        console.log(chalk.gray('─'.repeat(60)));
        console.log();

        warning(
          'Back up your private key and revocation certificate in a secure location!'
        );
      } catch (err) {
        error(err instanceof Error ? err.message : 'Key generation failed');
        process.exit(1);
      }
    });

  return cmd;
}

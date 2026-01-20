/**
 * Utility functions for LocalPGP
 */

import { UserId } from './types.js';

/**
 * Format a user ID for display
 */
export function formatUserId(userId: UserId): string {
  let result = userId.name;
  if (userId.comment) {
    result += ` (${userId.comment})`;
  }
  result += ` <${userId.email}>`;
  return result;
}

/**
 * Parse a user ID string into components
 * Format: "Name (Comment) <email@example.com>" or "Name <email@example.com>"
 */
export function parseUserId(userIdString: string): UserId | null {
  const regex = /^(.+?)(?:\s+\((.+?)\))?\s+<(.+?)>$/;
  const match = regex.exec(userIdString);

  if (!match) {
    return null;
  }

  const [, name, comment, email] = match;
  return {
    name: name?.trim() ?? '',
    email: email?.trim() ?? '',
    comment: comment?.trim(),
  };
}

/**
 * Format a fingerprint for display (groups of 4)
 */
export function formatFingerprint(fingerprint: string): string {
  const clean = fingerprint.replace(/\s/g, '').toUpperCase();
  return clean.match(/.{1,4}/g)?.join(' ') ?? clean;
}

/**
 * Get short key ID (last 8 characters of fingerprint)
 */
export function getShortKeyId(fingerprint: string): string {
  return fingerprint.replace(/\s/g, '').slice(-8).toUpperCase();
}

/**
 * Get long key ID (last 16 characters of fingerprint)
 */
export function getLongKeyId(fingerprint: string): string {
  return fingerprint.replace(/\s/g, '').slice(-16).toUpperCase();
}

/**
 * Format a date for display
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

/**
 * Format a date with time for display
 */
export function formatDateTime(date: Date): string {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * Check if a key is expired
 */
export function isExpired(expirationTime?: Date): boolean {
  if (!expirationTime) {
    return false;
  }
  return expirationTime < new Date();
}

/**
 * Calculate days until expiration
 */
export function daysUntilExpiration(expirationTime?: Date): number | null {
  if (!expirationTime) {
    return null;
  }
  const diff = expirationTime.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Generate a random string for unique identifiers
 */
export function generateId(length = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i]! % chars.length];
  }
  return result;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check passphrase strength
 * Returns a score from 0-4 and feedback
 */
export function checkPassphraseStrength(passphrase: string): {
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (passphrase.length >= 8) score++;
  if (passphrase.length >= 12) score++;
  if (passphrase.length >= 16) score++;

  if (/[a-z]/.test(passphrase) && /[A-Z]/.test(passphrase)) {
    score++;
  } else {
    feedback.push('Mix uppercase and lowercase letters');
  }

  if (/\d/.test(passphrase)) {
    score++;
  } else {
    feedback.push('Add numbers');
  }

  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(passphrase)) {
    score++;
  } else {
    feedback.push('Add special characters');
  }

  if (passphrase.length < 8) {
    feedback.unshift('Use at least 8 characters');
  }

  // Cap at 4
  score = Math.min(score, 4);

  return { score, feedback };
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Securely clear a string from memory (best effort)
 * Note: JavaScript doesn't guarantee memory clearing, but this helps
 */
export function secureClear(str: string): void {
  // Overwrite the string in a way that might help GC
  // This is best-effort as JS strings are immutable
  if (typeof str === 'string' && str.length > 0) {
    // Create a mutable array and clear it
    const arr = str.split('');
    for (let i = 0; i < arr.length; i++) {
      arr[i] = '\0';
    }
  }
}

/**
 * Convert Uint8Array to hex string
 */
export function uint8ArrayToHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to Uint8Array
 */
export function hexToUint8Array(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g);
  if (!matches) {
    return new Uint8Array(0);
  }
  return new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
}

/**
 * Convert string to Uint8Array (UTF-8)
 */
export function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Convert Uint8Array to string (UTF-8)
 */
export function uint8ArrayToString(arr: Uint8Array): string {
  return new TextDecoder().decode(arr);
}

/**
 * Check if data is armored (ASCII armor format)
 */
export function isArmored(data: string | Uint8Array): boolean {
  const str = typeof data === 'string' ? data : uint8ArrayToString(data);
  return str.includes('-----BEGIN PGP');
}

/**
 * Get the type of armored block
 */
export function getArmorType(
  armored: string
): 'public' | 'private' | 'message' | 'signature' | 'signed' | 'unknown' {
  if (armored.includes('-----BEGIN PGP PUBLIC KEY BLOCK-----')) {
    return 'public';
  }
  if (armored.includes('-----BEGIN PGP PRIVATE KEY BLOCK-----')) {
    return 'private';
  }
  if (armored.includes('-----BEGIN PGP MESSAGE-----')) {
    return 'message';
  }
  if (armored.includes('-----BEGIN PGP SIGNATURE-----')) {
    return 'signature';
  }
  if (armored.includes('-----BEGIN PGP SIGNED MESSAGE-----')) {
    return 'signed';
  }
  return 'unknown';
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
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
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}

import { describe, it, expect } from 'vitest';
import {
  formatUserId,
  parseUserId,
  formatFingerprint,
  getShortKeyId,
  getLongKeyId,
  formatDate,
  formatDateTime,
  isExpired,
  daysUntilExpiration,
  generateId,
  isValidEmail,
  checkPassphraseStrength,
  constantTimeCompare,
  uint8ArrayToHex,
  hexToUint8Array,
  stringToUint8Array,
  uint8ArrayToString,
  isArmored,
  getArmorType,
  formatFileSize,
  truncate,
} from './utils';

describe('User ID Formatting', () => {
  it('should format a user ID without comment', () => {
    const result = formatUserId({ name: 'John Doe', email: 'john@example.com' });
    expect(result).toBe('John Doe <john@example.com>');
  });

  it('should format a user ID with comment', () => {
    const result = formatUserId({
      name: 'John Doe',
      email: 'john@example.com',
      comment: 'Work Key',
    });
    expect(result).toBe('John Doe (Work Key) <john@example.com>');
  });

  it('should parse a user ID without comment', () => {
    const result = parseUserId('John Doe <john@example.com>');
    expect(result).toEqual({
      name: 'John Doe',
      email: 'john@example.com',
      comment: undefined,
    });
  });

  it('should parse a user ID with comment', () => {
    const result = parseUserId('John Doe (Work Key) <john@example.com>');
    expect(result).toEqual({
      name: 'John Doe',
      email: 'john@example.com',
      comment: 'Work Key',
    });
  });

  it('should return null for invalid user ID', () => {
    expect(parseUserId('invalid')).toBeNull();
    expect(parseUserId('no email here')).toBeNull();
  });
});

describe('Fingerprint Formatting', () => {
  it('should format fingerprint in groups of 4', () => {
    const fingerprint = 'ABCD1234EFGH5678IJKL9012';
    const result = formatFingerprint(fingerprint);
    expect(result).toBe('ABCD 1234 EFGH 5678 IJKL 9012');
  });

  it('should get short key ID (last 8 chars)', () => {
    const fingerprint = 'ABCD1234EFGH5678IJKL9012MNOP3456';
    expect(getShortKeyId(fingerprint)).toBe('MNOP3456');
  });

  it('should get long key ID (last 16 chars)', () => {
    const fingerprint = 'ABCD1234EFGH5678IJKL9012MNOP3456';
    expect(getLongKeyId(fingerprint)).toBe('IJKL9012MNOP3456');
  });
});

describe('Date Formatting', () => {
  it('should format date as YYYY-MM-DD', () => {
    const date = new Date('2024-03-15T10:30:00Z');
    expect(formatDate(date)).toBe('2024-03-15');
  });

  it('should format date with time', () => {
    const date = new Date('2024-03-15T10:30:45Z');
    expect(formatDateTime(date)).toBe('2024-03-15 10:30:45');
  });
});

describe('Expiration Checks', () => {
  it('should return false for undefined expiration', () => {
    expect(isExpired(undefined)).toBe(false);
  });

  it('should return true for past date', () => {
    const pastDate = new Date(Date.now() - 86400000);
    expect(isExpired(pastDate)).toBe(true);
  });

  it('should return false for future date', () => {
    const futureDate = new Date(Date.now() + 86400000);
    expect(isExpired(futureDate)).toBe(false);
  });

  it('should calculate days until expiration', () => {
    const futureDate = new Date(Date.now() + 7 * 86400000);
    const days = daysUntilExpiration(futureDate);
    expect(days).toBeGreaterThanOrEqual(6);
    expect(days).toBeLessThanOrEqual(8);
  });

  it('should return null for undefined expiration', () => {
    expect(daysUntilExpiration(undefined)).toBeNull();
  });
});

describe('ID Generation', () => {
  it('should generate ID of specified length', () => {
    const id = generateId(12);
    expect(id.length).toBe(12);
  });

  it('should generate unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe('Email Validation', () => {
  it('should validate correct emails', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
    expect(isValidEmail('user+tag@example.org')).toBe(true);
  });

  it('should reject invalid emails', () => {
    expect(isValidEmail('notanemail')).toBe(false);
    expect(isValidEmail('missing@domain')).toBe(false);
    expect(isValidEmail('@nodomain.com')).toBe(false);
    expect(isValidEmail('spaces in@email.com')).toBe(false);
  });
});

describe('Passphrase Strength', () => {
  it('should rate weak passphrases low', () => {
    const result = checkPassphraseStrength('abc');
    expect(result.score).toBeLessThan(2);
    expect(result.feedback.length).toBeGreaterThan(0);
  });

  it('should rate strong passphrases high', () => {
    const result = checkPassphraseStrength('MyStr0ng!P@ssword2024');
    expect(result.score).toBeGreaterThanOrEqual(3);
  });

  it('should provide feedback for improvements', () => {
    const result = checkPassphraseStrength('password');
    expect(result.feedback).toContain('Mix uppercase and lowercase letters');
  });
});

describe('Constant Time Compare', () => {
  it('should return true for equal strings', () => {
    expect(constantTimeCompare('hello', 'hello')).toBe(true);
  });

  it('should return false for different strings', () => {
    expect(constantTimeCompare('hello', 'world')).toBe(false);
  });

  it('should return false for different lengths', () => {
    expect(constantTimeCompare('short', 'longer string')).toBe(false);
  });
});

describe('Hex Conversion', () => {
  it('should convert Uint8Array to hex', () => {
    const arr = new Uint8Array([0, 15, 255, 128]);
    expect(uint8ArrayToHex(arr)).toBe('000fff80');
  });

  it('should convert hex to Uint8Array', () => {
    const hex = '000fff80';
    const result = hexToUint8Array(hex);
    expect(result).toEqual(new Uint8Array([0, 15, 255, 128]));
  });

  it('should round-trip conversion', () => {
    const original = new Uint8Array([1, 2, 3, 4, 5]);
    const hex = uint8ArrayToHex(original);
    const result = hexToUint8Array(hex);
    expect(result).toEqual(original);
  });
});

describe('String/Uint8Array Conversion', () => {
  it('should convert string to Uint8Array', () => {
    const str = 'Hello';
    const result = stringToUint8Array(str);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(uint8ArrayToString(result)).toBe(str);
  });

  it('should handle UTF-8 characters', () => {
    const str = 'Hello 世界 🌍';
    const arr = stringToUint8Array(str);
    expect(uint8ArrayToString(arr)).toBe(str);
  });
});

describe('Armor Detection', () => {
  it('should detect armored text', () => {
    expect(isArmored('-----BEGIN PGP MESSAGE-----')).toBe(true);
    expect(isArmored('not armored')).toBe(false);
  });

  it('should detect armor type', () => {
    expect(getArmorType('-----BEGIN PGP PUBLIC KEY BLOCK-----')).toBe('public');
    expect(getArmorType('-----BEGIN PGP PRIVATE KEY BLOCK-----')).toBe('private');
    expect(getArmorType('-----BEGIN PGP MESSAGE-----')).toBe('message');
    expect(getArmorType('-----BEGIN PGP SIGNATURE-----')).toBe('signature');
    expect(getArmorType('-----BEGIN PGP SIGNED MESSAGE-----')).toBe('signed');
    expect(getArmorType('random text')).toBe('unknown');
  });
});

describe('File Size Formatting', () => {
  it('should format bytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('should format kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(2048)).toBe('2.0 KB');
  });

  it('should format megabytes', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
  });

  it('should format gigabytes', () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
  });
});

describe('String Truncation', () => {
  it('should not truncate short strings', () => {
    expect(truncate('short', 10)).toBe('short');
  });

  it('should truncate long strings with ellipsis', () => {
    expect(truncate('this is a long string', 10)).toBe('this is...');
  });

  it('should handle exact length', () => {
    expect(truncate('exact', 5)).toBe('exact');
  });
});

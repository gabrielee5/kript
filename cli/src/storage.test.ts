/**
 * Tests for storage module - specifically path traversal prevention (KRIPT-004)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileStorageAdapter, validateStorageKey } from './storage.js';

describe('validateStorageKey', () => {
  describe('valid keys', () => {
    it('should accept alphanumeric keys', () => {
      expect(() => validateStorageKey('abc123')).not.toThrow();
      expect(() => validateStorageKey('ABC123')).not.toThrow();
      expect(() => validateStorageKey('testkey')).not.toThrow();
    });

    it('should accept keys with hyphens', () => {
      expect(() => validateStorageKey('my-key')).not.toThrow();
      expect(() => validateStorageKey('test-key-123')).not.toThrow();
    });

    it('should accept keys with underscores', () => {
      expect(() => validateStorageKey('my_key')).not.toThrow();
      expect(() => validateStorageKey('test_key_123')).not.toThrow();
    });

    it('should accept mixed valid characters', () => {
      expect(() => validateStorageKey('My-Test_Key123')).not.toThrow();
    });

    it('should accept fingerprint-like keys (hex uppercase)', () => {
      expect(() => validateStorageKey('ABCD1234EFGH5678')).not.toThrow();
    });
  });

  describe('invalid keys - path traversal attempts', () => {
    it('should reject keys with forward slashes', () => {
      expect(() => validateStorageKey('../etc/passwd')).toThrow(/Invalid storage key/);
      expect(() => validateStorageKey('../../secret')).toThrow(/Invalid storage key/);
      expect(() => validateStorageKey('path/to/file')).toThrow(/Invalid storage key/);
    });

    it('should reject keys with backslashes', () => {
      expect(() => validateStorageKey('..\\windows\\system32')).toThrow(/Invalid storage key/);
      expect(() => validateStorageKey('path\\to\\file')).toThrow(/Invalid storage key/);
    });

    it('should reject keys with dots', () => {
      expect(() => validateStorageKey('..')).toThrow(/Invalid storage key/);
      expect(() => validateStorageKey('...')).toThrow(/Invalid storage key/);
      expect(() => validateStorageKey('.hidden')).toThrow(/Invalid storage key/);
      expect(() => validateStorageKey('file.txt')).toThrow(/Invalid storage key/);
    });

    it('should reject keys with null bytes', () => {
      expect(() => validateStorageKey('test\0key')).toThrow(/Invalid storage key/);
    });

    it('should reject keys with spaces', () => {
      expect(() => validateStorageKey('test key')).toThrow(/Invalid storage key/);
      expect(() => validateStorageKey(' test')).toThrow(/Invalid storage key/);
    });

    it('should reject keys with special characters', () => {
      expect(() => validateStorageKey('test:key')).toThrow(/Invalid storage key/);
      expect(() => validateStorageKey('test*key')).toThrow(/Invalid storage key/);
      expect(() => validateStorageKey('test?key')).toThrow(/Invalid storage key/);
      expect(() => validateStorageKey('test<key')).toThrow(/Invalid storage key/);
      expect(() => validateStorageKey('test>key')).toThrow(/Invalid storage key/);
      expect(() => validateStorageKey('test|key')).toThrow(/Invalid storage key/);
      expect(() => validateStorageKey('test"key')).toThrow(/Invalid storage key/);
    });
  });

  describe('invalid keys - edge cases', () => {
    it('should reject empty string', () => {
      expect(() => validateStorageKey('')).toThrow(/non-empty string/);
    });

    it('should reject null/undefined', () => {
      expect(() => validateStorageKey(null as unknown as string)).toThrow(/non-empty string/);
      expect(() => validateStorageKey(undefined as unknown as string)).toThrow(/non-empty string/);
    });

    it('should reject very long keys', () => {
      const longKey = 'a'.repeat(256);
      expect(() => validateStorageKey(longKey)).toThrow(/exceeds maximum length/);
    });

    it('should accept keys at max length boundary', () => {
      const maxKey = 'a'.repeat(255);
      expect(() => validateStorageKey(maxKey)).not.toThrow();
    });
  });
});

describe('FileStorageAdapter - path traversal prevention', () => {
  let testDir: string;
  let adapter: FileStorageAdapter;

  beforeEach(async () => {
    // Create a temporary directory for tests
    testDir = join(tmpdir(), `kript-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    adapter = new FileStorageAdapter(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('save operation', () => {
    it('should save valid keys successfully', async () => {
      await adapter.save('valid-key', '{"test": "data"}');
      const content = await fs.readFile(join(testDir, 'valid-key.json'), 'utf-8');
      expect(content).toBe('{"test": "data"}');
    });

    it('should reject path traversal in save', async () => {
      await expect(adapter.save('../escape', 'malicious')).rejects.toThrow(/Invalid storage key/);
    });

    it('should not create files outside directory', async () => {
      const parentFile = join(testDir, '..', 'escaped.json');

      try {
        await adapter.save('../escaped', 'data');
      } catch {
        // Expected to throw
      }

      // Verify file was not created outside directory
      await expect(fs.access(parentFile)).rejects.toThrow();
    });
  });

  describe('load operation', () => {
    it('should load valid keys successfully', async () => {
      await fs.writeFile(join(testDir, 'test-key.json'), '{"loaded": true}');
      const content = await adapter.load('test-key');
      expect(content).toBe('{"loaded": true}');
    });

    it('should reject path traversal in load', async () => {
      const result = await adapter.load('../etc/passwd');
      // Should return null (not found) rather than reading outside directory
      expect(result).toBeNull();
    });

    it('should return null for non-existent valid keys', async () => {
      const result = await adapter.load('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('delete operation', () => {
    it('should delete valid keys successfully', async () => {
      await fs.writeFile(join(testDir, 'to-delete.json'), 'data');
      const result = await adapter.delete('to-delete');
      expect(result).toBe(true);
      await expect(fs.access(join(testDir, 'to-delete.json'))).rejects.toThrow();
    });

    it('should reject path traversal in delete', async () => {
      const result = await adapter.delete('../important-file');
      expect(result).toBe(false);
    });

    it('should return false for non-existent keys', async () => {
      const result = await adapter.delete('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('list operation', () => {
    it('should list only files in the directory', async () => {
      await fs.writeFile(join(testDir, 'key1.json'), 'data1');
      await fs.writeFile(join(testDir, 'key2.json'), 'data2');

      const keys = await adapter.list();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys.length).toBe(2);
    });
  });
});

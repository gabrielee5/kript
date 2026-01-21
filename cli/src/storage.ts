/**
 * File system storage adapter for CLI keyring
 */

import { promises as fs } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { homedir } from 'node:os';
import type { StorageAdapter } from '@kript/core';

const CONFIG_DIR = join(homedir(), '.kript');

/**
 * Validates a storage key to prevent path traversal attacks.
 * Only allows alphanumeric characters, hyphens, and underscores.
 * @throws Error if key contains invalid characters
 */
export function validateStorageKey(key: string): void {
  if (!key || typeof key !== 'string') {
    throw new Error('Storage key must be a non-empty string');
  }
  // Only allow alphanumeric, hyphens, underscores (no dots, slashes, etc.)
  const validKeyPattern = /^[a-zA-Z0-9_-]+$/;
  if (!validKeyPattern.test(key)) {
    throw new Error(
      `Invalid storage key: "${key}". Only alphanumeric characters, hyphens, and underscores are allowed.`
    );
  }
  // Additional length check to prevent filesystem issues
  if (key.length > 255) {
    throw new Error('Storage key exceeds maximum length of 255 characters');
  }
}

/**
 * Constructs a safe file path within the config directory.
 * Validates that the resulting path is within the allowed directory.
 * @throws Error if the path would escape the config directory
 */
function getSafeFilePath(baseDir: string, key: string): string {
  validateStorageKey(key);
  const filePath = resolve(baseDir, `${key}.json`);
  const resolvedBase = resolve(baseDir);

  // Verify the path is within the base directory
  const relativePath = relative(resolvedBase, filePath);
  if (relativePath.startsWith('..') || resolve(resolvedBase, relativePath) !== filePath) {
    throw new Error('Path traversal detected: key would access files outside config directory');
  }

  return filePath;
}

/**
 * Ensure the config directory exists
 */
async function ensureConfigDir(): Promise<void> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
}

/**
 * File system storage adapter for Node.js
 */
export class FileStorageAdapter implements StorageAdapter {
  private dir: string;

  constructor(dir: string = CONFIG_DIR) {
    this.dir = dir;
  }

  async save(key: string, value: string): Promise<void> {
    await ensureConfigDir();
    const filePath = getSafeFilePath(this.dir, key);
    await fs.writeFile(filePath, value, 'utf-8');
  }

  async load(key: string): Promise<string | null> {
    await ensureConfigDir();
    try {
      const filePath = getSafeFilePath(this.dir, key);
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const filePath = getSafeFilePath(this.dir, key);
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<string[]> {
    await ensureConfigDir();
    try {
      const files = await fs.readdir(this.dir);
      return files
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.slice(0, -5));
    } catch {
      return [];
    }
  }

  async clear(): Promise<void> {
    const keys = await this.list();
    for (const key of keys) {
      await this.delete(key);
    }
  }
}

/**
 * Get the config directory path
 */
export function getConfigDir(): string {
  return CONFIG_DIR;
}

/**
 * Read a file from disk
 */
export async function readFileContent(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8');
}

/**
 * Read a file as binary
 */
export async function readFileBinary(filePath: string): Promise<Uint8Array> {
  const buffer = await fs.readFile(filePath);
  return new Uint8Array(buffer);
}

/**
 * Write content to a file
 */
export async function writeFileContent(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Write binary content to a file
 */
export async function writeFileBinary(filePath: string, content: Uint8Array): Promise<void> {
  await fs.writeFile(filePath, Buffer.from(content));
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

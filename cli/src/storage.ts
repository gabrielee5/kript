/**
 * File system storage adapter for CLI keyring
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { StorageAdapter } from '@localpgp/core';

const CONFIG_DIR = join(homedir(), '.localpgp');

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
    const filePath = join(this.dir, `${key}.json`);
    await fs.writeFile(filePath, value, 'utf-8');
  }

  async load(key: string): Promise<string | null> {
    await ensureConfigDir();
    const filePath = join(this.dir, `${key}.json`);
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<boolean> {
    const filePath = join(this.dir, `${key}.json`);
    try {
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

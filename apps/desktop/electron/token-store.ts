import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface StoredAuthTokens {
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresAt?: number;
}

export interface SafeStorageLike {
  isEncryptionAvailable(): boolean;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

export type TokenStorageMode = 'safeStorage' | 'memory-fallback';

export interface ElectronTokenStoreOptions {
  readonly filePath: string;
  readonly safeStorage: SafeStorageLike;
}

function isStoredAuthTokens(value: unknown): value is StoredAuthTokens {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.accessToken !== 'string' || record.accessToken.trim().length === 0) {
    return false;
  }
  if (record.refreshToken !== undefined && typeof record.refreshToken !== 'string') {
    return false;
  }
  if (
    record.expiresAt !== undefined &&
    (typeof record.expiresAt !== 'number' || !Number.isFinite(record.expiresAt))
  ) {
    return false;
  }
  return true;
}

function sanitizeTokens(tokens: StoredAuthTokens): StoredAuthTokens {
  return {
    accessToken: tokens.accessToken,
    ...(tokens.refreshToken !== undefined ? { refreshToken: tokens.refreshToken } : {}),
    ...(tokens.expiresAt !== undefined ? { expiresAt: tokens.expiresAt } : {}),
  };
}

/**
 * Main-process token store backed by Electron `safeStorage` encrypted file persistence.
 * Falls back to in-memory storage (never writing plaintext to disk) when OS keyring
 * encryption is unavailable (e.g. headless CI or Linux without a secret service).
 */
export class ElectronTokenStore {
  private readonly filePath: string;
  private readonly safeStorage: SafeStorageLike;
  private memoryFallback: StoredAuthTokens | null = null;

  constructor(options: ElectronTokenStoreOptions) {
    this.filePath = options.filePath;
    this.safeStorage = options.safeStorage;
  }

  get storageMode(): TokenStorageMode {
    return this.safeStorage.isEncryptionAvailable() ? 'safeStorage' : 'memory-fallback';
  }

  async getTokens(): Promise<StoredAuthTokens | null> {
    if (!this.safeStorage.isEncryptionAvailable()) {
      return this.memoryFallback ? sanitizeTokens(this.memoryFallback) : null;
    }

    try {
      const encrypted = await readFile(this.filePath);
      if (encrypted.byteLength === 0) {
        return null;
      }
      const decrypted = this.safeStorage.decryptString(encrypted);
      const parsed: unknown = JSON.parse(decrypted);
      return isStoredAuthTokens(parsed) ? sanitizeTokens(parsed) : null;
    } catch {
      return null;
    }
  }

  async setTokens(tokens: StoredAuthTokens): Promise<void> {
    if (!isStoredAuthTokens(tokens)) {
      throw new Error('Invalid auth token payload');
    }

    const normalized = sanitizeTokens(tokens);
    if (!this.safeStorage.isEncryptionAvailable()) {
      this.memoryFallback = normalized;
      return;
    }

    const serialized = JSON.stringify(normalized);
    const encrypted = this.safeStorage.encryptString(serialized);
    await mkdir(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
    await writeFile(this.filePath, encrypted, { mode: 0o600 });
    this.memoryFallback = null;
  }

  async clearTokens(): Promise<void> {
    this.memoryFallback = null;
    try {
      await unlink(this.filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

export function resolveTokenStorePath(userDataDir: string): string {
  return path.join(userDataDir, 'auth-tokens.enc');
}

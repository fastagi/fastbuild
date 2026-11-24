import type { AuthTokenPair, TokenStore } from '@fastbuild/api-client';

export const DEFAULT_TOKEN_STORAGE_KEY = 'fastbuild.auth.tokens';

/**
 * Minimal async key-value storage contract matching `expo-secure-store`.
 * Injectable so unit tests can run in Node without a native simulator.
 */
export interface SecureStorageAdapter {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

/**
 * Lazily binds to `expo-secure-store` so importing this module in headless
 * unit tests does not require native Expo modules to be loaded.
 */
export function createExpoSecureStorageAdapter(): SecureStorageAdapter {
  let cachedModule: typeof import('expo-secure-store') | null = null;

  async function loadModule(): Promise<typeof import('expo-secure-store')> {
    if (!cachedModule) {
      cachedModule = await import('expo-secure-store');
    }
    return cachedModule;
  }

  return {
    async getItemAsync(key) {
      const store = await loadModule();
      return store.getItemAsync(key);
    },
    async setItemAsync(key, value) {
      const store = await loadModule();
      await store.setItemAsync(key, value);
    },
    async deleteItemAsync(key) {
      const store = await loadModule();
      await store.deleteItemAsync(key);
    },
  };
}

function parseTokenPair(raw: string): AuthTokenPair | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    if (typeof record.accessToken !== 'string' || record.accessToken.trim().length === 0) {
      return null;
    }

    const refreshToken =
      typeof record.refreshToken === 'string' && record.refreshToken.trim().length > 0
        ? record.refreshToken
        : undefined;
    const expiresAt =
      typeof record.expiresAt === 'number' && Number.isFinite(record.expiresAt)
        ? record.expiresAt
        : undefined;

    return {
      accessToken: record.accessToken,
      ...(refreshToken !== undefined ? { refreshToken } : {}),
      ...(expiresAt !== undefined ? { expiresAt } : {}),
    };
  } catch {
    return null;
  }
}

export interface SecureTokenStoreOptions {
  readonly storage?: SecureStorageAdapter;
  readonly storageKey?: string;
}

/**
 * `@fastbuild/api-client` `TokenStore` backed by `expo-secure-store` (or an
 * injected `SecureStorageAdapter` for headless unit tests).
 */
export class SecureTokenStore implements TokenStore {
  private readonly storage: SecureStorageAdapter;
  private readonly storageKey: string;

  constructor(options: SecureTokenStoreOptions = {}) {
    this.storage = options.storage ?? createExpoSecureStorageAdapter();
    this.storageKey = options.storageKey ?? DEFAULT_TOKEN_STORAGE_KEY;
  }

  async getTokens(): Promise<AuthTokenPair | null> {
    const raw = await this.storage.getItemAsync(this.storageKey);
    if (!raw) {
      return null;
    }

    const tokens = parseTokenPair(raw);
    if (!tokens) {
      await this.storage.deleteItemAsync(this.storageKey);
      return null;
    }

    return tokens;
  }

  async setTokens(tokens: AuthTokenPair): Promise<void> {
    if (!tokens.accessToken || tokens.accessToken.trim().length === 0) {
      throw new Error('SecureTokenStore.setTokens requires a non-empty accessToken');
    }

    const payload: AuthTokenPair = {
      accessToken: tokens.accessToken,
      ...(tokens.refreshToken !== undefined ? { refreshToken: tokens.refreshToken } : {}),
      ...(tokens.expiresAt !== undefined ? { expiresAt: tokens.expiresAt } : {}),
    };
    await this.storage.setItemAsync(this.storageKey, JSON.stringify(payload));
  }

  async clearTokens(): Promise<void> {
    await this.storage.deleteItemAsync(this.storageKey);
  }
}

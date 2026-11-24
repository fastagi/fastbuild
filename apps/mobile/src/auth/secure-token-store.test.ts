import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TOKEN_STORAGE_KEY,
  SecureTokenStore,
  type SecureStorageAdapter,
} from './secure-token-store';

function createMemorySecureStorage(): SecureStorageAdapter & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async getItemAsync(key) {
      return data.get(key) ?? null;
    },
    async setItemAsync(key, value) {
      data.set(key, value);
    },
    async deleteItemAsync(key) {
      data.delete(key);
    },
  };
}

describe('SecureTokenStore', () => {
  it('returns null when storage is empty', async () => {
    const storage = createMemorySecureStorage();
    const store = new SecureTokenStore({ storage });

    expect(await store.getTokens()).toBeNull();
  });

  it('persists and retrieves access, refresh, and expiry fields', async () => {
    const storage = createMemorySecureStorage();
    const store = new SecureTokenStore({ storage });

    await store.setTokens({
      accessToken: 'acc_123',
      refreshToken: 'ref_456',
      expiresAt: 1_900_000_000_000,
    });

    expect(storage.data.has(DEFAULT_TOKEN_STORAGE_KEY)).toBe(true);
    expect(await store.getTokens()).toEqual({
      accessToken: 'acc_123',
      refreshToken: 'ref_456',
      expiresAt: 1_900_000_000_000,
    });
  });

  it('clears stored tokens cleanly', async () => {
    const storage = createMemorySecureStorage();
    const store = new SecureTokenStore({ storage, storageKey: 'custom.key' });

    await store.setTokens({ accessToken: 'acc_123' });
    await store.clearTokens();

    expect(storage.data.has('custom.key')).toBe(false);
    expect(await store.getTokens()).toBeNull();
  });

  it('rejects empty access tokens', async () => {
    const storage = createMemorySecureStorage();
    const store = new SecureTokenStore({ storage });

    await expect(store.setTokens({ accessToken: '   ' })).rejects.toThrow(
      /non-empty accessToken/,
    );
  });

  it('recovers from corrupted JSON by deleting the broken entry', async () => {
    const storage = createMemorySecureStorage();
    storage.data.set(DEFAULT_TOKEN_STORAGE_KEY, '{not-valid-json');
    const store = new SecureTokenStore({ storage });

    expect(await store.getTokens()).toBeNull();
    expect(storage.data.has(DEFAULT_TOKEN_STORAGE_KEY)).toBe(false);
  });

  it('recovers from schema-invalid JSON missing accessToken', async () => {
    const storage = createMemorySecureStorage();
    storage.data.set(DEFAULT_TOKEN_STORAGE_KEY, JSON.stringify({ refreshToken: 'only_refresh' }));
    const store = new SecureTokenStore({ storage });

    expect(await store.getTokens()).toBeNull();
    expect(storage.data.has(DEFAULT_TOKEN_STORAGE_KEY)).toBe(false);
  });
});

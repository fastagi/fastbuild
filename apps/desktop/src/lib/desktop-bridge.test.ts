import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AuthTokenPair } from '@fastbuild/api-client';
import { describe, expect, it, vi } from 'vitest';
import { ElectronTokenStore, type SafeStorageLike } from '../../electron/token-store.ts';
import { DesktopTokenStore, type FastBuildDesktopBridge } from './desktop-bridge.ts';

function createMockBridge(initial: AuthTokenPair | null = null): {
  bridge: FastBuildDesktopBridge;
  getTokensMock: ReturnType<typeof vi.fn>;
  setTokensMock: ReturnType<typeof vi.fn>;
  clearTokensMock: ReturnType<typeof vi.fn>;
} {
  let stored = initial;
  const getTokensMock = vi.fn(async () => stored);
  const setTokensMock = vi.fn(async (tokens: AuthTokenPair) => {
    stored = tokens;
  });
  const clearTokensMock = vi.fn(async () => {
    stored = null;
  });

  const bridge: FastBuildDesktopBridge = {
    tokens: {
      get: getTokensMock,
      set: setTokensMock,
      clear: clearTokensMock,
    },
    getRuntimeInfo: vi.fn(async () => ({
      appVersion: '0.1.0',
      platform: 'darwin',
      electronVersion: '35.2.0',
      storageMode: 'safeStorage' as const,
    })),
    theme: {
      get: vi.fn(async () => ({ mode: 'system' as const, shouldUseDarkColors: false })),
      set: vi.fn(async (mode) => ({ mode, shouldUseDarkColors: mode === 'dark' })),
      onUpdated: vi.fn(() => () => {}),
    },
  };

  return { bridge, getTokensMock, setTokensMock, clearTokensMock };
}

describe('DesktopTokenStore', () => {
  it('delegates token persistence to window.fastbuildDesktop when running in Electron', async () => {
    const { bridge, getTokensMock, setTokensMock, clearTokensMock } = createMockBridge();
    const store = new DesktopTokenStore(bridge);

    expect(store.isNativeBridge).toBe(true);
    expect(await store.getTokens()).toBeNull();

    const pair: AuthTokenPair = {
      accessToken: 'access-123',
      refreshToken: 'refresh-456',
      expiresAt: Date.now() + 60_000,
    };
    await store.setTokens(pair);
    expect(setTokensMock).toHaveBeenCalledWith(pair);
    expect(await store.getTokens()).toEqual(pair);
    expect(getTokensMock).toHaveBeenCalledTimes(2);

    await store.clearTokens();
    expect(clearTokensMock).toHaveBeenCalledTimes(1);
    expect(await store.getTokens()).toBeNull();
  });

  it('falls back to in-memory storage without touching localStorage outside Electron', async () => {
    const store = new DesktopTokenStore(null);

    expect(store.isNativeBridge).toBe(false);
    await store.setTokens({ accessToken: 'browser-access', refreshToken: 'browser-refresh' });
    expect(await store.getTokens()).toEqual({
      accessToken: 'browser-access',
      refreshToken: 'browser-refresh',
    });
    expect(window.localStorage.length).toBe(0);

    await store.clearTokens();
    expect(await store.getTokens()).toBeNull();
  });
});

describe('ElectronTokenStore', () => {
  it('encrypts and persists tokens with safeStorage when available', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'fastbuild-desktop-test-'));
    const filePath = path.join(tempDir, 'auth-tokens.enc');

    const safeStorage: SafeStorageLike = {
      isEncryptionAvailable: () => true,
      encryptString: (plainText) => Buffer.from(`enc:${plainText}`, 'utf8'),
      decryptString: (encrypted) => {
        const text = encrypted.toString('utf8');
        if (!text.startsWith('enc:')) {
          throw new Error('corrupt ciphertext');
        }
        return text.slice(4);
      },
    };

    try {
      const store = new ElectronTokenStore({ filePath, safeStorage });
      expect(store.storageMode).toBe('safeStorage');

      await store.setTokens({ accessToken: 'secret-access', refreshToken: 'secret-refresh' });
      const rawFile = await readFile(filePath, 'utf8');
      expect(rawFile.startsWith('enc:')).toBe(true);

      const loaded = await store.getTokens();
      expect(loaded).toEqual({ accessToken: 'secret-access', refreshToken: 'secret-refresh' });

      await store.clearTokens();
      expect(await store.getTokens()).toBeNull();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('falls back to memory without writing plaintext when safeStorage is unavailable', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'fastbuild-desktop-headless-'));
    const filePath = path.join(tempDir, 'auth-tokens.enc');

    const unavailableStorage: SafeStorageLike = {
      isEncryptionAvailable: () => false,
      encryptString: () => {
        throw new Error('should not be called');
      },
      decryptString: () => {
        throw new Error('should not be called');
      },
    };

    try {
      const store = new ElectronTokenStore({ filePath, safeStorage: unavailableStorage });
      expect(store.storageMode).toBe('memory-fallback');

      await store.setTokens({ accessToken: 'headless-access', refreshToken: 'headless-refresh' });
      expect(await store.getTokens()).toEqual({
        accessToken: 'headless-access',
        refreshToken: 'headless-refresh',
      });

      await expect(readFile(filePath)).rejects.toThrow();

      await store.clearTokens();
      expect(await store.getTokens()).toBeNull();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

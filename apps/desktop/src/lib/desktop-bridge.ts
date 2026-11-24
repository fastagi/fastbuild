import { MemoryTokenStore, type AuthTokenPair, type TokenStore } from '@fastbuild/api-client';

export type DesktopThemeMode = 'light' | 'dark' | 'system';

export type TokenStorageMode = 'safeStorage' | 'memory-fallback' | 'browser-memory';

export interface DesktopRuntimeInfo {
  readonly appVersion: string;
  readonly platform: string;
  readonly electronVersion: string;
  readonly storageMode: 'safeStorage' | 'memory-fallback';
}

export interface DesktopThemeState {
  readonly mode: DesktopThemeMode;
  readonly shouldUseDarkColors: boolean;
}

export interface FastBuildDesktopBridge {
  readonly tokens: {
    get(): Promise<AuthTokenPair | null>;
    set(tokens: AuthTokenPair): Promise<void>;
    clear(): Promise<void>;
  };
  getRuntimeInfo(): Promise<DesktopRuntimeInfo>;
  readonly theme: {
    get(): Promise<DesktopThemeState>;
    set(mode: DesktopThemeMode): Promise<DesktopThemeState>;
    onUpdated(listener: (state: DesktopThemeState) => void): () => void;
  };
}

declare global {
  interface Window {
    readonly fastbuildDesktop?: FastBuildDesktopBridge;
  }
}

export function getDesktopBridge(): FastBuildDesktopBridge | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.fastbuildDesktop ?? null;
}

/**
 * Renderer TokenStore adapter backed by the Electron `window.fastbuildDesktop`
 * preload bridge (OS keychain via `safeStorage`), falling back to in-memory
 * storage when running outside Electron (e.g. Vite browser dev preview).
 */
export class DesktopTokenStore implements TokenStore {
  private readonly bridge: FastBuildDesktopBridge | null;
  private readonly fallback = new MemoryTokenStore();

  constructor(bridge: FastBuildDesktopBridge | null = getDesktopBridge()) {
    this.bridge = bridge;
  }

  get isNativeBridge(): boolean {
    return this.bridge !== null;
  }

  async getTokens(): Promise<AuthTokenPair | null> {
    if (this.bridge) {
      return this.bridge.tokens.get();
    }
    return this.fallback.getTokens();
  }

  async setTokens(tokens: AuthTokenPair): Promise<void> {
    if (this.bridge) {
      await this.bridge.tokens.set(tokens);
      return;
    }
    this.fallback.setTokens(tokens);
  }

  async clearTokens(): Promise<void> {
    if (this.bridge) {
      await this.bridge.tokens.clear();
      return;
    }
    this.fallback.clearTokens();
  }
}

import { contextBridge, ipcRenderer } from 'electron';
import type { StoredAuthTokens, TokenStorageMode } from './token-store.js';

export type DesktopThemeMode = 'light' | 'dark' | 'system';

export interface DesktopRuntimeInfo {
  readonly appVersion: string;
  readonly platform: string;
  readonly electronVersion: string;
  readonly storageMode: TokenStorageMode;
}

export interface DesktopThemeState {
  readonly mode: DesktopThemeMode;
  readonly shouldUseDarkColors: boolean;
}

export interface FastBuildDesktopBridge {
  readonly tokens: {
    get(): Promise<StoredAuthTokens | null>;
    set(tokens: StoredAuthTokens): Promise<void>;
    clear(): Promise<void>;
  };
  getRuntimeInfo(): Promise<DesktopRuntimeInfo>;
  readonly theme: {
    get(): Promise<DesktopThemeState>;
    set(mode: DesktopThemeMode): Promise<DesktopThemeState>;
    onUpdated(listener: (state: DesktopThemeState) => void): () => void;
  };
}

const IPC_CHANNELS = {
  TOKENS_GET: 'fastbuild:tokens:get',
  TOKENS_SET: 'fastbuild:tokens:set',
  TOKENS_CLEAR: 'fastbuild:tokens:clear',
  RUNTIME_INFO: 'fastbuild:runtime:info',
  THEME_GET: 'fastbuild:theme:get',
  THEME_SET: 'fastbuild:theme:set',
  THEME_UPDATED: 'fastbuild:theme:updated',
} as const;

const desktopBridge: FastBuildDesktopBridge = {
  tokens: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.TOKENS_GET) as Promise<StoredAuthTokens | null>,
    set: (tokens) => ipcRenderer.invoke(IPC_CHANNELS.TOKENS_SET, tokens) as Promise<void>,
    clear: () => ipcRenderer.invoke(IPC_CHANNELS.TOKENS_CLEAR) as Promise<void>,
  },
  getRuntimeInfo: () =>
    ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_INFO) as Promise<DesktopRuntimeInfo>,
  theme: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.THEME_GET) as Promise<DesktopThemeState>,
    set: (mode) => ipcRenderer.invoke(IPC_CHANNELS.THEME_SET, mode) as Promise<DesktopThemeState>,
    onUpdated(listener) {
      const handler = (_event: Electron.IpcRendererEvent, state: DesktopThemeState) => {
        listener(state);
      };
      ipcRenderer.on(IPC_CHANNELS.THEME_UPDATED, handler);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.THEME_UPDATED, handler);
      };
    },
  },
};

contextBridge.exposeInMainWorld('fastbuildDesktop', desktopBridge);

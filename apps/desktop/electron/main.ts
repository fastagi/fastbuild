import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, ipcMain, nativeTheme, safeStorage } from 'electron';
import type { DesktopRuntimeInfo, DesktopThemeMode, DesktopThemeState } from './preload.js';
import {
  ElectronTokenStore,
  resolveTokenStorePath,
  type StoredAuthTokens,
} from './token-store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VALID_THEME_MODES = new Set<DesktopThemeMode>(['light', 'dark', 'system']);

function isThemeMode(value: unknown): value is DesktopThemeMode {
  return typeof value === 'string' && VALID_THEME_MODES.has(value as DesktopThemeMode);
}

function getCurrentThemeState(): DesktopThemeState {
  const mode = isThemeMode(nativeTheme.themeSource) ? nativeTheme.themeSource : 'system';
  return {
    mode,
    shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
  };
}

function isAllowedNavigationUrl(rawUrl: string, devServerUrl: string | undefined): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'file:') {
      return true;
    }
    if (devServerUrl) {
      const allowedDevOrigin = new URL(devServerUrl).origin;
      return parsed.origin === allowedDevOrigin;
    }
    return false;
  } catch {
    return false;
  }
}

function createMainWindow(): BrowserWindow {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL?.trim();

  const window = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 860,
    minHeight: 600,
    title: 'FastBuild Desktop',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#121212' : '#fafafa',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigationUrl(url, devServerUrl)) {
      event.preventDefault();
    }
  });

  if (devServerUrl) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  return window;
}

function registerIpcHandlers(tokenStore: ElectronTokenStore): void {
  ipcMain.handle('fastbuild:tokens:get', () => tokenStore.getTokens());

  ipcMain.handle('fastbuild:tokens:set', (_event, tokens: StoredAuthTokens) =>
    tokenStore.setTokens(tokens),
  );

  ipcMain.handle('fastbuild:tokens:clear', () => tokenStore.clearTokens());

  ipcMain.handle(
    'fastbuild:runtime:info',
    (): DesktopRuntimeInfo => ({
      appVersion: app.getVersion(),
      platform: process.platform,
      electronVersion: process.versions.electron ?? 'unknown',
      storageMode: tokenStore.storageMode,
    }),
  );

  ipcMain.handle('fastbuild:theme:get', (): DesktopThemeState => getCurrentThemeState());

  ipcMain.handle('fastbuild:theme:set', (_event, mode: unknown): DesktopThemeState => {
    if (!isThemeMode(mode)) {
      throw new Error('Invalid desktop theme mode');
    }
    nativeTheme.themeSource = mode;
    return getCurrentThemeState();
  });

  nativeTheme.on('updated', () => {
    const state = getCurrentThemeState();
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('fastbuild:theme:updated', state);
    }
  });
}

void app.whenReady().then(() => {
  const tokenStore = new ElectronTokenStore({
    filePath: resolveTokenStorePath(app.getPath('userData')),
    safeStorage,
  });

  registerIpcHandlers(tokenStore);
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

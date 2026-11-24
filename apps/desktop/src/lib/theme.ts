import type { DesktopThemeMode, FastBuildDesktopBridge } from './desktop-bridge.ts';

const THEME_STORAGE_KEY = 'fastbuild.desktop.theme';

export function isDesktopThemeMode(value: unknown): value is DesktopThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function loadSavedThemeMode(): DesktopThemeMode {
  if (typeof window === 'undefined') {
    return 'system';
  }
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isDesktopThemeMode(saved) ? saved : 'system';
}

export function saveThemeMode(mode: DesktopThemeMode): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  }
}

export function resolveShouldUseDark(mode: DesktopThemeMode): boolean {
  if (mode === 'dark') {
    return true;
  }
  if (mode === 'light') {
    return false;
  }
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

export function applyThemeToDocument(shouldUseDark: boolean): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.classList.toggle('dark', shouldUseDark);
}

export async function syncThemeWithDesktop(
  mode: DesktopThemeMode,
  bridge: FastBuildDesktopBridge | null,
): Promise<boolean> {
  saveThemeMode(mode);
  if (bridge) {
    const state = await bridge.theme.set(mode);
    applyThemeToDocument(state.shouldUseDarkColors);
    return state.shouldUseDarkColors;
  }
  const shouldUseDark = resolveShouldUseDark(mode);
  applyThemeToDocument(shouldUseDark);
  return shouldUseDark;
}

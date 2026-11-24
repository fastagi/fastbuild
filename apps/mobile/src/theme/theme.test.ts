import { describe, expect, it } from 'vitest';
import { BRAND_MARK_RECTS, BRAND_MARK_VIEWBOX, BRAND_NAME } from '@fastbuild/tokens';
import {
  DEFAULT_THEME_MODE,
  getRnTheme,
  resolveThemeMode,
  rnDarkTheme,
  rnLightTheme,
  toggleThemeMode,
} from './theme';

describe('Mobile theme & tokens integration', () => {
  it('exposes obsidian dark and alabaster light palettes from @fastbuild/tokens', () => {
    expect(getRnTheme('dark')).toEqual(rnDarkTheme);
    expect(getRnTheme('light')).toEqual(rnLightTheme);
    expect(rnDarkTheme.colors.background).toBe('#050505');
    expect(rnLightTheme.colors.background).toBe('#fafafa');
    expect(rnDarkTheme.colors.brand).not.toBe(rnLightTheme.colors.brand);
  });

  it('resolves system color schemes with dark fallback', () => {
    expect(resolveThemeMode('light')).toBe('light');
    expect(resolveThemeMode('dark')).toBe('dark');
    expect(resolveThemeMode(null)).toBe(DEFAULT_THEME_MODE);
    expect(resolveThemeMode(undefined)).toBe(DEFAULT_THEME_MODE);
  });

  it('toggles between dark and light modes', () => {
    expect(toggleThemeMode('dark')).toBe('light');
    expect(toggleThemeMode('light')).toBe('dark');
  });

  it('shares the exact Modular Stack F brand mark geometry', () => {
    expect(BRAND_NAME).toBe('FastBuild');
    expect(BRAND_MARK_VIEWBOX).toBe('0 0 24 24');
    expect(BRAND_MARK_RECTS).toHaveLength(3);
    expect(BRAND_MARK_RECTS[0]?.width).toBeGreaterThan(BRAND_MARK_RECTS[1]!.width);
    expect(BRAND_MARK_RECTS[1]?.width).toBeGreaterThan(BRAND_MARK_RECTS[2]!.width);
  });
});

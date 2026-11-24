import {
  getRnTheme,
  radii,
  rnDarkTheme,
  rnLightTheme,
  spacing,
  type RnTheme,
  type SemanticColorTokens,
  type ThemeMode,
} from '@fastbuild/tokens';

export { getRnTheme, radii, rnDarkTheme, rnLightTheme, spacing };
export type { RnTheme, SemanticColorTokens, ThemeMode };

export const DEFAULT_THEME_MODE: ThemeMode = 'dark';

export function resolveThemeMode(systemScheme?: string | null): ThemeMode {
  if (systemScheme === 'light' || systemScheme === 'dark') {
    return systemScheme;
  }
  return DEFAULT_THEME_MODE;
}

export function toggleThemeMode(current: ThemeMode): ThemeMode {
  return current === 'dark' ? 'light' : 'dark';
}

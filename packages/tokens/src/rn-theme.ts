import type { SemanticColorTokens, ThemeMode } from './tokens.ts';

/**
 * React Native / NativeWind hex and rgba color tokens matching FastBuild's
 * zero-chroma alabaster (light) and obsidian (dark) OKLCH palettes.
 */

export interface RnTheme {
  readonly mode: ThemeMode;
  readonly colors: SemanticColorTokens;
}

export const rnLightTheme: RnTheme = {
  mode: 'light',
  colors: {
    background: '#fafafa',
    foreground: '#0a0a0a',
    card: '#ffffff',
    cardForeground: '#0a0a0a',
    popover: '#ffffff',
    popoverForeground: '#0a0a0a',
    primary: '#0a0a0a',
    primaryForeground: '#fafafa',
    secondary: '#f0f0f0',
    secondaryForeground: '#0a0a0a',
    muted: '#f2f2f2',
    mutedForeground: '#5e5e5e',
    accent: '#f0f0f0',
    accentForeground: '#0a0a0a',
    destructive: '#dc2626',
    destructiveForeground: '#fafafa',
    border: '#e3e3e3',
    input: '#dedede',
    ring: '#525252',
    surface: '#ffffff',
    subtle: '#5e5e5e',
    brand: '#1d6ce0',
    brandForeground: '#fafafa',
    brandStrong: '#1c2b47',
    brandSubtle: '#eff3fa',
    success: '#2a8a4b',
    successStrong: '#1e6336',
    successSubtle: '#eaf6ee',
    warning: '#b88318',
    warningStrong: '#754f0b',
    warningSubtle: '#f9f3e3',
    danger: '#dc2626',
    dangerStrong: '#b5221a',
    dangerSubtle: '#faeae8',
    info: '#1c7db8',
    infoSubtle: '#eaf4fa',
    sidebar: '#fafafa',
    sidebarForeground: '#0a0a0a',
    sidebarBorder: '#e3e3e3',
  },
};

export const rnDarkTheme: RnTheme = {
  mode: 'dark',
  colors: {
    background: '#050505',
    foreground: '#fafafa',
    card: '#0a0a0a',
    cardForeground: '#fafafa',
    popover: '#121212',
    popoverForeground: '#fafafa',
    primary: '#fafafa',
    primaryForeground: '#0a0a0a',
    secondary: '#171717',
    secondaryForeground: '#fafafa',
    muted: '#171717',
    mutedForeground: '#999999',
    accent: '#171717',
    accentForeground: '#fafafa',
    destructive: '#f05252',
    destructiveForeground: '#0a0a0a',
    border: 'rgba(255, 255, 255, 0.1)',
    input: 'rgba(255, 255, 255, 0.14)',
    ring: '#a1a1a1',
    surface: '#0a0a0a',
    subtle: '#999999',
    brand: '#5995eb',
    brandForeground: '#0a0a0a',
    brandStrong: '#e6ecf7',
    brandSubtle: '#171b24',
    success: '#4db870',
    successStrong: '#69c987',
    successSubtle: '#16291d',
    warning: '#deb042',
    warningStrong: '#e8bf5a',
    warningSubtle: '#292214',
    danger: '#eb6354',
    dangerStrong: '#f27c6e',
    dangerSubtle: '#2e1614',
    info: '#52a7db',
    infoSubtle: '#142530',
    sidebar: '#050505',
    sidebarForeground: '#fafafa',
    sidebarBorder: 'rgba(255, 255, 255, 0.1)',
  },
};

export const rnThemes: Readonly<Record<ThemeMode, RnTheme>> = {
  light: rnLightTheme,
  dark: rnDarkTheme,
};

export function getRnTheme(mode: ThemeMode): RnTheme {
  return rnThemes[mode];
}

/**
 * FastBuild semantic design tokens.
 *
 * Pure zero-chroma alabaster (light) and obsidian (dark) neutral surfaces with
 * Rhine blue brand accents, aligned across Web, Admin, Desktop, and Mobile.
 */

export type ThemeMode = 'light' | 'dark';

export interface SemanticColorTokens {
  readonly background: string;
  readonly foreground: string;
  readonly card: string;
  readonly cardForeground: string;
  readonly popover: string;
  readonly popoverForeground: string;
  readonly primary: string;
  readonly primaryForeground: string;
  readonly secondary: string;
  readonly secondaryForeground: string;
  readonly muted: string;
  readonly mutedForeground: string;
  readonly accent: string;
  readonly accentForeground: string;
  readonly destructive: string;
  readonly destructiveForeground: string;
  readonly border: string;
  readonly input: string;
  readonly ring: string;
  readonly surface: string;
  readonly subtle: string;
  readonly brand: string;
  readonly brandForeground: string;
  readonly brandStrong: string;
  readonly brandSubtle: string;
  readonly success: string;
  readonly successStrong: string;
  readonly successSubtle: string;
  readonly warning: string;
  readonly warningStrong: string;
  readonly warningSubtle: string;
  readonly danger: string;
  readonly dangerStrong: string;
  readonly dangerSubtle: string;
  readonly info: string;
  readonly infoSubtle: string;
  readonly sidebar: string;
  readonly sidebarForeground: string;
  readonly sidebarBorder: string;
}

/** Pure zero-chroma alabaster light palette (OKLCH). */
export const lightTokens: SemanticColorTokens = {
  background: 'oklch(0.985 0 0)',
  foreground: 'oklch(0.145 0 0)',
  card: 'oklch(1 0 0)',
  cardForeground: 'oklch(0.145 0 0)',
  popover: 'oklch(1 0 0)',
  popoverForeground: 'oklch(0.145 0 0)',
  primary: 'oklch(0.145 0 0)',
  primaryForeground: 'oklch(0.985 0 0)',
  secondary: 'oklch(0.955 0 0)',
  secondaryForeground: 'oklch(0.145 0 0)',
  muted: 'oklch(0.96 0 0)',
  mutedForeground: 'oklch(0.48 0 0)',
  accent: 'oklch(0.955 0 0)',
  accentForeground: 'oklch(0.145 0 0)',
  destructive: 'oklch(0.56 0.235 27.325)',
  destructiveForeground: 'oklch(0.985 0 0)',
  border: 'oklch(0.915 0 0)',
  input: 'oklch(0.9 0 0)',
  ring: 'oklch(0.439 0 0)',
  surface: 'oklch(1 0 0)',
  subtle: 'oklch(0.48 0 0)',
  brand: 'oklch(0.5 0.2 250)',
  brandForeground: 'oklch(0.985 0 0)',
  brandStrong: 'oklch(0.28 0.06 250)',
  brandSubtle: 'oklch(0.955 0.008 250)',
  success: 'oklch(0.55 0.14 150)',
  successStrong: 'oklch(0.41 0.12 150)',
  successSubtle: 'oklch(0.95 0.04 150)',
  warning: 'oklch(0.68 0.14 78)',
  warningStrong: 'oklch(0.46 0.12 70)',
  warningSubtle: 'oklch(0.96 0.04 82)',
  danger: 'oklch(0.56 0.235 27.325)',
  dangerStrong: 'oklch(0.48 0.2 27)',
  dangerSubtle: 'oklch(0.96 0.035 25)',
  info: 'oklch(0.55 0.15 230)',
  infoSubtle: 'oklch(0.95 0.03 230)',
  sidebar: 'oklch(0.985 0 0)',
  sidebarForeground: 'oklch(0.145 0 0)',
  sidebarBorder: 'oklch(0.915 0 0)',
};

/** Pure zero-chroma obsidian dark palette (OKLCH). */
export const darkTokens: SemanticColorTokens = {
  background: 'oklch(0.1 0 0)',
  foreground: 'oklch(0.985 0 0)',
  card: 'oklch(0.145 0 0)',
  cardForeground: 'oklch(0.985 0 0)',
  popover: 'oklch(0.175 0 0)',
  popoverForeground: 'oklch(0.985 0 0)',
  primary: 'oklch(0.985 0 0)',
  primaryForeground: 'oklch(0.145 0 0)',
  secondary: 'oklch(0.205 0 0)',
  secondaryForeground: 'oklch(0.985 0 0)',
  muted: 'oklch(0.205 0 0)',
  mutedForeground: 'oklch(0.68 0 0)',
  accent: 'oklch(0.205 0 0)',
  accentForeground: 'oklch(0.985 0 0)',
  destructive: 'oklch(0.704 0.191 22.216)',
  destructiveForeground: 'oklch(0.145 0 0)',
  border: 'oklch(1 0 0 / 10%)',
  input: 'oklch(1 0 0 / 14%)',
  ring: 'oklch(0.708 0 0)',
  surface: 'oklch(0.145 0 0)',
  subtle: 'oklch(0.68 0 0)',
  brand: 'oklch(0.65 0.15 250)',
  brandForeground: 'oklch(0.145 0 0)',
  brandStrong: 'oklch(0.94 0.015 250)',
  brandSubtle: 'oklch(0.21 0.01 250)',
  success: 'oklch(0.7 0.13 150)',
  successStrong: 'oklch(0.75 0.12 150)',
  successSubtle: 'oklch(0.24 0.04 150)',
  warning: 'oklch(0.77 0.13 78)',
  warningStrong: 'oklch(0.8 0.12 78)',
  warningSubtle: 'oklch(0.25 0.04 78)',
  danger: 'oklch(0.7 0.17 27)',
  dangerStrong: 'oklch(0.75 0.16 27)',
  dangerSubtle: 'oklch(0.25 0.05 27)',
  info: 'oklch(0.7 0.14 230)',
  infoSubtle: 'oklch(0.24 0.04 230)',
  sidebar: 'oklch(0.1 0 0)',
  sidebarForeground: 'oklch(0.985 0 0)',
  sidebarBorder: 'oklch(1 0 0 / 10%)',
};

export const radii = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  full: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
} as const;

export const motion = {
  responseMs: 220,
  curve: 'cubic-bezier(0.22, 1, 0.36, 1)',
} as const;

export const typography = {
  fontSans:
    "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontMono:
    "'SFMono-Regular', ui-monospace, Consolas, 'Liberation Mono', Menlo, monospace",
} as const;

export const designTokens = {
  colors: {
    light: lightTokens,
    dark: darkTokens,
  },
  radii,
  spacing,
  motion,
  typography,
} as const;

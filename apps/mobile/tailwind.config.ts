import type { Config } from 'tailwindcss';
import { rnDarkTheme, rnLightTheme } from '@fastbuild/tokens';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Default light (alabaster) palette synced with @fastbuild/tokens
        background: rnLightTheme.colors.background,
        foreground: rnLightTheme.colors.foreground,
        card: {
          DEFAULT: rnLightTheme.colors.card,
          foreground: rnLightTheme.colors.cardForeground,
        },
        primary: {
          DEFAULT: rnLightTheme.colors.primary,
          foreground: rnLightTheme.colors.primaryForeground,
        },
        secondary: {
          DEFAULT: rnLightTheme.colors.secondary,
          foreground: rnLightTheme.colors.secondaryForeground,
        },
        muted: {
          DEFAULT: rnLightTheme.colors.muted,
          foreground: rnLightTheme.colors.mutedForeground,
        },
        accent: {
          DEFAULT: rnLightTheme.colors.accent,
          foreground: rnLightTheme.colors.accentForeground,
        },
        destructive: {
          DEFAULT: rnLightTheme.colors.destructive,
          foreground: rnLightTheme.colors.destructiveForeground,
        },
        border: rnLightTheme.colors.border,
        input: rnLightTheme.colors.input,
        ring: rnLightTheme.colors.ring,
        brand: {
          DEFAULT: rnLightTheme.colors.brand,
          foreground: rnLightTheme.colors.brandForeground,
          strong: rnLightTheme.colors.brandStrong,
          subtle: rnLightTheme.colors.brandSubtle,
        },
        success: {
          DEFAULT: rnLightTheme.colors.success,
          strong: rnLightTheme.colors.successStrong,
          subtle: rnLightTheme.colors.successSubtle,
        },
        warning: {
          DEFAULT: rnLightTheme.colors.warning,
          strong: rnLightTheme.colors.warningStrong,
          subtle: rnLightTheme.colors.warningSubtle,
        },
        danger: {
          DEFAULT: rnLightTheme.colors.danger,
          strong: rnLightTheme.colors.dangerStrong,
          subtle: rnLightTheme.colors.dangerSubtle,
        },
        // Explicit obsidian dark tokens for NativeWind dark: utilities
        obsidian: {
          background: rnDarkTheme.colors.background,
          foreground: rnDarkTheme.colors.foreground,
          card: rnDarkTheme.colors.card,
          secondary: rnDarkTheme.colors.secondary,
          muted: rnDarkTheme.colors.muted,
          mutedForeground: rnDarkTheme.colors.mutedForeground,
          brand: rnDarkTheme.colors.brand,
        },
      },
    },
  },
  plugins: [],
};

export default config;

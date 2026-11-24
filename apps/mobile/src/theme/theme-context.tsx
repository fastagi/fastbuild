import * as React from 'react';
import { useColorScheme } from 'react-native';
import {
  getRnTheme,
  resolveThemeMode,
  toggleThemeMode,
  type RnTheme,
  type SemanticColorTokens,
  type ThemeMode,
} from './theme';

export interface ThemeContextValue {
  readonly mode: ThemeMode;
  readonly isDark: boolean;
  readonly theme: RnTheme;
  readonly colors: SemanticColorTokens;
  readonly setMode: (mode: ThemeMode) => void;
  readonly toggleMode: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  readonly initialMode?: ThemeMode;
  readonly children: React.ReactNode;
}

export function ThemeProvider({ initialMode, children }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = React.useState<ThemeMode>(
    () => initialMode ?? resolveThemeMode(systemScheme),
  );

  const toggleMode = React.useCallback(() => {
    setMode((prev) => toggleThemeMode(prev));
  }, []);

  const value = React.useMemo<ThemeContextValue>(() => {
    const theme = getRnTheme(mode);
    return {
      mode,
      isDark: mode === 'dark',
      theme,
      colors: theme.colors,
      setMode,
      toggleMode,
    };
  }, [mode, toggleMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside a ThemeProvider');
  }
  return ctx;
}

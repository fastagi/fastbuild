import { useEffect } from 'react';
import { useResolvedTheme } from '@/features/preferences/hooks/use-resolved-theme';

export function ThemeSync() {
  const dark = useResolvedTheme();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    root.style.colorScheme = dark ? 'dark' : 'light';
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', getComputedStyle(root).getPropertyValue('--theme-color').trim());
  }, [dark]);

  return null;
}

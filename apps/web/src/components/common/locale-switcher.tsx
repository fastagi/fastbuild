/**
 * @component LanguageSwitcher
 * @category Common
 * @status Stable
 * @description A dropdown menu for switching application language/locale.
 * @usage Place in the application header or settings for global language control.
 * @example
 * <LanguageSwitcher />
 */
'use client';

import * as React from 'react';
import { Globe, Check } from 'lucide-react';
import { useLocale } from '@/hooks/use-locale';
import { locales, localeNames, isLocaleSwitcherEnabled, useT } from '@/i18n';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils';

export function LanguageSwitcher() {
  const { locale, setLocale, isPending } = useLocale();
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const menuId = React.useId();

  React.useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!isLocaleSwitcherEnabled) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <Button
        variant="ghost"
        isIcon
        noScale
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="h-9 w-9 rounded-full hover:bg-muted/50 transition-colors"
        disabled={isPending}
        onClick={() => setOpen(prev => !prev)}
      >
        <Globe
          aria-hidden="true"
          className={cn(
            'size-4.5 text-text-muted transition-transform duration-300',
            isPending && 'animate-spin'
          )}
        />
        <span className="sr-only">{t('common.toggleLanguage')}</span>
      </Button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 mt-1 z-50 w-[160px] rounded-xl border border-border/50 bg-popover/95 p-1 text-popover-foreground shadow-premium backdrop-blur-md animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="px-2 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">
            {t('common.selectLanguage')}
          </div>
          {locales.map(loc => (
            <button
              key={loc}
              type="button"
              role="menuitemradio"
              aria-checked={locale === loc}
              onClick={() => {
                setOpen(false);
                setLocale(loc);
              }}
              className={cn(
                'w-full rounded-lg cursor-pointer flex items-center justify-between px-2 py-2 text-sm outline-hidden transition-colors focus-visible:bg-accent focus-visible:text-accent-foreground',
                locale === loc
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-text-subtle hover:bg-muted/50'
              )}
            >
              <span>{localeNames[loc]}</span>
              {locale === loc && <Check className="h-4 w-4" aria-hidden="true" />}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

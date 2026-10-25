import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { type LucideIcon, LogOut, Moon, RefreshCw, Search, Sun } from 'lucide-react';
import { type KeyboardEvent, useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { navigationItems } from '@/components/layout/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { isFeatureEnabled } from '@/config/env';
import { useSignOut } from '@/features/operator-session/hooks/use-operator-session';
import { useResolvedTheme } from '@/features/preferences/hooks/use-resolved-theme';
import { usePreferencesStore } from '@/features/preferences/store/preferences-store';
import { isPaletteShortcut } from '@/features/command-palette/shortcut';
import { readinessQueryKey } from '@/features/system/hooks/use-api-readiness';
import { cn } from '@/lib/cn';

interface Command {
  id: string;
  group: 'navigate' | 'actions';
  label: string;
  icon: LucideIcon;
  run: () => void;
}

/** Keyboard-first jump to any console page or common action, opened with ⌘K / Ctrl+K. */
export function CommandPalette() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dark = useResolvedTheme();
  const setTheme = usePreferencesStore((state) => state.setTheme);
  const { mutate: signOut } = useSignOut();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const optionId = (index: number) => `${listId}-option-${index}`;

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (isPaletteShortcut(event)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const commands = useMemo<Command[]>(() => {
    const destinations = navigationItems.map((item) => ({
      id: item.to,
      group: 'navigate' as const,
      label: t(item.labelKey),
      icon: item.icon,
      run: () => void navigate({ to: item.to }),
    }));
    const actions: Command[] = [
      {
        id: 'theme',
        group: 'actions',
        label: dark ? t('commandPalette.lightTheme') : t('commandPalette.darkTheme'),
        icon: dark ? Sun : Moon,
        run: () => setTheme(dark ? 'light' : 'dark'),
      },
      {
        id: 'readiness',
        group: 'actions',
        label: t('commandPalette.refreshApi'),
        icon: RefreshCw,
        run: () => {
          void queryClient.invalidateQueries({ queryKey: readinessQueryKey });
          toast.success(t('commandPalette.refreshed'));
        },
      },
    ];
    if (isFeatureEnabled('operator')) {
      actions.push({
        id: 'sign-out',
        group: 'actions',
        label: t('auth.signOut'),
        icon: LogOut,
        run: () =>
          signOut(undefined, {
            onSettled: () => void navigate({ to: '/login', replace: true }),
          }),
      });
    }
    return [...destinations, ...actions];
  }, [dark, navigate, queryClient, setTheme, signOut, t]);

  const needle = query.trim().toLowerCase();
  const matches = needle
    ? commands.filter((command) => command.label.toLowerCase().includes(needle))
    : commands;
  const current = Math.min(active, Math.max(matches.length - 1, 0));

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery('');
      setActive(0);
    }
  };

  const execute = (command: Command | undefined) => {
    if (!command) {
      return;
    }
    changeOpen(false);
    command.run();
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (matches.length === 0) {
      return;
    }
    const moves: Record<string, number> = {
      ArrowDown: (current + 1) % matches.length,
      ArrowUp: (current - 1 + matches.length) % matches.length,
      Home: 0,
      End: matches.length - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      setActive(moves[event.key] ?? 0);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      execute(matches[current]);
    }
  };

  const groups = (['navigate', 'actions'] as const)
    .map((group) => ({
      group,
      items: matches
        .map((command, index) => ({ command, index }))
        .filter(({ command }) => command.group === group),
    }))
    .filter(({ items }) => items.length > 0);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-keyshortcuts="Meta+K Control+K"
        onClick={() => changeOpen(true)}
        className="h-8 gap-2 text-muted-foreground sm:w-56 sm:justify-start"
      >
        <Search aria-hidden="true" />
        <span className="sr-only sm:not-sr-only sm:flex-1 sm:text-left">
          {t('commandPalette.trigger')}
        </span>
        <kbd className="pointer-events-none hidden rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:inline">
          ⌘K
        </kbd>
      </Button>

      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="top-[15%] max-w-lg translate-y-0 gap-0 overflow-hidden p-0">
          <DialogTitle className="sr-only">{t('commandPalette.title')}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('commandPalette.description')}
          </DialogDescription>
          <div className="flex items-center gap-2 border-b px-3">
            <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <input
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={matches.length ? optionId(current) : undefined}
              aria-label={t('commandPalette.search')}
              placeholder={t('commandPalette.placeholder')}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onInputKeyDown}
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div id={listId} role="listbox" className="max-h-80 overflow-y-auto p-1.5">
            {groups.map(({ group, items }) => (
              <div key={group} role="group" aria-labelledby={`${listId}-${group}`}>
                <p
                  id={`${listId}-${group}`}
                  className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground"
                >
                  {t(`commandPalette.groups.${group}`)}
                </p>
                {items.map(({ command, index }) => {
                  const Icon = command.icon;
                  return (
                    <div
                      key={command.id}
                      id={optionId(index)}
                      role="option"
                      aria-selected={index === current}
                      tabIndex={-1}
                      onMouseMove={() => setActive(index)}
                      onClick={() => execute(command)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          execute(command);
                        }
                      }}
                      className={cn(
                        'flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm',
                        index === current && 'bg-brand-subtle text-brand-strong',
                      )}
                    >
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                      {command.label}
                    </div>
                  );
                })}
              </div>
            ))}
            {matches.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                {t('commandPalette.empty', { query: query.trim() })}
              </p>
            ) : null}
          </div>
          <div className="flex gap-4 border-t px-3 py-2 text-xs text-muted-foreground">
            <span>{t('commandPalette.hintMove')}</span>
            <span>{t('commandPalette.hintRun')}</span>
            <span>{t('commandPalette.hintClose')}</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

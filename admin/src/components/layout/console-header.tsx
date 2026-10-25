import { Link, useRouterState } from '@tanstack/react-router';
import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CommandPalette } from '@/features/command-palette/components/command-palette';
import { useResolvedTheme } from '@/features/preferences/hooks/use-resolved-theme';
import { usePreferencesStore } from '@/features/preferences/store/preferences-store';

export function ConsoleHeader() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const dark = useResolvedTheme();
  const setTheme = usePreferencesStore((state) => state.setTheme);
  const pageTitles: Record<string, string> = {
    '/console/preferences': t('navigation.preferences'),
    '/console/users': t('navigation.users'),
    '/console/audit': t('navigation.audit'),
    '/console/settings': t('navigation.settings'),
    '/console/organizations': t('navigation.organizations'),
    '/console/notifications': t('navigation.notifications'),
  };
  const currentPage =
    pageTitles[pathname] ??
    (pathname.startsWith('/console/organizations/')
      ? t('navigation.organizations')
      : t('navigation.overview'));
  const themeLabel = dark ? t('preferences.light') : t('preferences.dark');

  return (
    <header className="console-header-material sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 px-4">
      <SidebarTrigger
        label={t('navigation.toggle')}
        aria-label={t('navigation.toggle')}
        title={t('navigation.toggle')}
        className="-ml-1"
      />
      <Separator orientation="vertical" className="mr-1 h-4" />

      <Breadcrumb aria-label={t('navigation.breadcrumb')} className="min-w-0">
        <BreadcrumbList className="flex-nowrap">
          <BreadcrumbItem className="hidden sm:inline-flex">
            <BreadcrumbLink asChild>
              <Link to="/console">{t('navigation.console')}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden sm:block" />
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbPage className="truncate font-medium">{currentPage}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-1">
        <CommandPalette />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label={themeLabel}
              onClick={() => setTheme(dark ? 'light' : 'dark')}
            >
              {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{themeLabel}</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}

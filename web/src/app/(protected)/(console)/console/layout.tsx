'use client';

import { lazy, Suspense, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LucideIcon,
  BarChart3,
  Settings,
  Home,
  Bell,
  LogOut,
  Palette,
  Building2,
  FolderOpen,
  Gauge,
  ArrowUpRight,
  Menu,
  // fastbuild:slot web.console.nav-icons
} from 'lucide-react';

import { cn } from '@/utils';
import { ROUTES } from '@/constants/routes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher, UserAvatar } from '@/components/common';
import { isLocaleSwitcherEnabled, useT, type AllTranslationKeys } from '@/i18n';
import { useLogout } from '@/features/auth/hooks/use-auth';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { isWebFeatureEnabled } from '@/config/features';
import { isDevtoolsEnabled } from '@/config/devtools';

const OrganizationSwitcher = lazy(async () => {
  const organizationFeature =
    await import('@/features/organization/components/organization-switcher');
  return { default: organizationFeature.OrganizationSwitcher };
});

const NotificationCenter = lazy(async () => {
  const notificationFeature =
    await import('@/features/notification/components/notification-center');
  return { default: notificationFeature.NotificationCenter };
});

interface NavItem {
  titleKey: Extract<AllTranslationKeys, `nav.${string}`>;
  href: string;
  icon: LucideIcon;
}

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  const user = useAuthStore.use.user();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();
  const organizationEnabled = isWebFeatureEnabled('organization');
  const notificationEnabled = isWebFeatureEnabled('notification');
  const assetEnabled = isWebFeatureEnabled('asset');
  const usageEnabled = isWebFeatureEnabled('usage');

  const mainNavItems: NavItem[] = [
    {
      titleKey: 'nav.console',
      href: ROUTES.CONSOLE.HOME,
      icon: Home,
    },
    ...(organizationEnabled
      ? [
          {
            titleKey: 'nav.organizations' as const,
            href: ROUTES.CONSOLE.ORGANIZATIONS,
            icon: Building2,
          },
        ]
      : []),
    ...(assetEnabled
      ? [
          {
            titleKey: 'nav.assets' as const,
            href: ROUTES.CONSOLE.ASSETS,
            icon: FolderOpen,
          },
        ]
      : []),
    ...(usageEnabled
      ? [
          {
            titleKey: 'nav.usage' as const,
            href: ROUTES.CONSOLE.USAGE,
            icon: Gauge,
          },
        ]
      : []),
    // fastbuild:slot web.console.nav
  ];

  const secondaryNavItems: NavItem[] = [
    ...(isDevtoolsEnabled()
      ? [
          {
            titleKey: 'nav.styleguide' as const,
            href: ROUTES.DEVTOOLS.STYLEGUIDE,
            icon: Palette,
          },
        ]
      : []),
    {
      titleKey: 'nav.settings',
      href: ROUTES.CONSOLE.SETTINGS,
      icon: Settings,
    },
  ];

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg-canvas text-text-main">
      {/* Fixed Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b bg-bg-surface px-4 md:px-6 shadow-sm z-30">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <ConsoleMobileNav mainItems={mainNavItems} secondaryItems={secondaryNavItems} />
          <Link href={ROUTES.SITE.HOME} className="flex items-center gap-2 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform group-hover:scale-110">
              <BarChart3 aria-hidden="true" className="h-5 w-5" />
            </div>
            <span className="sr-only text-xl font-bold sm:not-sr-only">{t('console.brand')}</span>
          </Link>
          {organizationEnabled ? (
            <Suspense
              fallback={<div className="h-8 w-9 rounded-md border bg-muted" aria-hidden="true" />}
            >
              <OrganizationSwitcher />
            </Suspense>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>
          <ThemeToggle />

          {notificationEnabled ? (
            <Suspense
              fallback={
                <Button variant="ghost" isIcon className="h-9 w-9 rounded-full" disabled>
                  <Bell className="h-4 w-4 text-text-muted" />
                  <span className="sr-only">{t('console.notifications')}</span>
                </Button>
              }
            >
              <NotificationCenter />
            </Suspense>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                isIcon
                noScale
                className="h-9 w-9 rounded-full overflow-hidden border border-border/50 hover:border-primary/50 transition-colors"
              >
                <UserAvatar name={user?.name} email={user?.email} className="h-full w-full" />
                <span className="sr-only">{t('console.profile')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl p-1 shadow-premium">
              <DropdownMenuLabel className="min-w-0">
                <span className="block truncate">{user?.name || t('nav.profile')}</span>
                {user?.email ? (
                  <span className="block truncate text-xs font-normal text-text-muted">
                    {user.email}
                  </span>
                ) : null}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                <Link href={ROUTES.CONSOLE.SETTINGS}>{t('nav.settings')}</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="rounded-lg cursor-pointer text-error focus:bg-destructive/10"
                onSelect={event => {
                  event.preventDefault();
                  logout();
                }}
                disabled={isLoggingOut}
              >
                <div className="flex w-full items-center">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t('auth.logout')}</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Body: Sidebar + Main Content */}
      <div className="flex h-0 grow overflow-hidden">
        {/* Fixed Sidebar */}
        <aside className="hidden w-[220px] shrink-0 border-r bg-background md:flex md:flex-col">
          <div className="flex flex-1 flex-col overflow-y-auto py-2">
            <ConsoleNavList
              items={mainNavItems}
              label={t('console.mainNavigation')}
              className="px-2"
            />
          </div>
          <div className="mt-auto p-4">
            <ConsoleNavList items={secondaryNavItems} label={t('console.secondaryNavigation')} />
            <Link
              href={ROUTES.SITE.HOME}
              className="mt-1 flex h-8 items-center gap-2 px-3 text-sm text-muted-foreground hover:text-foreground pointer-coarse:h-11"
            >
              <span>{t('console.returnToSite')}</span>
            </Link>
          </div>
        </aside>

        {/* Scrollable Main Content */}
        <main className="h-full min-w-0 w-full overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

function ConsoleNavList({
  items,
  label,
  className,
  onNavigate,
}: {
  items: NavItem[];
  label: string;
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav aria-label={label} className={cn('grid items-start gap-1 text-sm font-medium', className)}>
      {items.map(item => {
        const IconComponent = item.icon;
        const isActive = isNavigationItemActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary pointer-coarse:min-h-11',
              isActive ? 'bg-muted text-primary' : 'text-text-subtle hover:bg-muted/50'
            )}
          >
            <IconComponent aria-hidden="true" className="h-4.5 w-4.5" />
            {t(item.titleKey)}
          </Link>
        );
      })}
    </nav>
  );
}

/** Below `md` the sidebar is hidden, so the same navigation opens from the header. */
function ConsoleMobileNav({
  mainItems,
  secondaryItems,
}: {
  mainItems: NavItem[];
  secondaryItems: NavItem[];
}) {
  const [open, setOpen] = useState(false);
  const t = useT();
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" isIcon noScale className="size-9 md:hidden">
          <Menu aria-hidden="true" className="size-5" />
          <span className="sr-only">{t('console.openNavigation')}</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        aria-describedby={undefined}
        // The sheet's close button is its last child and has no touch size of its own.
        className="w-72 max-w-[85vw] gap-0 pointer-coarse:[&>button:last-child]:top-2.5 pointer-coarse:[&>button:last-child]:right-2.5 pointer-coarse:[&>button:last-child]:size-10"
      >
        <SheetHeader className="border-b pr-14">
          <SheetTitle className="truncate">{t('console.brand')}</SheetTitle>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-2">
          <ConsoleNavList
            items={mainItems}
            label={t('console.mainNavigation')}
            onNavigate={close}
          />
          <ConsoleNavList
            items={secondaryItems}
            label={t('console.secondaryNavigation')}
            className="mt-auto border-t pt-2"
            onNavigate={close}
          />
        </div>
        <div className="flex flex-col gap-1 border-t p-2">
          {isLocaleSwitcherEnabled ? (
            <div className="flex items-center justify-between gap-3 py-1 pl-3 text-sm text-text-subtle">
              {t('common.selectLanguage')}
              <LanguageSwitcher />
            </div>
          ) : null}
          <Link
            href={ROUTES.SITE.HOME}
            onClick={close}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-text-subtle transition-all hover:bg-muted/50 hover:text-primary pointer-coarse:min-h-11"
          >
            <ArrowUpRight aria-hidden="true" className="h-4.5 w-4.5" />
            {t('console.returnToSite')}
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function isNavigationItemActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== ROUTES.CONSOLE.HOME && pathname.startsWith(`${href}/`));
}

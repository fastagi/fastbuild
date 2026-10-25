import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { navigationItems } from '@/components/layout/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { env } from '@/config/env';
import { OperatorMenu } from '@/features/operator-session/components/operator-menu';
import { useApiReadiness } from '@/features/system/hooks/use-api-readiness';
import { cn } from '@/lib/cn';

export function AppSidebar() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar
      variant="inset"
      collapsible="icon"
      className="console-sidebar-material"
      mobileTitle={t('navigation.console')}
      mobileDescription={t('navigation.mobileDescription')}
    >
      <SidebarHeader className="border-b border-sidebar-border/70 pb-3 pt-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              tooltip={env.APP_NAME}
              className="h-12 data-[active=true]:bg-transparent"
            >
              <Link to="/console" onClick={() => setOpenMobile(false)}>
                <span className="brand-mark" aria-hidden="true">
                  {env.APP_NAME.charAt(0).toUpperCase()}
                </span>
                <span className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{env.APP_NAME}</span>
                  <span className="truncate text-xs text-muted-foreground">{t('app.shell')}</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('navigation.section')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const label = t(item.labelKey);
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        pathname === item.to ||
                        (item.to !== '/console' && pathname.startsWith(`${item.to}/`))
                      }
                      tooltip={label}
                      className="h-9"
                    >
                      <Link to={item.to} onClick={() => setOpenMobile(false)}>
                        <Icon aria-hidden="true" />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <ApiStatusIndicator />
        <OperatorMenu />
      </SidebarFooter>

      <SidebarRail aria-label={t('navigation.toggle')} title={t('navigation.toggle')} />
    </Sidebar>
  );
}

/** Quiet footer signal for the shared readiness query; the overview page owns the details. */
function ApiStatusIndicator() {
  const { t } = useTranslation();
  const readiness = useApiReadiness();
  const available = readiness.data?.status === 'up' || readiness.data?.status === 'degraded';
  const label = readiness.isPending
    ? t('overview.apiChecking')
    : available
      ? t('overview.apiAvailable')
      : t('overview.apiUnavailable');

  return (
    <div
      className="flex min-w-0 items-center gap-2 px-2 py-1.5 text-xs"
      title={`${t('overview.api')}: ${label}`}
    >
      <span className="grid size-4 shrink-0 place-items-center" aria-hidden="true">
        <span
          className={cn(
            'size-2 rounded-full',
            readiness.isPending ? 'bg-muted-foreground' : available ? 'bg-success' : 'bg-danger',
          )}
        />
      </span>
      <span className="truncate text-muted-foreground group-data-[collapsible=icon]:hidden">
        {t('overview.api')} · {label}
      </span>
    </div>
  );
}

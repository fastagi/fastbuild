import { Link, useNavigate } from '@tanstack/react-router';
import { ChevronsUpDown, LogOut, Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { isFeatureEnabled } from '@/config/env';
import {
  useOperatorSession,
  useSignOut,
} from '@/features/operator-session/hooks/use-operator-session';

/** Sidebar-footer account menu for the signed-in operator; absent without the operator feature. */
export function OperatorMenu() {
  return isFeatureEnabled('operator') ? <SignedInOperator /> : null;
}

function SignedInOperator() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isMobile, setOpenMobile } = useSidebar();
  const session = useOperatorSession();
  const signOut = useSignOut();
  const operator = session.data?.operator;
  if (!operator) {
    return null;
  }
  const name = operator.nickname || operator.username;
  const initials = name.slice(0, 2).toUpperCase();
  const identity = (
    <>
      <Avatar className="size-8 rounded-lg">
        <AvatarFallback className="rounded-lg bg-brand-subtle text-xs font-semibold text-brand-strong">
          {initials}
        </AvatarFallback>
      </Avatar>
      <span className="grid min-w-0 flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{name}</span>
        <span className="truncate text-xs text-muted-foreground">{operator.email}</span>
      </span>
    </>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              aria-label={t('auth.accountMenu')}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              {identity}
              <ChevronsUpDown className="ml-auto size-4" aria-hidden="true" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5">{identity}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/console/preferences" onClick={() => setOpenMobile(false)}>
                <Settings2 aria-hidden="true" />
                {t('navigation.preferences')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={signOut.isPending}
              onSelect={() =>
                signOut.mutate(undefined, {
                  onSettled: () => void navigate({ to: '/login', replace: true }),
                })
              }
            >
              <LogOut aria-hidden="true" />
              {t('auth.signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

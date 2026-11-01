import { Ban, CircleCheck, LogOut, MoreHorizontal, Search, Users } from 'lucide-react';
import { type FormEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { SectionCard } from '@/components/layout/section-card';
import { AccountIdentity } from '@/components/ui/account-identity';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { PagePagination } from '@/components/ui/pagination';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useUserAction, useUsers } from '@/features/users/hooks/use-users';
import {
  type ManagedUser,
  type UserAction,
  type UserSearch,
  type UserStatusFilter,
  userStatusFilters,
} from '@/features/users/types';
import { userActionErrorKey } from '@/features/users/user-action-errors';

interface UsersPageProps {
  search: UserSearch;
  onSearchChange: (search: UserSearch) => void;
}

interface PendingAction {
  action: UserAction;
  user: ManagedUser;
}

interface UserRowActionsProps {
  user: ManagedUser;
  onChoose: (action: UserAction, trigger: HTMLElement | null) => void;
}

function UserRowActions({ user, onChoose }: UserRowActionsProps) {
  const { t } = useTranslation();
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          ref={trigger}
          type="button"
          size="icon"
          variant="ghost"
          className="size-8"
          aria-label={t('users.rowActions', { name: user.nickname || user.username })}
          title={t('users.columns.actions')}
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {user.status === 'active' ? (
          <DropdownMenuItem onSelect={() => onChoose('disable', trigger.current)}>
            <Ban aria-hidden="true" />
            {t('users.actions.disable')}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => onChoose('enable', trigger.current)}>
            <CircleCheck aria-hidden="true" />
            {t('users.actions.enable')}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => onChoose('revokeSessions', trigger.current)}>
          <LogOut aria-hidden="true" />
          {t('users.actions.revokeSessions')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UsersPage({ search, onSearchChange }: UsersPageProps) {
  const { t, i18n } = useTranslation();
  const users = useUsers(search);
  const userAction = useUserAction();
  const [query, setQuery] = useState(search.q ?? '');
  const [pending, setPending] = useState<PendingAction | null>(null);
  // The menu item that opened the dialog is gone by the time it closes, so focus returns to the
  // row's menu button rather than falling to the page.
  const returnFocus = useRef<HTMLElement | null>(null);
  const status = search.status ?? 'all';
  const page = users.data?.meta;
  const filtered = Boolean(search.q) || status !== 'all';
  const dateFormat = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearchChange({ ...search, q: query.trim() || undefined, page: undefined });
  };

  const confirm = () => {
    if (!pending) {
      return;
    }
    userAction.mutate(
      { action: pending.action, id: pending.user.id },
      {
        onSuccess: () => {
          toast.success(
            t(`users.done.${pending.action}`, {
              name: pending.user.nickname || pending.user.username,
            }),
          );
          setPending(null);
        },
      },
    );
  };

  const columns: DataTableColumn<ManagedUser>[] = [
    {
      id: 'account',
      header: t('users.columns.account'),
      role: 'primary',
      cell: (user) => (
        <AccountIdentity
          name={user.nickname || user.username}
          email={user.email}
          identifier={user.username}
        />
      ),
    },
    {
      id: 'status',
      header: t('users.columns.status'),
      role: 'status',
      cell: (user) => (
        <div className="flex flex-wrap justify-end gap-1 sm:justify-start">
          <StatusBadge tone={user.status === 'active' ? 'success' : 'warning'}>
            {t(`users.status.${user.status}`)}
          </StatusBadge>
          {user.is_operator ? (
            <StatusBadge variant="metadata">{t('users.operator')}</StatusBadge>
          ) : null}
        </div>
      ),
    },
    {
      id: 'lastLogin',
      header: t('users.columns.lastLogin'),
      className: 'whitespace-nowrap text-muted-foreground',
      cell: (user) =>
        user.last_login ? dateFormat.format(new Date(user.last_login)) : t('users.never'),
    },
    {
      id: 'actions',
      header: t('users.columns.actions'),
      role: 'actions',
      align: 'end',
      cell: (user) =>
        user.is_operator ? (
          <p className="text-right text-xs text-muted-foreground">{t('users.protectedHint')}</p>
        ) : (
          <UserRowActions
            user={user}
            onChoose={(action, trigger) => {
              returnFocus.current = trigger;
              setPending({ action, user });
            }}
          />
        ),
    },
  ];

  return (
    <div className="page-stack">
      <header className="page-header">
        <p className="page-eyebrow">{t('users.eyebrow')}</p>
        <h1>{t('users.title')}</h1>
        <p>{t('users.description')}</p>
      </header>

      <SectionCard
        icon={Users}
        titleId="users-title"
        title={t('users.listTitle')}
        description={
          users.isSuccess
            ? t('users.total', { count: users.data.meta.total })
            : users.isPending
              ? t('users.loading')
              : undefined
        }
        contentClassName="p-0"
        actions={
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <form role="search" onSubmit={submitSearch} className="flex gap-2">
                <Input
                  aria-label={t('users.search')}
                  placeholder={t('users.searchPlaceholder')}
                  maxLength={100}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-full sm:w-56"
                />
                <Button type="submit" size="icon" variant="outline" aria-label={t('users.search')}>
                  <Search aria-hidden="true" />
                </Button>
              </form>
              <ToggleGroup
                type="single"
                className="segmented-control sm:w-auto"
                aria-label={t('users.statusFilter')}
                value={status}
                onValueChange={(value) => {
                  if (value) {
                    onSearchChange({
                      ...search,
                      status: value as UserStatusFilter,
                      page: undefined,
                    });
                  }
                }}
              >
                {userStatusFilters.map((value) => (
                  <ToggleGroupItem key={value} value={value} className="flex-auto">
                    {t(`users.status.${value}`)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </>
        }
      >
        <DataTable
          columns={columns}
          rows={users.data?.data}
          rowKey={(user) => user.id}
          status={users.status}
          errorMessage={t('users.errors.unavailable')}
          error={users.error}
          onRetry={() => void users.refetch()}
          retrying={users.isFetching}
          emptyMessage={t(filtered ? 'users.emptyFiltered' : 'users.empty')}
          emptyAction={
            filtered ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setQuery('');
                  onSearchChange({});
                }}
              >
                {t('dataTable.clearFilters')}
              </Button>
            ) : null
          }
          minWidthClassName="min-w-[560px]"
        />

        <PagePagination
          meta={page}
          label={t('users.pagination')}
          onPageChange={(next) => onSearchChange({ ...search, page: next })}
        />
      </SectionCard>

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPending(null);
            userAction.reset();
          }
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            if (returnFocus.current?.isConnected) {
              event.preventDefault();
              returnFocus.current.focus();
            }
          }}
        >
          {pending ? (
            <>
              <DialogTitle>{t(`users.confirm.${pending.action}.title`)}</DialogTitle>
              <DialogDescription>
                {t(`users.confirm.${pending.action}.description`, {
                  name: pending.user.nickname || pending.user.username,
                })}
              </DialogDescription>
              {userAction.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  {t(userActionErrorKey(userAction.error))}
                </p>
              ) : null}
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    {t('users.cancel')}
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  variant={pending.action === 'enable' ? 'default' : 'destructive'}
                  disabled={userAction.isPending}
                  onClick={confirm}
                >
                  {t(`users.actions.${pending.action}`)}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

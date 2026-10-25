import { Ban, CircleCheck, LogOut, Search, Users } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PagePagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { useUserAction, useUsers } from '@/features/users/hooks/use-users';
import {
  type ManagedUser,
  type UserAction,
  type UserSearch,
  type UserStatusFilter,
  userStatusFilters,
} from '@/features/users/types';
import { userActionErrorKey } from '@/features/users/user-action-errors';
import { cn } from '@/lib/cn';

interface UsersPageProps {
  search: UserSearch;
  onSearchChange: (search: UserSearch) => void;
}

interface PendingAction {
  action: UserAction;
  user: ManagedUser;
}

export function UsersPage({ search, onSearchChange }: UsersPageProps) {
  const { t, i18n } = useTranslation();
  const users = useUsers(search);
  const userAction = useUserAction();
  const [query, setQuery] = useState(search.q ?? '');
  const [pending, setPending] = useState<PendingAction | null>(null);
  const status = search.status ?? 'all';
  const page = users.data?.meta;
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
      { onSuccess: () => setPending(null) },
    );
  };

  const columns: DataTableColumn<ManagedUser>[] = [
    {
      id: 'account',
      header: t('users.columns.account'),
      cell: (user) => (
        <>
          <div className="font-medium">{user.nickname || user.username}</div>
          <div className="text-xs text-muted-foreground">
            {user.username} · {user.email}
          </div>
        </>
      ),
    },
    {
      id: 'status',
      header: t('users.columns.status'),
      cell: (user) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge>{t(`users.status.${user.status}`)}</StatusBadge>
          {user.is_operator ? <StatusBadge>{t('users.operator')}</StatusBadge> : null}
        </div>
      ),
    },
    {
      id: 'lastLogin',
      header: t('users.columns.lastLogin'),
      className: 'text-muted-foreground',
      cell: (user) =>
        user.last_login ? dateFormat.format(new Date(user.last_login)) : t('users.never'),
    },
    {
      id: 'actions',
      header: t('users.columns.actions'),
      align: 'end',
      cell: (user) =>
        user.is_operator ? (
          <p className="text-xs text-muted-foreground">{t('users.protectedHint')}</p>
        ) : (
          <div className="flex justify-end gap-1">
            {user.status === 'active' ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setPending({ action: 'disable', user })}
              >
                <Ban aria-hidden="true" />
                {t('users.actions.disable')}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setPending({ action: 'enable', user })}
              >
                <CircleCheck aria-hidden="true" />
                {t('users.actions.enable')}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setPending({ action: 'revokeSessions', user })}
            >
              <LogOut aria-hidden="true" />
              {t('users.actions.revokeSessions')}
            </Button>
          </div>
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

      <section className="panel" aria-labelledby="users-title">
        <div className="panel-header flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <span className="icon-surface" aria-hidden="true">
              <Users className="size-4" />
            </span>
            <div>
              <h2 id="users-title" className="panel-title">
                {t('users.listTitle')}
              </h2>
              <p className="panel-description">
                {page ? t('users.total', { count: page.total }) : t('users.loading')}
              </p>
            </div>
          </div>
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
            <div className="segmented-control" role="group" aria-label={t('users.statusFilter')}>
              {userStatusFilters.map((value: UserStatusFilter) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-pressed={status === value}
                  className={cn('flex-1', status === value && 'bg-background shadow-sm')}
                  onClick={() => onSearchChange({ ...search, status: value, page: undefined })}
                >
                  {t(`users.status.${value}`)}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={users.data?.data}
          rowKey={(user) => user.id}
          status={users.status}
          errorMessage={t('users.errors.unavailable')}
          emptyMessage={t('users.empty')}
        />

        <PagePagination
          meta={page}
          label={t('users.pagination')}
          onPageChange={(next) => onSearchChange({ ...search, page: next })}
        />
      </section>

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPending(null);
            userAction.reset();
          }
        }}
      >
        <DialogContent>
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

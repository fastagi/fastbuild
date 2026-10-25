import { Ban, CircleCheck, LogOut, Search, Users } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Pager } from '@/components/layout/pager';
import { SectionCard } from '@/components/layout/section-card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
        description={page ? t('users.total', { count: page.total }) : t('users.loading')}
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
                  <ToggleGroupItem key={value} value={value}>
                    {t(`users.status.${value}`)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </>
        }
      >
        {users.isPending ? (
          <div className="flex flex-col gap-2 p-4" aria-busy="true">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        ) : users.isError ? (
          <p role="alert" className="p-4 text-sm text-destructive">
            {t('users.errors.unavailable')}
          </p>
        ) : users.data.data.length === 0 ? (
          <EmptyState>{t('users.empty')}</EmptyState>
        ) : (
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t('users.columns.account')}</TableHead>
                <TableHead scope="col">{t('users.columns.status')}</TableHead>
                <TableHead scope="col">{t('users.columns.lastLogin')}</TableHead>
                <TableHead scope="col" className="text-right">
                  {t('users.columns.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data.data.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="font-medium">{user.nickname || user.username}</div>
                    <div className="text-xs text-muted-foreground">
                      {user.username} · {user.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <StatusBadge tone={user.status === 'active' ? 'success' : 'warning'}>
                        {t(`users.status.${user.status}`)}
                      </StatusBadge>
                      {user.is_operator ? (
                        <StatusBadge tone="brand">{t('users.operator')}</StatusBadge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.last_login
                      ? dateFormat.format(new Date(user.last_login))
                      : t('users.never')}
                  </TableCell>
                  <TableCell>
                    {user.is_operator ? (
                      <p className="text-right text-xs text-muted-foreground">
                        {t('users.protectedHint')}
                      </p>
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
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Pager
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

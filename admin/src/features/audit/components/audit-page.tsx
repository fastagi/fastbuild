import { History, Search } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionCard } from '@/components/layout/section-card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { ApiErrorCode } from '@/http/codes';
import { ApiError } from '@/http/client';
import { useAuditLogs } from '@/features/audit/hooks/use-audit-logs';
import type { AuditSearch } from '@/features/audit/types';

function httpStatusTone(status: number) {
  if (status >= 500) return 'danger';
  if (status >= 400) return 'warning';
  if (status >= 200 && status < 300) return 'success';
  return 'neutral';
}

interface AuditPageProps {
  search: AuditSearch;
  onSearchChange: (search: AuditSearch) => void;
}

export function AuditPage({ search, onSearchChange }: AuditPageProps) {
  const { t, i18n } = useTranslation();
  const logs = useAuditLogs(search);
  const [action, setAction] = useState(search.action ?? '');
  const [userId, setUserId] = useState(search.user_id ? String(search.user_id) : '');
  const [from, setFrom] = useState(search.from ?? '');
  const [to, setTo] = useState(search.to ?? '');
  // Cursors of the pages before the current one, so Previous retraces the visited pages. A page
  // opened from a link has no trail, and Previous returns to the newest entries.
  const [trail, setTrail] = useState<string[]>([]);
  const meta = logs.data?.meta;
  const goTo = (cursor: string | undefined, nextTrail: string[]) => {
    setTrail(nextTrail);
    onSearchChange({ ...search, cursor });
  };
  const dateFormat = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });
  const invalidRange =
    logs.error instanceof ApiError && logs.error.errorCode === ApiErrorCode.COMMON_INVALID_INPUT;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedUser = Number.parseInt(userId, 10);
    onSearchChange({
      action: action.trim() || undefined,
      user_id: Number.isInteger(parsedUser) && parsedUser > 0 ? parsedUser : undefined,
      from: from || undefined,
      to: to || undefined,
      cursor: undefined,
    });
    setTrail([]);
  };

  return (
    <div className="page-stack">
      <header className="page-header">
        <p className="page-eyebrow">{t('audit.eyebrow')}</p>
        <h1>{t('audit.title')}</h1>
        <p>{t('audit.description')}</p>
      </header>

      <SectionCard
        icon={History}
        titleId="audit-title"
        title={t('audit.listTitle')}
        description={t('audit.rangeHint')}
        contentClassName="p-0"
        toolbar={
          <>
            <form
              role="search"
              onSubmit={submit}
              className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5"
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="audit-action">{t('audit.filters.action')}</Label>
                <Input
                  id="audit-action"
                  maxLength={120}
                  value={action}
                  onChange={(event) => setAction(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="audit-user-id">{t('audit.filters.userId')}</Label>
                <Input
                  id="audit-user-id"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={userId}
                  onChange={(event) => setUserId(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="audit-from">{t('audit.filters.from')}</Label>
                <Input
                  id="audit-from"
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="audit-to">{t('audit.filters.to')}</Label>
                <Input
                  id="audit-to"
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full">
                  <Search aria-hidden="true" />
                  {t('audit.apply')}
                </Button>
              </div>
            </form>
          </>
        }
      >
        {logs.isPending ? (
          <div className="flex flex-col gap-2 p-4" aria-busy="true">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-8 w-full" />
            ))}
          </div>
        ) : logs.isError ? (
          <p role="alert" className="p-4 text-sm text-destructive">
            {invalidRange ? t('audit.errors.invalidRange') : t('audit.errors.unavailable')}
          </p>
        ) : logs.data.data.length === 0 ? (
          <EmptyState>{t('audit.empty')}</EmptyState>
        ) : (
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t('audit.columns.time')}</TableHead>
                <TableHead scope="col">{t('audit.columns.actor')}</TableHead>
                <TableHead scope="col">{t('audit.columns.action')}</TableHead>
                <TableHead scope="col">{t('audit.columns.request')}</TableHead>
                <TableHead scope="col">{t('audit.columns.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.data.data.map((entry) => (
                <TableRow key={entry.id} className="align-top">
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {dateFormat.format(new Date(entry.created_at))}
                  </TableCell>
                  <TableCell>
                    {entry.user_id
                      ? t('audit.actorUser', { id: entry.user_id })
                      : t(`audit.actorType.${entry.actor_type}`, entry.actor_type)}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{entry.action}</div>
                    <div className="text-xs text-muted-foreground">{entry.resource}</div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs">
                      {entry.method} {entry.path}
                    </code>
                    {entry.request_id ? (
                      <div className="text-xs text-muted-foreground">{entry.request_id}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={httpStatusTone(entry.status_code)}>
                      {entry.status_code}
                    </StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {meta && (search.cursor || meta.has_more) ? (
          <nav
            className="flex items-center justify-end gap-2 border-t px-4 py-3 text-sm"
            aria-label={t('users.pagination')}
          >
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!search.cursor}
              onClick={() => goTo(trail.at(-1) || undefined, trail.slice(0, -1))}
            >
              {t('users.previous')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!meta.next_cursor}
              onClick={() => goTo(meta.next_cursor ?? undefined, [...trail, search.cursor ?? ''])}
            >
              {t('users.next')}
            </Button>
          </nav>
        ) : null}
      </SectionCard>
    </div>
  );
}

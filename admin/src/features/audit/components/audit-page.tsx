import { History, Search } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionCard } from '@/components/layout/section-card';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
import { ApiErrorCode } from '@/http/codes';
import { ApiError } from '@/http/client';
import { useAuditLogs } from '@/features/audit/hooks/use-audit-logs';
import type { AuditEntry, AuditSearch } from '@/features/audit/types';

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

  const columns: DataTableColumn<AuditEntry>[] = [
    {
      id: 'time',
      header: t('audit.columns.time'),
      className: 'whitespace-nowrap text-muted-foreground',
      cell: (entry) => dateFormat.format(new Date(entry.created_at)),
    },
    {
      id: 'actor',
      header: t('audit.columns.actor'),
      cell: (entry) =>
        entry.user_id
          ? t('audit.actorUser', { id: entry.user_id })
          : t(`audit.actorType.${entry.actor_type}`, entry.actor_type),
    },
    {
      id: 'action',
      header: t('audit.columns.action'),
      cell: (entry) => (
        <>
          <div className="font-medium">{entry.action}</div>
          <div className="text-xs text-muted-foreground">{entry.resource}</div>
        </>
      ),
    },
    {
      id: 'request',
      header: t('audit.columns.request'),
      cell: (entry) => (
        <>
          <code className="text-xs">
            {entry.method} {entry.path}
          </code>
          {entry.request_id ? (
            <div className="text-xs text-muted-foreground">{entry.request_id}</div>
          ) : null}
        </>
      ),
    },
    {
      id: 'status',
      header: t('audit.columns.status'),
      cell: (entry) => (
        <StatusBadge tone={httpStatusTone(entry.status_code)}>{entry.status_code}</StatusBadge>
      ),
    },
  ];

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
        <DataTable
          columns={columns}
          rows={logs.data?.data}
          rowKey={(entry) => entry.id}
          status={logs.status}
          errorMessage={
            invalidRange ? t('audit.errors.invalidRange') : t('audit.errors.unavailable')
          }
          emptyMessage={t('audit.empty')}
          minWidthClassName="min-w-[720px]"
          alignTop
          skeletonRows={5}
        />

        {meta && (search.cursor || meta.has_more) ? (
          <Pagination
            label={t('audit.pagination')}
            hasPrevious={Boolean(search.cursor)}
            hasNext={Boolean(meta.next_cursor)}
            onPrevious={() => goTo(trail.at(-1) || undefined, trail.slice(0, -1))}
            onNext={() => goTo(meta.next_cursor ?? undefined, [...trail, search.cursor ?? ''])}
          />
        ) : null}
      </SectionCard>
    </div>
  );
}

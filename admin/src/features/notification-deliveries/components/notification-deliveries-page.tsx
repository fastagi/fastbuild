import { BellRing, Search } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pager } from '@/components/layout/pager';
import { SectionCard } from '@/components/layout/section-card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Switch } from '@/components/ui/switch';
import {
  deliveryRefreshIntervalMs,
  useNotificationDeliveries,
  useNotificationDeliveryCounts,
} from '@/features/notification-deliveries/hooks/use-notification-deliveries';
import {
  type NotificationChannel,
  type NotificationDeliverySearch,
  type NotificationDeliveryStatus,
  notificationChannels,
  notificationDeliveryStatuses,
} from '@/features/notification-deliveries/types';
import { cn } from '@/lib/cn';

interface NotificationDeliveriesPageProps {
  search: NotificationDeliverySearch;
  onSearchChange: (search: NotificationDeliverySearch) => void;
}

// Radix Select reserves the empty value, so "any" filters use a sentinel item.
const ANY = 'any';

const statusTone = {
  pending: 'neutral',
  processing: 'neutral',
  delivered: 'success',
  failed: 'danger',
} as const;

const statusDot = {
  pending: 'bg-muted-foreground/60',
  processing: 'bg-brand',
  delivered: 'bg-success',
  failed: 'bg-danger',
} as const;

export function NotificationDeliveriesPage({
  search,
  onSearchChange,
}: NotificationDeliveriesPageProps) {
  const { t, i18n } = useTranslation();
  const [autoRefresh, setAutoRefresh] = useState(false);
  const deliveries = useNotificationDeliveries(search, autoRefresh);
  const counts = useNotificationDeliveryCounts(search, autoRefresh);
  const [status, setStatus] = useState<string>(search.status ?? '');
  const [channel, setChannel] = useState<string>(search.channel ?? '');
  const [userId, setUserId] = useState(search.user_id ? String(search.user_id) : '');
  const meta = deliveries.data?.meta;
  const dateFormat = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });

  const selectStatus = (next: NotificationDeliveryStatus | undefined) => {
    setStatus(next ?? '');
    onSearchChange({ ...search, status: next, page: undefined });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedUser = Number.parseInt(userId, 10);
    onSearchChange({
      status: (status || undefined) as NotificationDeliveryStatus | undefined,
      channel: (channel || undefined) as NotificationChannel | undefined,
      user_id: Number.isInteger(parsedUser) && parsedUser > 0 ? parsedUser : undefined,
      page: undefined,
    });
  };

  return (
    <div className="page-stack">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <header className="page-header">
          <p className="page-eyebrow">{t('notificationDeliveries.eyebrow')}</p>
          <h1>{t('notificationDeliveries.title')}</h1>
          <p>{t('notificationDeliveries.description')}</p>
        </header>
        <div className="flex items-center gap-2 text-sm">
          <Switch
            id="notification-auto-refresh"
            checked={autoRefresh}
            onCheckedChange={setAutoRefresh}
          />
          <Label htmlFor="notification-auto-refresh">
            {t('notificationDeliveries.autoRefresh')}
          </Label>
          <span className="text-xs text-muted-foreground">
            {autoRefresh
              ? t('notificationDeliveries.autoRefreshOn', {
                  seconds: deliveryRefreshIntervalMs / 1000,
                })
              : t('notificationDeliveries.autoRefreshOff')}
          </span>
        </div>
      </div>

      <div
        role="group"
        aria-label={t('notificationDeliveries.statusSummary')}
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        {notificationDeliveryStatuses.map((value) => {
          const selected = search.status === value;
          const count = counts[value];
          return (
            <button
              key={value}
              type="button"
              aria-pressed={selected}
              onClick={() => selectStatus(selected ? undefined : value)}
              className={cn(
                'flex flex-col items-start gap-1.5 rounded-lg border bg-card px-4 py-3 text-left shadow-xs transition-colors hover:border-brand/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                selected && 'border-brand ring-[3px] ring-brand/15',
              )}
            >
              <span className="flex items-center gap-2 text-xs font-medium text-subtle">
                <span aria-hidden="true" className={cn('size-2 rounded-full', statusDot[value])} />
                {t(`notificationDeliveries.status.${value}`)}
              </span>
              <span className="text-xl font-semibold tabular-nums">
                {count === undefined ? '—' : count}
              </span>
            </button>
          );
        })}
      </div>

      <SectionCard
        icon={BellRing}
        titleId="notification-deliveries-title"
        title={t('notificationDeliveries.listTitle')}
        description={
          meta
            ? t('notificationDeliveries.total', { count: meta.total })
            : t('notificationDeliveries.privacyHint')
        }
        contentClassName="p-0"
        toolbar={
          <>
            <form
              role="search"
              onSubmit={submit}
              className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="notification-status">
                  {t('notificationDeliveries.filters.status')}
                </Label>
                <Select
                  name="status"
                  value={status || ANY}
                  onValueChange={(value) => setStatus(value === ANY ? '' : value)}
                >
                  <SelectTrigger id="notification-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>{t('notificationDeliveries.any')}</SelectItem>
                    {notificationDeliveryStatuses.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`notificationDeliveries.status.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="notification-channel">
                  {t('notificationDeliveries.filters.channel')}
                </Label>
                <Select
                  name="channel"
                  value={channel || ANY}
                  onValueChange={(value) => setChannel(value === ANY ? '' : value)}
                >
                  <SelectTrigger id="notification-channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>{t('notificationDeliveries.any')}</SelectItem>
                    {notificationChannels.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`notificationDeliveries.channel.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="notification-user-id">
                  {t('notificationDeliveries.filters.userId')}
                </Label>
                <Input
                  id="notification-user-id"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={userId}
                  onChange={(event) => setUserId(event.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full">
                  <Search aria-hidden="true" />
                  {t('notificationDeliveries.apply')}
                </Button>
              </div>
            </form>
          </>
        }
      >
        {deliveries.isPending ? (
          <div className="flex flex-col gap-2 p-4" aria-busy="true">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-8 w-full" />
            ))}
          </div>
        ) : deliveries.isError ? (
          <p role="alert" className="p-4 text-sm text-destructive">
            {t('notificationDeliveries.errors.unavailable')}
          </p>
        ) : deliveries.data.data.length === 0 ? (
          <EmptyState>{t('notificationDeliveries.empty')}</EmptyState>
        ) : (
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">
                  {t('notificationDeliveries.columns.notification')}
                </TableHead>
                <TableHead scope="col">{t('notificationDeliveries.columns.recipient')}</TableHead>
                <TableHead scope="col">{t('notificationDeliveries.columns.channel')}</TableHead>
                <TableHead scope="col">{t('notificationDeliveries.columns.status')}</TableHead>
                <TableHead scope="col">{t('notificationDeliveries.columns.updated')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.data.data.map((delivery) => (
                <TableRow key={delivery.id} className="align-top">
                  <TableCell>
                    <div className="font-medium">{delivery.kind}</div>
                    <div className="text-xs text-muted-foreground">
                      {t('notificationDeliveries.notificationRef', {
                        id: delivery.notification_id,
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    {t('notificationDeliveries.userRef', { id: delivery.user_id })}
                  </TableCell>
                  <TableCell>{t(`notificationDeliveries.channel.${delivery.channel}`)}</TableCell>
                  <TableCell>
                    <StatusBadge tone={statusTone[delivery.status]}>
                      {t(`notificationDeliveries.status.${delivery.status}`)}
                    </StatusBadge>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {t('notificationDeliveries.attempts', { count: delivery.attempts })}
                      {delivery.last_failure_code ? (
                        <>
                          {' · '}
                          <code>{delivery.last_failure_code}</code>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {dateFormat.format(new Date(delivery.updated_at))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Pager
          meta={meta}
          label={t('notificationDeliveries.pagination')}
          onPageChange={(page) => onSearchChange({ ...search, page })}
        />
      </SectionCard>
    </div>
  );
}

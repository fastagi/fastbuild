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
import { useNotificationDeliveries } from '@/features/notification-deliveries/hooks/use-notification-deliveries';
import {
  type NotificationChannel,
  type NotificationDeliverySearch,
  type NotificationDeliveryStatus,
  notificationChannels,
  notificationDeliveryStatuses,
} from '@/features/notification-deliveries/types';

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

export function NotificationDeliveriesPage({
  search,
  onSearchChange,
}: NotificationDeliveriesPageProps) {
  const { t, i18n } = useTranslation();
  const deliveries = useNotificationDeliveries(search);
  const [status, setStatus] = useState<string>(search.status ?? '');
  const [channel, setChannel] = useState<string>(search.channel ?? '');
  const [userId, setUserId] = useState(search.user_id ? String(search.user_id) : '');
  const meta = deliveries.data?.meta;
  const dateFormat = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });

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
      <header className="page-header">
        <p className="page-eyebrow">{t('notificationDeliveries.eyebrow')}</p>
        <h1>{t('notificationDeliveries.title')}</h1>
        <p>{t('notificationDeliveries.description')}</p>
      </header>

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

import { ListTree, RotateCw, Send, Webhook } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionCard } from '@/components/layout/section-card';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  useReplayWebhookDelivery,
  useWebhookAttempts,
  useWebhookDeliveries,
  useWebhookEndpoints,
} from '@/features/webhooks/hooks/use-webhooks';
import {
  isReplayable,
  type WebhookDelivery,
  type WebhookDeliveryStatus,
  webhookDeliveryStatuses,
  type WebhookEndpoint,
} from '@/features/webhooks/types';
import { replayErrorKey } from '@/features/webhooks/webhook-errors';

// Radix Select reserves the empty value, so the unfiltered view uses a sentinel item.
const ALL = 'all';

const deliveryTone = {
  pending: 'neutral',
  processing: 'neutral',
  delivered: 'success',
  failed: 'danger',
  canceled: 'warning',
} as const;

/** Secret-free webhook diagnosis and delivery replay for one organization. */
export function WebhookDiagnostics({ organizationId }: { organizationId: number }) {
  return (
    <>
      <WebhookEndpoints organizationId={organizationId} />
      <WebhookDeliveries organizationId={organizationId} />
    </>
  );
}

function WebhookEndpoints({ organizationId }: { organizationId: number }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const endpoints = useWebhookEndpoints(organizationId, page);
  const meta = endpoints.data?.meta;

  const columns: DataTableColumn<WebhookEndpoint>[] = [
    {
      id: 'endpoint',
      header: t('webhooks.endpointColumns.endpoint'),
      cell: (endpoint) => (
        <>
          <div className="font-medium">
            {endpoint.name} <span className="text-muted-foreground">#{endpoint.id}</span>
          </div>
          <div className="break-all text-xs text-muted-foreground">{endpoint.url}</div>
        </>
      ),
    },
    {
      id: 'status',
      header: t('webhooks.endpointColumns.status'),
      cell: (endpoint) => (
        <>
          <StatusBadge tone={endpoint.status === 'active' ? 'success' : 'warning'}>
            {t(`webhooks.endpointStatus.${endpoint.status}`)}
          </StatusBadge>
          {endpoint.disabled_reason ? (
            <div className="mt-1 text-xs text-muted-foreground">
              <code>{endpoint.disabled_reason}</code>
            </div>
          ) : null}
          {endpoint.consecutive_failures > 0 ? (
            <div className="mt-1 text-xs text-muted-foreground">
              {t('webhooks.consecutiveFailures', {
                count: endpoint.consecutive_failures,
              })}
            </div>
          ) : null}
        </>
      ),
    },
    {
      id: 'events',
      header: t('webhooks.endpointColumns.events'),
      className: 'text-xs',
      cell: (endpoint) =>
        endpoint.event_types.map((eventType) => (
          <code key={eventType} className="mr-2 inline-block">
            {eventType}
          </code>
        )),
    },
  ];

  return (
    <SectionCard
      icon={Webhook}
      titleId="webhook-endpoints-title"
      title={t('webhooks.endpointsTitle')}
      description={t('webhooks.endpointsDescription')}
      contentClassName="p-0"
    >
      <DataTable
        columns={columns}
        rows={endpoints.data?.data}
        rowKey={(endpoint) => endpoint.id}
        status={endpoints.status}
        errorMessage={t('webhooks.errors.unavailable')}
        emptyMessage={t('webhooks.endpointsEmpty')}
        alignTop
        skeletonRows={3}
      />
      <PagePagination meta={meta} label={t('webhooks.endpointPagination')} onPageChange={setPage} />
    </SectionCard>
  );
}

type DeliveryDialog = { kind: 'attempts' | 'replay'; delivery: WebhookDelivery };

function WebhookDeliveries({ organizationId }: { organizationId: number }) {
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState<WebhookDeliveryStatus | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<DeliveryDialog | null>(null);
  const deliveries = useWebhookDeliveries(organizationId, { status, page });
  const attempts = useWebhookAttempts(
    organizationId,
    dialog?.kind === 'attempts' ? dialog.delivery.id : null,
  );
  const replay = useReplayWebhookDelivery(organizationId);
  const meta = deliveries.data?.meta;
  const dateFormat = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });

  const closeDialog = () => {
    setDialog(null);
    replay.reset();
  };

  const columns: DataTableColumn<WebhookDelivery>[] = [
    {
      id: 'event',
      header: t('webhooks.deliveryColumns.event'),
      cell: (delivery) => (
        <>
          <div className="font-medium">{delivery.event_type}</div>
          <div className="text-xs text-muted-foreground">
            {delivery.message_id} · {t('webhooks.endpointRef', { id: delivery.endpoint_id })}
          </div>
        </>
      ),
    },
    {
      id: 'status',
      header: t('webhooks.deliveryColumns.status'),
      cell: (delivery) => (
        <>
          <StatusBadge tone={deliveryTone[delivery.status]}>
            {t(`webhooks.deliveryStatus.${delivery.status}`)}
          </StatusBadge>
          {delivery.failure_code || delivery.http_status ? (
            <div className="mt-1 text-xs text-muted-foreground">
              <code>
                {[delivery.http_status, delivery.failure_code].filter(Boolean).join(' · ')}
              </code>
            </div>
          ) : null}
        </>
      ),
    },
    {
      id: 'attempts',
      header: t('webhooks.deliveryColumns.attempts'),
      className: 'tabular-nums',
      cell: (delivery) => (
        <>
          {delivery.attempt_count}
          {delivery.replay_count > 0 ? (
            <span className="text-xs text-muted-foreground">
              {' '}
              {t('webhooks.replayed', { count: delivery.replay_count })}
            </span>
          ) : null}
        </>
      ),
    },
    {
      id: 'updated',
      header: t('webhooks.deliveryColumns.updated'),
      className: 'whitespace-nowrap text-muted-foreground',
      cell: (delivery) => dateFormat.format(new Date(delivery.updated_at)),
    },
    {
      id: 'actions',
      header: t('webhooks.deliveryColumns.actions'),
      align: 'end',
      cell: (delivery) => (
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setDialog({ kind: 'attempts', delivery })}
          >
            <ListTree aria-hidden="true" />
            {t('webhooks.actions.attempts')}
          </Button>
          {isReplayable(delivery) ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setDialog({ kind: 'replay', delivery })}
            >
              <RotateCw aria-hidden="true" />
              {t('webhooks.actions.replay')}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <SectionCard
      icon={Send}
      titleId="webhook-deliveries-title"
      title={t('webhooks.deliveriesTitle')}
      description={meta ? t('webhooks.deliveryTotal', { count: meta.total }) : t('common.loading')}
      contentClassName="p-0"
      actions={
        <>
          <div className="flex items-center gap-2">
            <Label htmlFor="webhook-status-filter" className="whitespace-nowrap text-xs">
              {t('webhooks.statusFilter')}
            </Label>
            <Select
              name="status"
              value={status ?? ALL}
              onValueChange={(value) => {
                setStatus(value === ALL ? undefined : (value as WebhookDeliveryStatus));
                setPage(1);
              }}
            >
              <SelectTrigger id="webhook-status-filter" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('webhooks.allStatuses')}</SelectItem>
                {webhookDeliveryStatuses.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`webhooks.deliveryStatus.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      }
    >
      <DataTable
        columns={columns}
        rows={deliveries.data?.data}
        rowKey={(delivery) => delivery.id}
        status={deliveries.status}
        errorMessage={t('webhooks.errors.unavailable')}
        emptyMessage={t('webhooks.deliveriesEmpty')}
        minWidthClassName="min-w-[760px]"
        alignTop
        skeletonRows={3}
      />
      <PagePagination meta={meta} label={t('webhooks.deliveryPagination')} onPageChange={setPage} />

      <Dialog open={dialog !== null} onOpenChange={(open) => (open ? undefined : closeDialog())}>
        <DialogContent>
          {dialog?.kind === 'replay' ? (
            <>
              <DialogTitle>{t('webhooks.replayConfirm.title')}</DialogTitle>
              <DialogDescription>
                {t('webhooks.replayConfirm.description', { message: dialog.delivery.message_id })}
              </DialogDescription>
              {replay.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  {t(replayErrorKey(replay.error))}
                </p>
              ) : null}
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    {t('common.cancel')}
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  disabled={replay.isPending}
                  onClick={() => replay.mutate(dialog.delivery.id, { onSuccess: closeDialog })}
                >
                  {t('webhooks.actions.replay')}
                </Button>
              </DialogFooter>
            </>
          ) : dialog ? (
            <>
              <DialogTitle>{t('webhooks.attemptsTitle')}</DialogTitle>
              <DialogDescription>
                {t('webhooks.attemptsDescription', { message: dialog.delivery.message_id })}
              </DialogDescription>
              {attempts.isPending ? (
                <Skeleton className="h-16 w-full" />
              ) : attempts.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  {t('webhooks.errors.unavailable')}
                </p>
              ) : attempts.data.data.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('webhooks.attemptsEmpty')}</p>
              ) : (
                <ol className="flex max-h-72 flex-col gap-2 overflow-y-auto text-sm">
                  {attempts.data.data.map((attempt) => (
                    <li key={attempt.id} className="rounded-md border px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {t('webhooks.attemptNumber', { number: attempt.number })}
                        </span>
                        <code className="text-xs">
                          {[attempt.outcome, attempt.http_status, attempt.failure_code]
                            .filter(Boolean)
                            .join(' · ')}
                        </code>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {dateFormat.format(new Date(attempt.completed_at))} ·{' '}
                        {t('webhooks.duration', { ms: attempt.duration_ms })}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    {t('common.close')}
                  </Button>
                </DialogClose>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

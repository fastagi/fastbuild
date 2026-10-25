import { Link } from '@tanstack/react-router';
import { BellRing, ChevronRight, CircleCheck, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SectionCard } from '@/components/layout/section-card';
import { Skeleton } from '@/components/ui/skeleton';
import { isOperatorFeatureEnabled } from '@/config/env';
import { useFailedDeliveryCount } from '@/features/notification-deliveries/hooks/use-notification-deliveries';

/** Failures an operator can act on, each linking to the screen that diagnoses it. */
export function AttentionPanel() {
  const { t } = useTranslation();
  const notificationsEnabled = isOperatorFeatureEnabled('notification');
  const failedDeliveries = useFailedDeliveryCount(notificationsEnabled);

  if (!notificationsEnabled) {
    return null;
  }

  return (
    <SectionCard
      icon={TriangleAlert}
      titleId="attention-title"
      title={t('overview.attention.title')}
      description={t('overview.attention.description')}
      contentClassName="p-0"
    >
      {failedDeliveries.isPending ? (
        <div className="p-4" aria-busy="true">
          <Skeleton className="h-10 w-full" />
        </div>
      ) : failedDeliveries.isError ? (
        <p role="alert" className="p-4 text-sm text-destructive">
          {t('overview.attention.unavailable')}
        </p>
      ) : failedDeliveries.data === 0 ? (
        <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <CircleCheck aria-hidden="true" className="size-4 text-success-strong" />
          {t('overview.attention.clear')}
        </p>
      ) : (
        <Link
          to="/console/notifications"
          search={{ status: 'failed' }}
          className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
        >
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-md bg-danger-subtle text-danger-strong"
          >
            <BellRing className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">
              {t('overview.attention.failedDeliveries', { count: failedDeliveries.data })}
            </span>
            <span className="block text-xs text-muted-foreground">
              {t('overview.attention.failedDeliveriesHint')}
            </span>
          </span>
          <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
        </Link>
      )}
    </SectionCard>
  );
}

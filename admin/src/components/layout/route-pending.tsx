import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';

/** Stable placeholder shown while a route's beforeLoad or loader is still running. */
export function RoutePending() {
  const { t } = useTranslation();

  return (
    <div className="route-pending" role="status" aria-live="polite">
      <span className="sr-only">{t('common.loading')}</span>
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

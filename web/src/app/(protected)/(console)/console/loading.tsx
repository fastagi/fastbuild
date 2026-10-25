import { Skeleton } from '@/components/ui/skeleton';
import { getT } from '@/i18n/server';

/** Console segment fallback; it streams inside the shell while a page resolves. */
export default async function ConsoleLoading() {
  const t = await getT('common');

  return (
    <div
      className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-12"
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">{t('loading')}</span>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}

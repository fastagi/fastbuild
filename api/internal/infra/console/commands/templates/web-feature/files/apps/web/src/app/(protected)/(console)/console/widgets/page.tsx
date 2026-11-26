import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import { Skeleton } from '@/components/ui/skeleton';
import { isWebFeatureEnabled } from '@/config/features';
import { WidgetWorkspace } from '@/features/widget/components/widget-workspace';
import { getT } from '@/i18n/server';

export default async function WidgetPage() {
  if (!isWebFeatureEnabled('widget')) notFound();
  const t = await getT('widget');

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="border-b pb-5">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>
      <div className="pt-5">
        <Suspense fallback={<Skeleton className="h-48 w-full" />}>
          <WidgetWorkspace />
        </Suspense>
      </div>
    </div>
  );
}

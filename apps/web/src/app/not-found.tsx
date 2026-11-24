import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';
import { getT } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('errors');

  return { title: t('notFound') };
}

/** Renders for every path outside a route that has its own not-found page. */
export default async function NotFound() {
  const t = await getT('errors');

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-bg-canvas px-4 py-12 text-center">
      <span className="font-mono text-sm font-semibold text-primary">404</span>
      <h1 className="mt-3 text-2xl font-semibold text-text-main">{t('notFound')}</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-text-subtle">
        {t('notFoundDescription')}
      </p>
      <Button asChild className="mt-6">
        <Link href={ROUTES.SITE.HOME}>
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t('backToHome')}
        </Link>
      </Button>
    </main>
  );
}

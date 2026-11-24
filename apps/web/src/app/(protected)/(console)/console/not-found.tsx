import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';
import { getT } from '@/i18n/server';

/** Renders inside the console shell when a console page calls `notFound()`. */
export default async function ConsoleNotFound() {
  const t = await getT();

  return (
    <div className="mx-auto flex min-h-[50svh] w-full max-w-xl flex-col items-start justify-center px-4 py-12 md:px-8">
      <span className="font-mono text-sm font-semibold text-primary">404</span>
      <h1 className="mt-3 text-2xl font-semibold text-text-main">{t('errors.notFound')}</h1>
      <p className="mt-3 text-sm leading-6 text-text-subtle">
        {t('console.boundary.notFoundDescription')}
      </p>
      <Button asChild className="mt-6">
        <Link href={ROUTES.CONSOLE.HOME}>
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t('console.boundary.backToConsole')}
        </Link>
      </Button>
    </div>
  );
}

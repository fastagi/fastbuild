'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { authConfig } from '@/config/auth';
import { ROUTES } from '@/constants/routes';
import { ApiError } from '@/http/request';
import { useT } from '@/i18n';

interface ConsoleErrorProps {
  error: Error & { digest?: string };
  retry: () => void;
}

/**
 * Console segment boundary. It renders inside the console shell so navigation
 * stays usable; root layout failures still fall through to `app/error.tsx`.
 */
export default function ConsoleError({ error, retry }: ConsoleErrorProps) {
  const t = useT();
  const router = useRouter();
  const signedOut = error instanceof ApiError && error.status === 401;
  const requestId = error instanceof ApiError ? error.requestId : undefined;

  useEffect(() => {
    if (signedOut) {
      // An expired session is a navigation state, not a page failure.
      const returnUrl = encodeURIComponent(window.location.pathname);
      router.replace(`${authConfig.routes.login}?returnUrl=${returnUrl}`);
      return;
    }
    console.error('[FastBuild] Console route error', error, { digest: error.digest });
  }, [error, router, signedOut]);

  if (signedOut) {
    return null;
  }

  return (
    <div
      className="mx-auto flex min-h-[50svh] w-full max-w-xl flex-col items-start justify-center px-4 py-12 md:px-8"
      role="alert"
      aria-live="assertive"
    >
      <h1 className="text-2xl font-semibold text-text-main">
        {t('console.boundary.errorTitle')}
      </h1>
      <p className="mt-3 text-sm leading-6 text-text-subtle">
        {t('console.boundary.errorDescription')}
      </p>
      {requestId ? (
        <p className="mt-2 font-mono text-xs text-text-muted">
          {t('console.boundary.requestId', { requestId })}
        </p>
      ) : error.digest ? (
        <p className="mt-2 font-mono text-xs text-text-muted">
          {t('console.boundary.errorDigest', { digest: error.digest })}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          type="button"
          icon={<RefreshCw aria-hidden="true" className="size-4" />}
          onClick={() => retry()}
        >
          {t('common.retry')}
        </Button>
        <Button asChild variant="outline">
          <Link href={ROUTES.CONSOLE.HOME}>
            <ArrowLeft aria-hidden="true" className="size-4" />
            {t('console.boundary.backToConsole')}
          </Link>
        </Button>
      </div>
    </div>
  );
}

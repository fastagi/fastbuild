import { type ErrorComponentProps, Link, Navigate, useRouter } from '@tanstack/react-router';
import { ArrowLeft, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { isSignedOut } from '@/features/operator-session/hooks/use-operator-session';
import { ApiError } from '@/http/client';

/** Router-level boundary for render, loader, and beforeLoad failures. */
export function RouteErrorPage({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation();
  const router = useRouter();

  // An expired operator session is a navigation state, not a page failure.
  if (isSignedOut(error)) {
    return <Navigate to="/login" search={{ redirect: router.state.location.href }} replace />;
  }

  const requestId = error instanceof ApiError ? error.requestId : undefined;

  return (
    <main className="route-error" role="alert">
      <h1>{t('errors.routeErrorTitle')}</h1>
      <p>{t('errors.routeErrorDescription')}</p>
      {requestId ? (
        <p className="route-error-request">{t('errors.requestId', { requestId })}</p>
      ) : null}
      <div className="route-error-actions">
        <Button
          type="button"
          onClick={() => {
            reset();
            void router.invalidate();
          }}
        >
          <RotateCw className="size-4" />
          {t('errors.retry')}
        </Button>
        <Button asChild variant="outline">
          <Link to="/console">
            <ArrowLeft className="size-4" />
            {t('errors.backToConsole')}
          </Link>
        </Button>
      </div>
    </main>
  );
}

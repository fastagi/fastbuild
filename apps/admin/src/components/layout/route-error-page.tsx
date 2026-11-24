import { type ErrorComponentProps, Link, Navigate, useRouter } from '@tanstack/react-router';
import { ArrowLeft, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { RouteFailure } from '@/components/layout/route-failure';
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
    <RouteFailure
      alert
      title={t('errors.routeErrorTitle')}
      description={t('errors.routeErrorDescription')}
      detail={requestId ? t('errors.requestId', { requestId }) : undefined}
    >
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
    </RouteFailure>
  );
}

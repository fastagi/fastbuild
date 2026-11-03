import { RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/http/client';
import { cn } from '@/lib/cn';

export interface QueryErrorProps {
  message: ReactNode;
  /** The failure; an `ApiError` contributes its request ID for diagnostics. */
  error?: unknown;
  /** Offers a retry. Leave it out where retrying cannot help, such as a missing record. */
  onRetry?: (() => void) | undefined;
  /** The retry is in flight. */
  retrying?: boolean | undefined;
  className?: string | undefined;
}

/** A failed read: what went wrong, the request ID to quote, and a way to try again. */
export function QueryError({ message, error, onRetry, retrying, className }: QueryErrorProps) {
  const { t } = useTranslation();
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  return (
    <div role="alert" className={cn('flex flex-col items-start gap-2 p-4 text-sm', className)}>
      <p className="text-destructive">{message}</p>
      {requestId ? (
        <p className="text-xs [overflow-wrap:anywhere] text-muted-foreground">
          {t('errors.requestId', { requestId })}
        </p>
      ) : null}
      {onRetry ? (
        <Button type="button" size="sm" variant="outline" disabled={retrying} onClick={onRetry}>
          <RotateCw aria-hidden="true" className={cn(retrying && 'animate-spin')} />
          {t('errors.retry')}
        </Button>
      ) : null}
    </div>
  );
}

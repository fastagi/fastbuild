/**
 * @component EmptyState
 * @category Common
 * @status Stable
 * @description The dashed panel a list shows when it has nothing to display.
 * @usage Say what is missing in the title and how to change that in the description.
 * @example
 * <EmptyState
 *   icon={<Building2 />}
 *   title="No organizations yet"
 *   description="Create one to invite members."
 *   action={<Button>Create organization</Button>}
 * />
 */
import type { ReactNode } from 'react';

import { cn } from '@/utils';

interface EmptyStateProps extends Omit<React.ComponentProps<'div'>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  /** Decorative; it is hidden from assistive technology. */
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex min-h-56 flex-col items-center justify-center rounded-md border border-dashed p-8 text-center',
        className
      )}
      {...props}
    >
      {icon ? (
        <div className="mb-4 text-muted-foreground [&_svg]:size-8" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <h2 className="text-base font-medium">{title}</h2>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn.ts';

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  readonly icon?: ReactNode;
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
}

/** Centered empty-state panel with optional icon, copy, and call-to-action. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-10 text-center',
        className,
      )}
      {...props}
    >
      {icon ? (
        <div
          className="mb-3 flex size-10 items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground [&_svg]:size-5"
          aria-hidden="true"
        >
          {icon}
        </div>
      ) : null}
      <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn.ts';
import { StatusDot, type StatusTone } from './status-dot.tsx';

export interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  readonly label: string;
  readonly value: ReactNode;
  readonly subtext?: ReactNode;
  readonly icon?: ReactNode;
  readonly status?: {
    readonly label: string;
    readonly tone?: StatusTone;
    readonly pulse?: boolean;
  };
}

/** Metric summary card with tabular-nums value and optional icon, subtext, and status pill. */
export function StatCard({
  label,
  value,
  subtext,
  icon,
  status,
  className,
  ...props
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm',
        className,
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {status ? (
          <StatusDot
            tone={status.tone ?? 'neutral'}
            label={status.label}
            pulse={status.pulse ?? false}
          />
        ) : icon ? (
          <span className="text-muted-foreground [&_svg]:size-4" aria-hidden="true">
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-2 truncate font-mono text-lg font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </div>
      {subtext ? <p className="mt-1 truncate text-xs text-muted-foreground">{subtext}</p> : null}
    </div>
  );
}

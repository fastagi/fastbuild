import type { HTMLAttributes } from 'react';
import { cn } from './cn.ts';

export type StatusTone = 'brand' | 'danger' | 'neutral' | 'success' | 'warning';

const dotToneClasses: Record<StatusTone, string> = {
  brand: 'bg-brand',
  danger: 'bg-danger',
  neutral: 'bg-muted-foreground',
  success: 'bg-success',
  warning: 'bg-warning',
};

const pillToneClasses: Record<StatusTone, string> = {
  brand: 'border-brand/25 bg-brand-subtle text-brand-strong',
  danger: 'border-danger/25 bg-danger-subtle text-danger-strong',
  neutral: 'border-border bg-muted text-muted-foreground',
  success: 'border-success/25 bg-success-subtle text-success-strong',
  warning: 'border-warning/30 bg-warning-subtle text-warning-strong',
};

export interface StatusDotProps extends HTMLAttributes<HTMLSpanElement> {
  readonly tone?: StatusTone;
  readonly label?: string;
  readonly pulse?: boolean;
}

/** Semantic status indicator dot with optional pill label. */
export function StatusDot({
  tone = 'neutral',
  label,
  pulse = false,
  className,
  ...props
}: StatusDotProps) {
  if (label) {
    return (
      <span
        className={cn(
          'inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 text-xs font-medium',
          pillToneClasses[tone],
          className,
        )}
        {...props}
      >
        <span
          className={cn('size-1.5 rounded-full bg-current', pulse && 'animate-pulse')}
          aria-hidden="true"
        />
        {label}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-block size-2 shrink-0 rounded-full',
        dotToneClasses[tone],
        pulse && 'animate-pulse',
        className,
      )}
      {...props}
    />
  );
}

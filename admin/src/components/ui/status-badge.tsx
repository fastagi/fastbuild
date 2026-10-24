import type { HTMLAttributes } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';

type StatusTone = 'brand' | 'danger' | 'neutral' | 'success' | 'warning';

const toneClasses: Record<StatusTone, string> = {
  brand: 'border-brand/25 bg-brand-subtle text-brand-strong',
  danger: 'border-danger/25 bg-danger-subtle text-danger-strong',
  neutral: 'border-border bg-muted text-subtle',
  success: 'border-success/25 bg-success-subtle text-success-strong',
  warning: 'border-warning/30 bg-warning-subtle text-warning-strong',
};

interface StatusBadgeProps extends HTMLAttributes<HTMLDivElement> {
  tone?: StatusTone;
}

/** A shadcn Badge with a leading dot, colored by semantic state rather than decoration. */
export function StatusBadge({ className, children, tone = 'neutral', ...props }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'h-6 gap-1.5 whitespace-nowrap rounded-full px-2 font-medium',
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </Badge>
  );
}

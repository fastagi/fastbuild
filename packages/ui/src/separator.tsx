import * as React from 'react';
import { cn } from './cn.ts';

export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly orientation?: 'horizontal' | 'vertical';
  readonly decorative?: boolean;
  readonly ref?: React.Ref<HTMLDivElement>;
}

/** Hairline horizontal or vertical divider using the semantic border token. */
export function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  ref,
  ...props
}: SeparatorProps) {
  return (
    <div
      ref={ref}
      role={decorative ? 'none' : 'separator'}
      aria-orientation={decorative ? undefined : orientation}
      data-orientation={orientation}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  );
}

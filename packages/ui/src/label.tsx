import * as React from 'react';
import { cn } from './cn.ts';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  readonly ref?: React.Ref<HTMLLabelElement>;
}

/** Accessible form label styled with FastBuild typography tokens. */
export function Label({ className, ref, ...props }: LabelProps) {
  return (
    <label
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className,
      )}
      {...props}
    />
  );
}

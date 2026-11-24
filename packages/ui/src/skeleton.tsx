import * as React from 'react';
import { cn } from './cn.ts';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly ref?: React.Ref<HTMLDivElement>;
}

/** Animated neutral placeholder block for loading states. */
export function Skeleton({ className, ref, ...props }: SkeletonProps) {
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

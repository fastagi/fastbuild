import * as React from 'react';
import { cn } from './cn.ts';

export interface TextareaProps extends React.ComponentProps<'textarea'> {
  readonly ref?: React.Ref<HTMLTextAreaElement>;
}

/** Multi-line text input matching Input's zero-chroma border and focus ring. */
export function Textarea({ className, ref, ...props }: TextareaProps) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
      {...props}
    />
  );
}

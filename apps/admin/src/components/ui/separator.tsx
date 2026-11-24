import * as React from 'react';

import { cn } from '@/lib/cn';

type SeparatorProps = React.ComponentProps<'div'> & {
  orientation?: 'horizontal' | 'vertical';
  /** A purely visual line is hidden from assistive technology; otherwise it is a separator. */
  decorative?: boolean;
};

function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}: SeparatorProps) {
  const semantics = decorative
    ? { role: 'none' }
    : {
        role: 'separator',
        ...(orientation === 'vertical' ? { 'aria-orientation': 'vertical' as const } : {}),
      };
  return (
    <div
      data-slot="separator"
      data-orientation={orientation}
      {...semantics}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  );
}

export { Separator };

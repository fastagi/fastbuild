import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * A native label. Every Admin Console label points at a labelable element (an input or a button
 * such as a select trigger or switch), so the browser names and activates it without script.
 */
function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    // eslint-disable-next-line jsx-a11y/label-has-associated-control -- callers pass htmlFor or wrap their control.
    <label
      className={cn(
        'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className,
      )}
      {...props}
    />
  );
}

export { Label };

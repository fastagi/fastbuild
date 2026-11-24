import * as React from 'react';
import * as SwitchPrimitive from '@ui-sdk/react/switch';

import { cn } from '@/lib/cn';

type SwitchProps = Omit<
  React.ComponentProps<typeof SwitchPrimitive.Switch>,
  'className' | 'onCheckedChange'
> & {
  className?: string;
  onCheckedChange?: (checked: boolean) => void;
};

function Switch({ className, onCheckedChange, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Switch
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-input shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-checked:bg-brand data-disabled:cursor-not-allowed data-disabled:opacity-50',
        className,
      )}
      {...props}
      {...(onCheckedChange
        ? { onCheckedChange: (checked: boolean) => onCheckedChange(checked) }
        : {})}
    >
      <SwitchPrimitive.SwitchThumb className="pointer-events-none block h-4 w-4 translate-x-0 rounded-full bg-background shadow-lg ring-0 transition-transform data-checked:translate-x-4" />
    </SwitchPrimitive.Switch>
  );
}

export { Switch };

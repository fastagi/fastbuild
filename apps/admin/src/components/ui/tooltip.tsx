import * as React from 'react';
import * as TooltipPrimitive from '@ui-sdk/react/tooltip';

import { cn } from '@/lib/cn';
import { asChildProps } from '@/components/ui/slot';

/**
 * ui-sdk tooltips need no provider: once one is open the next opens at once. This stays so shells
 * that wrap a region keep compiling; `delayDuration` sets the delay for tooltips inside it.
 */
const TooltipDelayContext = React.createContext<number | undefined>(undefined);

function TooltipProvider({
  delayDuration,
  children,
}: {
  delayDuration?: number;
  children?: React.ReactNode;
}) {
  return (
    <TooltipDelayContext.Provider value={delayDuration}>{children}</TooltipDelayContext.Provider>
  );
}

type TooltipProps = React.ComponentProps<typeof TooltipPrimitive.Tooltip> & {
  delayDuration?: number;
};

function Tooltip({ delayDuration, delay, ...props }: TooltipProps) {
  const inherited = React.useContext(TooltipDelayContext);
  const resolved = delay ?? delayDuration ?? inherited;
  return (
    <TooltipPrimitive.Tooltip {...(resolved === undefined ? {} : { delay: resolved })} {...props} />
  );
}

type TooltipTriggerProps = React.ComponentProps<typeof TooltipPrimitive.TooltipTrigger> & {
  asChild?: boolean;
};

function TooltipTrigger({ asChild, children, ...props }: TooltipTriggerProps) {
  return (
    <TooltipPrimitive.TooltipTrigger
      {...props}
      {...asChildProps(asChild, children as React.ReactNode)}
    />
  );
}

type TooltipContentProps = Omit<
  React.ComponentProps<typeof TooltipPrimitive.TooltipContent>,
  'className' | 'hidden'
> & {
  className?: string;
  /** Suppresses the tooltip entirely, such as a collapsed-only sidebar hint while expanded. */
  hidden?: boolean;
};

function TooltipContent({ className, sideOffset = 4, hidden, ...props }: TooltipContentProps) {
  if (hidden) {
    return null;
  }
  return (
    <TooltipPrimitive.TooltipContent
      sideOffset={sideOffset}
      className={cn(
        'z-50 origin-(--transform-origin) overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-[opacity,scale] duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 data-instant:transition-none motion-reduce:transition-none',
        className,
      )}
      {...props}
    />
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };

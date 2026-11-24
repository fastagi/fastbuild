import * as React from 'react';
import * as DialogPrimitive from '@ui-sdk/react/dialog';

import { cn } from '@/lib/cn';
import { asChildProps } from '@/components/ui/slot';

type WithClassName<T> = Omit<T, 'className'> & { className?: string };

const Dialog = DialogPrimitive.Dialog;

type DialogCloseProps = React.ComponentProps<typeof DialogPrimitive.DialogClose> & {
  asChild?: boolean;
};

function DialogClose({ asChild, children, ...props }: DialogCloseProps) {
  return (
    <DialogPrimitive.DialogClose
      {...props}
      {...asChildProps(asChild, children as React.ReactNode)}
    />
  );
}

/**
 * The dialog renders in the browser's top layer, so it needs no portal or z-index; the backdrop
 * sits beside it inside the same root.
 */
function DialogContent({
  className,
  children,
  ...props
}: WithClassName<React.ComponentProps<typeof DialogPrimitive.DialogContent>>) {
  return (
    <>
      <DialogPrimitive.DialogBackdrop className="fixed inset-0 bg-black/60 transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none" />
      <DialogPrimitive.DialogContent
        className={cn(
          'fixed bottom-auto left-1/2 right-auto top-1/2 m-0 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-background p-6 text-foreground shadow-lg transition-[opacity,scale] duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 motion-reduce:transition-none',
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.DialogContent>
    </>
  );
}

function DialogTitle({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof DialogPrimitive.DialogTitle>>) {
  return (
    <DialogPrimitive.DialogTitle
      className={cn('text-base font-semibold leading-none', className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof DialogPrimitive.DialogDescription>>) {
  return (
    <DialogPrimitive.DialogDescription
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle };

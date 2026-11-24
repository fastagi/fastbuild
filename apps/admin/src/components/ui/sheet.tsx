import * as React from 'react';
import * as DialogPrimitive from '@ui-sdk/react/dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';

import { cn } from '@/lib/cn';
import { asChildProps } from '@/components/ui/slot';

type WithClassName<T> = Omit<T, 'className' | 'children'> & {
  className?: string;
  children?: React.ReactNode;
};

/**
 * An edge sheet built on ui-sdk's Dialog: top layer, focus trap and scroll lock come from the
 * dialog, and the slide is plain CSS. It deliberately avoids Drawer, whose swipe physics would
 * load on every console page for a panel that only phones open.
 */
const Sheet = DialogPrimitive.Dialog;

function SheetTrigger({
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.DialogTrigger> & { asChild?: boolean }) {
  return (
    <DialogPrimitive.DialogTrigger
      {...props}
      {...asChildProps(asChild, children as React.ReactNode)}
    />
  );
}

function SheetClose({
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.DialogClose> & { asChild?: boolean }) {
  return (
    <DialogPrimitive.DialogClose
      {...props}
      {...asChildProps(asChild, children as React.ReactNode)}
    />
  );
}

const sheetVariants = cva(
  'fixed m-0 flex max-h-none max-w-none flex-col gap-4 bg-background p-6 text-foreground shadow-lg transition-transform duration-300 ease-out motion-reduce:transition-none',
  {
    variants: {
      side: {
        top: 'inset-x-0 top-0 bottom-auto w-full border-b data-starting-style:-translate-y-full data-ending-style:-translate-y-full',
        bottom:
          'inset-x-0 bottom-0 top-auto w-full border-t data-starting-style:translate-y-full data-ending-style:translate-y-full',
        left: 'inset-y-0 left-0 right-auto h-full w-3/4 border-r data-starting-style:-translate-x-full data-ending-style:-translate-x-full sm:max-w-sm',
        right:
          'inset-y-0 right-0 left-auto h-full w-3/4 border-l data-starting-style:translate-x-full data-ending-style:translate-x-full sm:max-w-sm',
      },
    },
    defaultVariants: {
      side: 'right',
    },
  },
);

function SheetContent({
  side = 'right',
  className,
  children,
  closeLabel = 'Close',
  ...props
}: WithClassName<React.ComponentProps<typeof DialogPrimitive.DialogContent>> &
  VariantProps<typeof sheetVariants> & { closeLabel?: string }) {
  return (
    <>
      <DialogPrimitive.DialogBackdrop className="fixed inset-0 bg-black/80 transition-opacity duration-300 data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none" />
      <DialogPrimitive.DialogContent className={cn(sheetVariants({ side }), className)} {...props}>
        <DialogPrimitive.DialogClose
          aria-label={closeLabel}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </DialogPrimitive.DialogClose>
        {children}
      </DialogPrimitive.DialogContent>
    </>
  );
}

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-2 text-center sm:text-left', className)} {...props} />
);

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
    {...props}
  />
);

function SheetTitle({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof DialogPrimitive.DialogTitle>>) {
  return (
    <DialogPrimitive.DialogTitle
      className={cn('text-lg font-semibold text-foreground', className)}
      {...props}
    />
  );
}

function SheetDescription({
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

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};

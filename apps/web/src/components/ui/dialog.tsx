/**
 * @component Dialog
 * @category UI
 * @status Stable
 * @description A window overlaid on either the primary window or another dialog window, rendering the content underneath inert.
 * @usage Use for modal windows, confirmations, or secondary content that requires focus.
 * @example
 * <Dialog>
 *   <DialogTrigger>Open</DialogTrigger>
 *   <DialogContent>
 *     <DialogHeader>
 *       <DialogTitle>Confirmation</DialogTitle>
 *     </DialogHeader>
 *     <DialogBody>Are you sure?</DialogBody>
 *     <DialogFooter>
 *       <Button>Cancel</Button>
 *       <Button>Confirm</Button>
 *     </DialogFooter>
 *   </DialogContent>
 * </Dialog>
 */
"use client"

import * as React from "react"
import * as DialogPrimitive from "@ui-sdk/react/dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/utils"
import { asChildProps } from "@/components/ui/slot"

type WithClassName<T> = Omit<T, "className" | "children"> & {
  className?: string
  children?: React.ReactNode
}

const Dialog = DialogPrimitive.Dialog

function DialogTrigger({
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.DialogTrigger> & {
  asChild?: boolean
}) {
  return (
    <DialogPrimitive.DialogTrigger
      data-slot="dialog-trigger"
      {...props}
      {...asChildProps(asChild, children as React.ReactNode)}
    />
  )
}

/** Dialog renders in the browser's top layer; no portal is needed. Kept for API compatibility. */
function DialogPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}

function DialogClose({
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.DialogClose> & {
  asChild?: boolean
}) {
  return (
    <DialogPrimitive.DialogClose
      data-slot="dialog-close"
      {...props}
      {...asChildProps(asChild, children as React.ReactNode)}
    />
  )
}

function DialogOverlay({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof DialogPrimitive.DialogBackdrop>>) {
  return (
    <DialogPrimitive.DialogBackdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none",
        className
      )}
      {...props}
    />
  )
}

const dialogContentVariants = cva(
  "fixed bottom-auto left-1/2 right-auto top-1/2 m-0 flex w-full max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 border border-border/60 bg-background p-6 text-foreground shadow-premium transition-[opacity,scale] duration-200 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 motion-reduce:transition-none sm:rounded-xl",
  {
    variants: {
      size: {
        sm: "max-w-sm",
        default: "max-w-lg",
        lg: "max-w-2xl",
        xl: "max-w-4xl",
        full: "max-w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-4rem)]",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

interface DialogContentProps
  extends WithClassName<React.ComponentProps<typeof DialogPrimitive.DialogContent>>,
    VariantProps<typeof dialogContentVariants> {
  hideCloseButton?: boolean
}

function DialogContent({
  className,
  children,
  size,
  hideCloseButton = false,
  ...props
}: DialogContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.DialogContent
        data-slot="dialog-content"
        className={cn(dialogContentVariants({ size, className }))}
        {...props}
      >
        {children}
        {!hideCloseButton && (
          <DialogPrimitive.DialogClose className="absolute right-3 top-3 flex size-7 cursor-pointer items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-all hover:bg-muted hover:text-foreground focus-ring disabled:cursor-not-allowed disabled:opacity-50">
            <X className="size-4" aria-hidden="true" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.DialogClose>
        )}
      </DialogPrimitive.DialogContent>
    </DialogPortal>
  )
}

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="dialog-header"
    className={cn(
      "flex flex-col gap-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="dialog-footer"
    className={cn(
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3",
      className
    )}
    {...props}
  />
)

const DialogBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="dialog-body"
    className={cn(
      "flex-1 overflow-y-auto overscroll-contain -mx-6 px-6",
      className
    )}
    {...props}
  />
)

function DialogTitle({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof DialogPrimitive.DialogTitle>>) {
  return (
    <DialogPrimitive.DialogTitle
      data-slot="dialog-title"
      className={cn(
        "text-lg font-semibold leading-none tracking-tight text-foreground",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof DialogPrimitive.DialogDescription>>) {
  return (
    <DialogPrimitive.DialogDescription
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground leading-relaxed", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}

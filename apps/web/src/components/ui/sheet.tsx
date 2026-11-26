/**
 * @component Sheet
 * @category UI
 * @status Stable
 * @description An extension of Dialog that slides in from the edge of the screen, typically used for sidebars or mobile menus.
 * @usage Use for secondary navigation or complex forms that slide in from any edge (top, right, bottom, left).
 * @example
 * <Sheet>
 *   <SheetTrigger>Open</SheetTrigger>
 *   <SheetContent side="right">
 *     <SheetHeader>
 *       <SheetTitle>Menu</SheetTitle>
 *     </SheetHeader>
 *     <div>Content</div>
 *   </SheetContent>
 * </Sheet>
 */
"use client"

import * as React from "react"
import * as DialogPrimitive from "@ui-sdk/react/dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/utils"
import { asChildProps } from "@/components/ui/slot"

type WithClassName<T> = Omit<T, "className" | "children"> & {
  className?: string
  children?: React.ReactNode
}

const Sheet = DialogPrimitive.Dialog

function SheetTrigger({
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.DialogTrigger> & {
  asChild?: boolean
}) {
  return (
    <DialogPrimitive.DialogTrigger
      data-slot="sheet-trigger"
      {...props}
      {...asChildProps(asChild, children as React.ReactNode)}
    />
  )
}

function SheetClose({
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.DialogClose> & {
  asChild?: boolean
}) {
  return (
    <DialogPrimitive.DialogClose
      data-slot="sheet-close"
      {...props}
      {...asChildProps(asChild, children as React.ReactNode)}
    />
  )
}

function SheetOverlay({
  className,
  backdrop = "blur",
  ...props
}: WithClassName<React.ComponentProps<typeof DialogPrimitive.DialogBackdrop>> & {
  backdrop?: "blur" | "dim"
}) {
  return (
    <DialogPrimitive.DialogBackdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 transition-opacity duration-300 data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none",
        backdrop === "blur" && "bg-black/20 backdrop-blur-sm",
        backdrop === "dim" && "bg-black/40",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  backdrop = "blur",
  ...props
}: WithClassName<React.ComponentProps<typeof DialogPrimitive.DialogContent>> & {
  side?: "top" | "right" | "bottom" | "left"
  backdrop?: "blur" | "dim"
}) {
  return (
    <>
      <SheetOverlay backdrop={backdrop} />
      <DialogPrimitive.DialogContent
        data-slot="sheet-content"
        className={cn(
          "bg-background/95 backdrop-blur-md fixed m-0 flex max-h-none max-w-none flex-col gap-4 text-foreground shadow-premium transition-transform duration-300 ease-out motion-reduce:transition-none",
          side === "right" &&
            "inset-y-0 right-0 left-auto h-full w-3/4 border-l data-starting-style:translate-x-full data-ending-style:translate-x-full sm:max-w-sm",
          side === "left" &&
            "inset-y-0 left-0 right-auto h-full w-3/4 border-r data-starting-style:-translate-x-full data-ending-style:-translate-x-full sm:max-w-sm",
          side === "top" &&
            "inset-x-0 top-0 bottom-auto h-auto w-full border-b data-starting-style:-translate-y-full data-ending-style:-translate-y-full",
          side === "bottom" &&
            "inset-x-0 bottom-0 top-auto h-auto w-full border-t data-starting-style:translate-y-full data-ending-style:translate-y-full",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.DialogClose className="absolute right-4 top-4 flex size-7 cursor-pointer items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-all hover:bg-muted hover:text-foreground focus-ring disabled:cursor-not-allowed disabled:opacity-50">
          <XIcon className="size-4" aria-hidden="true" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.DialogClose>
      </DialogPrimitive.DialogContent>
    </>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof DialogPrimitive.DialogTitle>>) {
  return (
    <DialogPrimitive.DialogTitle
      data-slot="sheet-title"
      className={cn("text-foreground font-semibold", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof DialogPrimitive.DialogDescription>>) {
  return (
    <DialogPrimitive.DialogDescription
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
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
}

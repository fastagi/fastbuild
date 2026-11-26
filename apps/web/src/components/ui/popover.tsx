/**
 * @component Popover
 * @category UI
 * @status Stable
 * @description Displays rich content in a portal, triggered by a button or other element, typically used for small forms or settings.
 * @usage Use for lightweight overlays that don't require the full surface of a dialog or drawer.
 * @example
 * <Popover>
 *   <PopoverTrigger>Open</PopoverTrigger>
 *   <PopoverContent>Content</PopoverContent>
 * </Popover>
 */
"use client"

import * as React from "react"
import * as PopoverPrimitive from "@ui-sdk/react/popover"

import { cn } from "@/utils"
import { Slot, asChildProps } from "@/components/ui/slot"

type WithClassName<T> = Omit<T, "className" | "children"> & {
  className?: string
  children?: React.ReactNode
}

const Popover = PopoverPrimitive.Popover

function PopoverTrigger({
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.PopoverTrigger> & {
  asChild?: boolean
}) {
  return (
    <PopoverPrimitive.PopoverTrigger
      data-slot="popover-trigger"
      {...props}
      {...asChildProps(asChild, children as React.ReactNode)}
    />
  )
}

function PopoverAnchor({
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "div"
  return <Comp data-slot="popover-anchor" {...props} />
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  render,
  ...props
}: WithClassName<React.ComponentProps<typeof PopoverPrimitive.PopoverContent>>) {
  const resolvedRender =
    render ??
    (props["aria-label"] && !props["aria-labelledby"]
      ? (elProps: Record<string, unknown>) => {
          const nextProps = { ...elProps }
          delete nextProps["aria-labelledby"]
          return <div {...nextProps} />
        }
      : undefined)

  return (
    <PopoverPrimitive.PopoverContent
      data-slot="popover-content"
      align={align}
      sideOffset={sideOffset}
      render={resolvedRender}
      className={cn(
        "z-50 m-0 w-auto origin-(--transform-origin) rounded-2xl border bg-popover/80 p-0 text-popover-foreground shadow-premium outline-hidden backdrop-blur-xl transition-[opacity,scale] duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 motion-reduce:transition-none",
        className
      )}
      {...props}
    />
  )
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }

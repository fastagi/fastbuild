/**
 * @component Tooltip
 * @category UI
 * @status Stable
 * @description A popup that displays information related to an element when the element receives keyboard focus or the mouse hovers over it.
 * @usage Use to provide brief, descriptive labels or information for icons or buttons.
 * @example
 * <Tooltip>
 *   <TooltipTrigger asChild>
 *     <Button variant="outline">Hover</Button>
 *   </TooltipTrigger>
 *   <TooltipContent>
 *     <p>Add to library</p>
 *   </TooltipContent>
 * </Tooltip>
 */
"use client"

import * as React from "react"
import * as TooltipPrimitive from "@ui-sdk/react/tooltip"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/utils"
import { asChildProps } from "@/components/ui/slot"

const TooltipDelayContext = React.createContext<number | undefined>(undefined)

function TooltipProvider({
  delayDuration = 0,
  children,
}: {
  delayDuration?: number
  children?: React.ReactNode
}) {
  return (
    <TooltipDelayContext.Provider value={delayDuration}>
      {children}
    </TooltipDelayContext.Provider>
  )
}

type TooltipProps = React.ComponentProps<typeof TooltipPrimitive.Tooltip> & {
  delayDuration?: number
}

function Tooltip({ delayDuration, delay, ...props }: TooltipProps) {
  const inherited = React.useContext(TooltipDelayContext)
  const resolved = delay ?? delayDuration ?? inherited
  return (
    <TooltipPrimitive.Tooltip
      {...(resolved === undefined ? {} : { delay: resolved })}
      {...props}
    />
  )
}

type TooltipTriggerProps = React.ComponentProps<
  typeof TooltipPrimitive.TooltipTrigger
> & {
  asChild?: boolean
}

function TooltipTrigger({ asChild, children, ...props }: TooltipTriggerProps) {
  return (
    <TooltipPrimitive.TooltipTrigger
      data-slot="tooltip-trigger"
      {...props}
      {...asChildProps(asChild, children as React.ReactNode)}
    />
  )
}

const tooltipVariants = cva(
  "z-50 w-fit origin-(--transform-origin) rounded-lg px-4 py-2 text-xs font-medium shadow-tooltip transition-[opacity,scale] duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 data-instant:transition-none motion-reduce:transition-none",
  {
    variants: {
      variant: {
        default: "bg-popover/90 text-popover-foreground backdrop-blur-md border",
        inverted: "bg-zinc-950/90 text-zinc-50 backdrop-blur-md border border-white/10 shadow-2xl",
        primary: "bg-primary/90 text-primary-foreground backdrop-blur-md border border-primary/20 shadow-lg shadow-primary/10",
        destructive: "bg-destructive/10 text-error backdrop-blur-md border border-destructive/20 shadow-lg shadow-destructive/5",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

type TooltipContentProps = Omit<
  React.ComponentProps<typeof TooltipPrimitive.TooltipContent>,
  "className" | "hidden"
> &
  VariantProps<typeof tooltipVariants> & {
    className?: string
    hidden?: boolean
  }

function TooltipContent({
  className,
  variant,
  sideOffset = 10,
  hidden,
  children,
  ...props
}: TooltipContentProps) {
  if (hidden) {
    return null
  }
  return (
    <TooltipPrimitive.TooltipContent
      data-slot="tooltip-content"
      sideOffset={sideOffset}
      className={cn(tooltipVariants({ variant }), className)}
      {...props}
    >
      {children}
    </TooltipPrimitive.TooltipContent>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }

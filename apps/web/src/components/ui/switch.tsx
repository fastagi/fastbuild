/**
 * @component Switch
 * @category UI
 * @status Stable
 * @description A control that allows the user to toggle a setting on or off.
 * @usage Use in forms or settings pages for boolean toggles.
 * @example
 * <div className="flex items-center space-x-2">
 *   <Switch id="airplane-mode" />
 *   <Label htmlFor="airplane-mode">Airplane Mode</Label>
 * </div>
 */
"use client"

import * as React from "react"
import * as SwitchPrimitive from "@ui-sdk/react/switch"

import { cn } from "@/utils"

type SwitchProps = Omit<
  React.ComponentProps<typeof SwitchPrimitive.Switch>,
  "className" | "onCheckedChange"
> & {
  className?: string
  onCheckedChange?: (checked: boolean) => void
}

function Switch({ className, onCheckedChange, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Switch
      data-slot="switch"
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-input shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-50 data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-50 focus-ring interactive",
        className
      )}
      {...props}
      {...(onCheckedChange
        ? { onCheckedChange: (checked: boolean) => onCheckedChange(checked) }
        : {})}
    >
      <SwitchPrimitive.SwitchThumb
        data-slot="switch-thumb"
        className="pointer-events-none block h-4 w-4 translate-x-0 rounded-full bg-background shadow-lg ring-0 transition-transform data-checked:translate-x-4"
      />
    </SwitchPrimitive.Switch>
  )
}

export { Switch }

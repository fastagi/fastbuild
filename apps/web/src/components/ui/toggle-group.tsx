/**
 * @component ToggleGroup
 * @category UI
 * @status Stable
 * @description A set of buttons that can be toggled on or off, with support for single or multiple selection.
 * @usage Use for filtering or selecting multiple options from a small set.
 * @example
 * <ToggleGroup type="multiple">
 *   <ToggleGroupItem value="bold">B</ToggleGroupItem>
 *   <ToggleGroupItem value="italic">I</ToggleGroupItem>
 * </ToggleGroup>
 */
"use client"

import * as React from "react"
import { Toggle, ToggleGroup as ToggleGroupPrimitive } from "@ui-sdk/react/toggle"
import { type VariantProps } from "class-variance-authority"

import { cn } from "@/utils"
import { toggleVariants } from "@/components/ui/toggle"

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants>
>({
  size: "default",
  variant: "default",
})

type PrimitiveProps = Omit<
  React.ComponentProps<typeof ToggleGroupPrimitive>,
  "className" | "children" | "value" | "defaultValue" | "onValueChange" | "multiple"
> & { children?: React.ReactNode }

type ToggleGroupProps = PrimitiveProps &
  VariantProps<typeof toggleVariants> & { className?: string } & (
    | {
        type: "single"
        value?: string
        defaultValue?: string
        onValueChange?: (value: string) => void
      }
    | {
        type: "multiple"
        value?: string[]
        defaultValue?: string[]
        onValueChange?: (value: string[]) => void
      }
  )

function ToggleGroup({
  className,
  variant,
  size,
  children,
  type,
  value,
  defaultValue,
  onValueChange,
  ...props
}: ToggleGroupProps) {
  const toList = (next: string | string[] | undefined) =>
    next === undefined ? undefined : Array.isArray(next) ? next : next ? [next] : []

  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      className={cn(
        "group/toggle-group flex w-fit items-center rounded-md data-[variant=outline]:shadow-xs",
        className
      )}
      multiple={type === "multiple"}
      deselectable={type === "multiple"}
      {...(value === undefined ? {} : { value: toList(value) ?? [] })}
      {...(defaultValue === undefined ? {} : { defaultValue: toList(defaultValue) ?? [] })}
      onValueChange={(next: string[]) => {
        if (type === "multiple") {
          ;(onValueChange as ((value: string[]) => void) | undefined)?.(next)
        } else {
          ;(onValueChange as ((value: string) => void) | undefined)?.(next[0] ?? "")
        }
      }}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  )
}

type ToggleGroupItemProps = Omit<React.ComponentProps<typeof Toggle>, "className"> &
  VariantProps<typeof toggleVariants> & { className?: string; value: string }

function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  ...props
}: ToggleGroupItemProps) {
  const context = React.useContext(ToggleGroupContext)

  return (
    <Toggle
      data-slot="toggle-group-item"
      data-variant={context.variant || variant}
      data-size={context.size || size}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        "min-w-0 flex-1 shrink-0 rounded-none shadow-none first:rounded-l-md last:rounded-r-md focus:z-10 focus-visible:z-10 data-[variant=outline]:border-l-0 data-[variant=outline]:first:border-l",
        className
      )}
      {...props}
    >
      {children}
    </Toggle>
  )
}

export { ToggleGroup, ToggleGroupItem }

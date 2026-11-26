/**
 * @component Select
 * @category UI
 * @status Stable
 * @description A control that allows the user to choose one option from a list of values.
 * @usage Use in forms for mutually exclusive selections. Supports groupings, headers, and separators.
 * @example
 * <Select>
 *   <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
 *   <SelectContent>
 *     <SelectItem value="1">Option 1</SelectItem>
 *     <SelectItem value="2">Option 2</SelectItem>
 *   </SelectContent>
 * </Select>
 */
"use client"

import * as React from "react"
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/utils"

const selectTriggerVariants = cva(
  "data-placeholder:text-muted-foreground flex w-full cursor-pointer appearance-none [-webkit-appearance:none] [-moz-appearance:none] [background-image:none] truncate rounded-md py-2 pl-3 pr-8 text-sm shadow-xs transition-all disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 focus-border dark:scheme-dark",
  {
    variants: {
      variant: {
        outline:
          "border border-input bg-transparent dark:bg-input/30 dark:hover:bg-input/50",
        filled:
          "border-transparent bg-muted/50 hover:bg-muted focus:bg-background focus:border-input",
      },
    },
    defaultVariants: {
      variant: "outline",
    },
  }
)

type SelectProps = {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  name?: string
  form?: string
  disabled?: boolean
  required?: boolean
  children?: React.ReactNode
}

type SelectTriggerProps = Omit<
  React.ComponentProps<"select">,
  "value" | "defaultValue" | "onChange" | "multiple" | "size"
> &
  VariantProps<typeof selectTriggerVariants> & {
    size?: "sm" | "default"
  }

type SelectItemProps = {
  value: string
  disabled?: boolean
  className?: string
  children?: React.ReactNode
}

const SelectTrigger: (props: SelectTriggerProps) => null = () => null
const SelectValue: (props: { placeholder?: string }) => null = () => null
const SelectContent: (props: {
  className?: string
  position?: "popper" | "item-aligned"
  children?: React.ReactNode
}) => null = () => null
const SelectGroup: (props: { children?: React.ReactNode }) => null = () => null
const SelectLabel: (props: {
  className?: string
  children?: React.ReactNode
}) => null = () => null
const SelectItem: (props: SelectItemProps) => null = () => null
const SelectSeparator: (props: { className?: string }) => null = () => null

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-scroll-up-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronUpIcon className="size-4" aria-hidden="true" />
    </div>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-scroll-down-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronDownIcon className="size-4" aria-hidden="true" />
    </div>
  )
}

function textOf(node: React.ReactNode): string {
  let text = ""
  React.Children.forEach(node, child => {
    if (typeof child === "string" || typeof child === "number") {
      text += String(child)
    } else if (React.isValidElement<{ children?: React.ReactNode }>(child)) {
      text += textOf(child.props.children)
    }
  })
  return text
}

function renderOptions(children: React.ReactNode): React.ReactNode[] {
  const options: React.ReactNode[] = []
  React.Children.forEach(children, child => {
    if (!React.isValidElement(child)) {
      return
    }
    if (child.type === SelectItem) {
      const { value, disabled, children: label } = child.props as SelectItemProps
      options.push(
        <option key={value} value={value} disabled={disabled}>
          {textOf(label)}
        </option>
      )
    } else if (child.type === SelectGroup) {
      const groupChildren = (child.props as { children?: React.ReactNode }).children
      let label = ""
      const items: React.ReactNode[] = []
      React.Children.forEach(groupChildren, part => {
        if (React.isValidElement(part) && part.type === SelectLabel) {
          label = textOf((part.props as { children?: React.ReactNode }).children)
        } else {
          items.push(part)
        }
      })
      options.push(
        <optgroup key={child.key ?? label} label={label}>
          {renderOptions(items)}
        </optgroup>
      )
    } else if (child.type === React.Fragment) {
      options.push(
        ...renderOptions((child.props as { children?: React.ReactNode }).children)
      )
    }
  })
  return options
}

/**
 * A styled native `<select>` behind the shadcn Select composition, matching `apps/admin`.
 * Keeps route first-load JavaScript within budget while preserving keyboard, screen reader,
 * form, and mobile picker behavior.
 */
function Select({
  value,
  defaultValue,
  onValueChange,
  name,
  form,
  disabled,
  required,
  children,
}: SelectProps) {
  let trigger: SelectTriggerProps = {}
  let placeholder: string | undefined
  let options: React.ReactNode[] = []

  React.Children.forEach(children, child => {
    if (!React.isValidElement(child)) {
      return
    }
    if (child.type === SelectTrigger) {
      const { children: triggerChildren, ...rest } =
        child.props as SelectTriggerProps
      trigger = rest
      React.Children.forEach(triggerChildren, part => {
        if (React.isValidElement(part) && part.type === SelectValue) {
          placeholder = (part.props as { placeholder?: string }).placeholder
        }
      })
    } else if (child.type === SelectContent) {
      options = renderOptions(
        (child.props as { children?: React.ReactNode }).children
      )
    }
  })

  const { className, variant, size = "default", ...triggerProps } = trigger
  const empty = (value ?? defaultValue ?? "") === ""

  return (
    <div data-slot="select" className={cn("relative w-fit", className)}>
      <select
        {...triggerProps}
        name={name}
        form={form}
        disabled={disabled}
        required={required}
        {...(value === undefined ? {} : { value })}
        {...(defaultValue === undefined ? {} : { defaultValue })}
        onChange={event => onValueChange?.(event.target.value)}
        data-slot="select-trigger"
        data-size={size}
        data-placeholder={empty && placeholder ? "" : undefined}
        className={cn(selectTriggerVariants({ variant }))}
      >
        {placeholder ? (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        ) : null}
        {options}
      </select>
      <ChevronDownIcon
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 opacity-50"
      />
    </div>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}

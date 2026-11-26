/**
 * @component Checkbox
 * @category UI
 * @status Stable
 * @description A control that allows the user to select one or more options from a set.
 * @usage Use in forms for boolean inputs or multiple choice selections.
 * @example
 * <Checkbox id="terms" />
 */
"use client"

import * as React from "react"
import { Check, Minus } from "lucide-react"

import { cn } from "@/utils"

type CheckedState = boolean | "indeterminate"

type CheckboxProps = Omit<
  React.ComponentProps<"button">,
  "type" | "role" | "onChange"
> & {
  checked?: CheckedState
  defaultChecked?: CheckedState
  onCheckedChange?: (checked: CheckedState) => void
  required?: boolean
  name?: string
  value?: string
}

function Checkbox({
  className,
  checked: controlledChecked,
  defaultChecked = false,
  onCheckedChange,
  disabled,
  required,
  name,
  value = "on",
  onClick,
  ...props
}: CheckboxProps) {
  const [uncontrolledChecked, setUncontrolledChecked] =
    React.useState<CheckedState>(defaultChecked)
  const isControlled = controlledChecked !== undefined
  const checked = isControlled ? controlledChecked : uncontrolledChecked
  const isIndeterminate = checked === "indeterminate"
  const isChecked = checked === true
  const dataState = isIndeterminate
    ? "indeterminate"
    : isChecked
      ? "checked"
      : "unchecked"

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = event => {
    onClick?.(event)
    if (event.defaultPrevented || disabled) {
      return
    }
    const next: CheckedState = isIndeterminate ? true : !isChecked
    if (!isControlled) {
      setUncontrolledChecked(next)
    }
    onCheckedChange?.(next)
  }

  return (
    <>
      <button
        type="button"
        role="checkbox"
        aria-checked={isIndeterminate ? "mixed" : isChecked}
        aria-required={required || undefined}
        data-slot="checkbox"
        data-state={dataState}
        data-checked={isChecked ? "" : undefined}
        data-indeterminate={isIndeterminate ? "" : undefined}
        data-disabled={disabled ? "" : undefined}
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          "peer h-4 w-4 shrink-0 rounded-sm border border-primary disabled:cursor-not-allowed disabled:opacity-50 data-checked:bg-primary data-checked:text-primary-foreground data-indeterminate:bg-primary data-indeterminate:text-primary-foreground focus-ring interactive",
          // A 20px box with a 44px hit area on touch, so rows and labels keep their layout.
          "relative pointer-coarse:size-5 pointer-coarse:after:absolute pointer-coarse:after:inset-[-13px] pointer-coarse:after:content-['']",
          className
        )}
        {...props}
      >
        {(isChecked || isIndeterminate) && (
          <span
            data-slot="checkbox-indicator"
            className="flex items-center justify-center text-current"
          >
            {isIndeterminate ? (
              <Minus className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Check className="h-4 w-4" aria-hidden="true" />
            )}
          </span>
        )}
      </button>
      {name ? (
        <input
          type="checkbox"
          name={name}
          value={value}
          checked={isChecked}
          required={required}
          disabled={disabled}
          aria-hidden="true"
          tabIndex={-1}
          readOnly
          className="sr-only"
        />
      ) : null}
    </>
  )
}

export { Checkbox }

/**
 * @component DropdownMenu
 * @category UI
 * @status Stable
 * @description Displays a list of options or actions to the user, triggered by a button or other element.
 * @usage Use for navigation menus, context menus, or filtering options.
 * @example
 * <DropdownMenu>
 *   <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
 *   <DropdownMenuContent>
 *     <DropdownMenuItem>Edit</DropdownMenuItem>
 *     <DropdownMenuItem>Delete</DropdownMenuItem>
 *   </DropdownMenuContent>
 * </DropdownMenu>
 */
"use client"

import * as React from "react"
import * as MenuPrimitive from "@ui-sdk/react/menu"
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"

import { cn } from "@/utils"
import { asChildProps } from "@/components/ui/slot"

type WithClassName<T> = Omit<T, "className" | "children"> & {
  className?: string
  children?: React.ReactNode
}

const DropdownMenu = MenuPrimitive.Menu
const DropdownMenuGroup = MenuPrimitive.MenuGroup
const DropdownMenuSub = MenuPrimitive.MenuSub
const DropdownMenuRadioGroup = MenuPrimitive.MenuRadioGroup

/** Menus render in the browser's top layer; no portal is needed. Kept for API compatibility. */
function DropdownMenuPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}

function DropdownMenuTrigger({
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.MenuTrigger> & {
  asChild?: boolean
}) {
  return (
    <MenuPrimitive.MenuTrigger
      data-slot="dropdown-menu-trigger"
      {...props}
      {...asChildProps(asChild, children as React.ReactNode)}
    />
  )
}

const popupSurface =
  "bg-popover/95 backdrop-blur-md text-popover-foreground z-50 m-0 min-w-32 overflow-x-hidden overflow-y-auto origin-(--transform-origin) rounded-md border border-border/60 p-1 shadow-premium transition-[opacity,scale] duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 motion-reduce:transition-none"

function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: WithClassName<React.ComponentProps<typeof MenuPrimitive.MenuContent>>) {
  return (
    <MenuPrimitive.MenuContent
      data-slot="dropdown-menu-content"
      sideOffset={sideOffset}
      className={cn(popupSurface, "max-h-(--available-height)", className)}
      {...props}
    />
  )
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  asChild,
  children,
  ...props
}: WithClassName<React.ComponentProps<typeof MenuPrimitive.MenuItem>> & {
  inset?: boolean
  variant?: "default" | "destructive"
  asChild?: boolean
}) {
  return (
    <MenuPrimitive.MenuItem
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden transition-colors",
        "focus:bg-accent focus:text-accent-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        "data-[variant=destructive]:text-error data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-error data-[variant=destructive]:data-highlighted:bg-destructive/10 dark:data-[variant=destructive]:data-highlighted:bg-destructive/20 data-[variant=destructive]:data-highlighted:text-error",
        "data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:opacity-50",
        "data-inset:pl-8",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "focus:[&_svg]:opacity-100 data-highlighted:[&_svg]:opacity-100 data-[variant=destructive]:[&_svg]:opacity-100 [&_svg]:opacity-60",
        className
      )}
      {...props}
      {...asChildProps(asChild, children as React.ReactNode)}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  onCheckedChange,
  ...props
}: Omit<
  WithClassName<React.ComponentProps<typeof MenuPrimitive.MenuCheckboxItem>>,
  "onCheckedChange"
> & {
  onCheckedChange?: (checked: boolean) => void
}) {
  return (
    <MenuPrimitive.MenuCheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex cursor-pointer items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden transition-colors",
        "data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "focus:[&_svg]:opacity-100 data-highlighted:[&_svg]:opacity-100 [&_svg]:opacity-60",
        className
      )}
      {...props}
      {...(onCheckedChange
        ? { onCheckedChange: (checked: boolean) => onCheckedChange(checked) }
        : {})}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <MenuPrimitive.MenuItemIndicator>
          <CheckIcon className="size-4" aria-hidden="true" />
        </MenuPrimitive.MenuItemIndicator>
      </span>
      {children}
    </MenuPrimitive.MenuCheckboxItem>
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: WithClassName<React.ComponentProps<typeof MenuPrimitive.MenuRadioItem>>) {
  return (
    <MenuPrimitive.MenuRadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden transition-colors",
        "focus:bg-accent focus:text-accent-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        "data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "focus:[&_svg]:opacity-100 data-highlighted:[&_svg]:opacity-100 [&_svg]:opacity-60",
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <MenuPrimitive.MenuItemIndicator>
          <CircleIcon className="size-2 fill-current" aria-hidden="true" />
        </MenuPrimitive.MenuItemIndicator>
      </span>
      {children}
    </MenuPrimitive.MenuRadioItem>
  )
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  inset?: boolean
}) {
  return (
    <div
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "px-2 py-1.5 text-sm font-medium text-foreground/80 data-inset:pl-8",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof MenuPrimitive.MenuSeparator>>) {
  return (
    <MenuPrimitive.MenuSeparator
      data-slot="dropdown-menu-separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  )
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "text-muted-foreground ml-auto text-xs tracking-widest",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: WithClassName<React.ComponentProps<typeof MenuPrimitive.MenuSubTrigger>> & {
  inset?: boolean
}) {
  return (
    <MenuPrimitive.MenuSubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-hidden transition-colors",
        "focus:bg-accent focus:text-accent-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground data-open:bg-accent data-open:text-accent-foreground",
        "data-inset:pl-8",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4" aria-hidden="true" />
    </MenuPrimitive.MenuSubTrigger>
  )
}

function DropdownMenuSubContent({
  className,
  sideOffset = 8,
  ...props
}: WithClassName<React.ComponentProps<typeof MenuPrimitive.MenuSubContent>>) {
  return (
    <MenuPrimitive.MenuSubContent
      data-slot="dropdown-menu-sub-content"
      sideOffset={sideOffset}
      className={cn(popupSurface, className)}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}

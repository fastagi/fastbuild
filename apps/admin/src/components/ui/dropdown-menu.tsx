import * as React from 'react';
import * as MenuPrimitive from '@ui-sdk/react/menu';
import { Check, ChevronRight, Circle } from 'lucide-react';

import { cn } from '@/lib/cn';
import { asChildProps } from '@/components/ui/slot';

type WithClassName<T> = Omit<T, 'className' | 'children'> & {
  className?: string;
  children?: React.ReactNode;
};

const DropdownMenu = MenuPrimitive.Menu;
const DropdownMenuGroup = MenuPrimitive.MenuGroup;
const DropdownMenuSub = MenuPrimitive.MenuSub;
const DropdownMenuRadioGroup = MenuPrimitive.MenuRadioGroup;

/** Menus render in the browser's top layer; no portal is needed. Kept for API compatibility. */
function DropdownMenuPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

function DropdownMenuTrigger({
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.MenuTrigger> & { asChild?: boolean }) {
  return (
    <MenuPrimitive.MenuTrigger {...props} {...asChildProps(asChild, children as React.ReactNode)} />
  );
}

const popupSurface =
  'z-50 m-0 min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md origin-(--transform-origin) transition-[opacity,scale] duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 motion-reduce:transition-none';

const itemBase =
  'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0';

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: WithClassName<React.ComponentProps<typeof MenuPrimitive.MenuSubTrigger>> & {
  inset?: boolean;
}) {
  return (
    <MenuPrimitive.MenuSubTrigger
      className={cn(itemBase, 'data-open:bg-accent', inset && 'pl-8', className)}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto" aria-hidden="true" />
    </MenuPrimitive.MenuSubTrigger>
  );
}

function DropdownMenuSubContent({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof MenuPrimitive.MenuSubContent>>) {
  return (
    <MenuPrimitive.MenuSubContent className={cn(popupSurface, 'shadow-lg', className)} {...props} />
  );
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: WithClassName<React.ComponentProps<typeof MenuPrimitive.MenuContent>>) {
  return (
    <MenuPrimitive.MenuContent
      sideOffset={sideOffset}
      className={cn(popupSurface, 'max-h-(--available-height)', className)}
      {...props}
    />
  );
}

function DropdownMenuItem({
  className,
  inset,
  asChild,
  children,
  ...props
}: WithClassName<React.ComponentProps<typeof MenuPrimitive.MenuItem>> & {
  inset?: boolean;
  asChild?: boolean;
}) {
  return (
    <MenuPrimitive.MenuItem
      className={cn(itemBase, inset && 'pl-8', className)}
      {...props}
      {...asChildProps(asChild, children as React.ReactNode)}
    />
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: WithClassName<React.ComponentProps<typeof MenuPrimitive.MenuCheckboxItem>>) {
  return (
    <MenuPrimitive.MenuCheckboxItem className={cn(itemBase, 'pl-8', className)} {...props}>
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <MenuPrimitive.MenuItemIndicator>
          <Check className="h-4 w-4" aria-hidden="true" />
        </MenuPrimitive.MenuItemIndicator>
      </span>
      {children}
    </MenuPrimitive.MenuCheckboxItem>
  );
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: WithClassName<React.ComponentProps<typeof MenuPrimitive.MenuRadioItem>>) {
  return (
    <MenuPrimitive.MenuRadioItem className={cn(itemBase, 'pl-8', className)} {...props}>
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <MenuPrimitive.MenuItemIndicator>
          <Circle className="h-2 w-2 fill-current" aria-hidden="true" />
        </MenuPrimitive.MenuItemIndicator>
      </span>
      {children}
    </MenuPrimitive.MenuRadioItem>
  );
}

/** A heading inside the menu that is not an item; it takes no focus. */
function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }) {
  return (
    <div
      className={cn('px-2 py-1.5 text-sm font-semibold', inset && 'pl-8', className)}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof MenuPrimitive.MenuSeparator>>) {
  return (
    <MenuPrimitive.MenuSeparator className={cn('-mx-1 my-1 h-px bg-muted', className)} {...props} />
  );
}

const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span className={cn('ml-auto text-xs tracking-widest opacity-60', className)} {...props} />
  );
};

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};

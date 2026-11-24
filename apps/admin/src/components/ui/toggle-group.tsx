import * as React from 'react';
import { Toggle, ToggleGroup as ToggleGroupPrimitive } from '@ui-sdk/react/toggle';
import { type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/cn';
import { toggleVariants } from '@/components/ui/toggle';

const ToggleGroupContext = React.createContext<VariantProps<typeof toggleVariants>>({
  size: 'default',
  variant: 'default',
});

type PrimitiveProps = Omit<
  React.ComponentProps<typeof ToggleGroupPrimitive>,
  'className' | 'children' | 'value' | 'defaultValue' | 'onValueChange' | 'multiple'
> & { children?: React.ReactNode };

type ToggleGroupProps = PrimitiveProps &
  VariantProps<typeof toggleVariants> & { className?: string } & (
    | {
        /** One pressed toggle at a time; it stays pressed until another is chosen. */
        type: 'single';
        value?: string;
        defaultValue?: string;
        onValueChange?: (value: string) => void;
      }
    | {
        type: 'multiple';
        value?: string[];
        defaultValue?: string[];
        onValueChange?: (value: string[]) => void;
      }
  );

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
    next === undefined ? undefined : Array.isArray(next) ? next : next ? [next] : [];
  return (
    <ToggleGroupPrimitive
      className={cn('flex items-center justify-center gap-1', className)}
      multiple={type === 'multiple'}
      deselectable={type === 'multiple'}
      {...(value === undefined ? {} : { value: toList(value) ?? [] })}
      {...(defaultValue === undefined ? {} : { defaultValue: toList(defaultValue) ?? [] })}
      onValueChange={(next: string[]) => {
        if (type === 'multiple') {
          (onValueChange as ((value: string[]) => void) | undefined)?.(next);
        } else {
          (onValueChange as ((value: string) => void) | undefined)?.(next[0] ?? '');
        }
      }}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  );
}

type ToggleGroupItemProps = Omit<React.ComponentProps<typeof Toggle>, 'className'> &
  VariantProps<typeof toggleVariants> & { className?: string; value: string };

function ToggleGroupItem({ className, variant, size, ...props }: ToggleGroupItemProps) {
  const context = React.useContext(ToggleGroupContext);
  return (
    <Toggle
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        className,
      )}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/cn';

// A disabled button recedes. A loading one is disabled too but keeps its color, because it is busy
// doing what the operator just asked for.
const mutedFill =
  'disabled:not-data-loading:bg-muted disabled:not-data-loading:text-muted-foreground';
const mutedText = 'disabled:not-data-loading:text-muted-foreground';

const buttonVariants = cva(
  'inline-flex flex-row! flex-nowrap! items-center justify-center gap-2 whitespace-nowrap! rounded-md text-sm font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:scale-[0.97] disabled:pointer-events-none disabled:shadow-none disabled:active:scale-100 data-loading:[&>svg:not([data-button-spinner])]:hidden [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: `bg-primary text-primary-foreground shadow hover:bg-primary/90 ${mutedFill}`,
        destructive: `bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 ${mutedFill}`,
        outline: `border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground ${mutedText}`,
        secondary: `bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 ${mutedFill}`,
        ghost: `hover:bg-accent hover:text-accent-foreground ${mutedText}`,
        link: `text-primary underline-offset-4 hover:underline ${mutedText}`,
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Disables the button and swaps its leading icon for a spinner; asChild shows no spinner. */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading = false, disabled, children, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        data-loading={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading ? (
              <Loader2 data-button-spinner="" aria-hidden="true" className="animate-spin" />
            ) : null}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };

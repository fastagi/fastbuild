import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn.ts';

const mutedFill =
  'disabled:not-data-loading:bg-muted disabled:not-data-loading:text-muted-foreground';
const mutedText = 'disabled:not-data-loading:text-muted-foreground';

export const buttonVariants = cva(
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
  readonly loading?: boolean;
  readonly ref?: React.Ref<HTMLButtonElement>;
}

export function Button({
  className,
  variant,
  size,
  loading = false,
  disabled,
  type = 'button',
  children,
  ref,
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      {...props}
    >
      {loading ? (
        <svg
          data-button-spinner=""
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-spin"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ) : null}
      {children}
    </button>
  );
}

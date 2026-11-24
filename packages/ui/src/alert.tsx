import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn.ts';

export const alertVariants = cva(
  'relative w-full rounded-lg border px-3.5 py-2.5 text-sm [&>svg+div]:translate-y-[-2px] [&>svg]:absolute [&>svg]:left-3.5 [&>svg]:top-3 [&>svg]:size-4 [&>svg~*]:pl-6',
  {
    variants: {
      variant: {
        default: 'border-border bg-card text-card-foreground [&>svg]:text-foreground',
        info: 'border-info/30 bg-info-subtle text-foreground [&>svg]:text-info',
        success:
          'border-success/30 bg-success-subtle text-success-strong [&>svg]:text-success-strong',
        warning:
          'border-warning/35 bg-warning-subtle text-warning-strong [&>svg]:text-warning-strong',
        destructive:
          'border-danger/30 bg-danger-subtle text-danger-strong [&>svg]:text-danger-strong',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  readonly ref?: React.Ref<HTMLDivElement>;
}

/** Semantic callout banner for feedback, warnings, and errors. */
export function Alert({ className, variant, role = 'alert', ref, ...props }: AlertProps) {
  return (
    <div
      ref={ref}
      role={role}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

export interface AlertTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  readonly ref?: React.Ref<HTMLHeadingElement>;
}

export function AlertTitle({ className, ref, ...props }: AlertTitleProps) {
  return (
    <h5
      ref={ref}
      className={cn('font-medium leading-snug tracking-tight', className)}
      {...props}
    />
  );
}

export interface AlertDescriptionProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly ref?: React.Ref<HTMLDivElement>;
}

export function AlertDescription({ className, ref, ...props }: AlertDescriptionProps) {
  return (
    <div
      ref={ref}
      className={cn('mt-0.5 text-xs leading-relaxed opacity-90 [&_p]:leading-relaxed', className)}
      {...props}
    />
  );
}

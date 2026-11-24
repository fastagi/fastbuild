import * as React from 'react';
import { cn } from './cn.ts';

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  readonly containerClassName?: string;
  readonly ref?: React.Ref<HTMLTableElement>;
}

/** Data table with crisp hairline borders and tabular numerals. */
export function Table({ className, containerClassName, ref, ...props }: TableProps) {
  return (
    <div className={cn('relative w-full overflow-auto rounded-lg border border-border', containerClassName)}>
      <table
        ref={ref}
        className={cn('w-full caption-bottom text-sm tabular-nums', className)}
        {...props}
      />
    </div>
  );
}

export interface TableSectionProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  readonly ref?: React.Ref<HTMLTableSectionElement>;
}

export function TableHeader({ className, ref, ...props }: TableSectionProps) {
  return (
    <thead
      ref={ref}
      className={cn('bg-muted/40 [&_tr]:border-b [&_tr]:border-border [&_tr]:hover:bg-transparent', className)}
      {...props}
    />
  );
}

export function TableBody({ className, ref, ...props }: TableSectionProps) {
  return <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

export function TableFooter({ className, ref, ...props }: TableSectionProps) {
  return (
    <tfoot
      ref={ref}
      className={cn(
        'border-t border-border bg-muted/50 font-medium [&>tr]:last:border-b-0',
        className,
      )}
      {...props}
    />
  );
}

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  readonly ref?: React.Ref<HTMLTableRowElement>;
}

export function TableRow({ className, ref, ...props }: TableRowProps) {
  return (
    <tr
      ref={ref}
      className={cn(
        'border-b border-border transition-colors hover:bg-muted/40 data-[state=selected]:bg-muted',
        className,
      )}
      {...props}
    />
  );
}

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  readonly ref?: React.Ref<HTMLTableCellElement>;
}

export function TableHead({ className, ref, ...props }: TableHeadProps) {
  return (
    <th
      ref={ref}
      className={cn(
        'h-9 whitespace-nowrap px-4 text-left align-middle text-xs font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  );
}

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  readonly ref?: React.Ref<HTMLTableCellElement>;
}

export function TableCell({ className, ref, ...props }: TableCellProps) {
  return (
    <td
      ref={ref}
      className={cn('px-4 py-2.5 align-middle text-foreground [&:has([role=checkbox])]:pr-0', className)}
      {...props}
    />
  );
}

export interface TableCaptionProps extends React.HTMLAttributes<HTMLTableCaptionElement> {
  readonly ref?: React.Ref<HTMLTableCaptionElement>;
}

export function TableCaption({ className, ref, ...props }: TableCaptionProps) {
  return (
    <caption ref={ref} className={cn('mt-3 text-xs text-muted-foreground', className)} {...props} />
  );
}

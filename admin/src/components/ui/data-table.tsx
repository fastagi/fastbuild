import type { Key, ReactNode } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/cn';

export interface DataTableColumn<Row> {
  id: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  /** `end` right-aligns the header and cell, as for an actions column. */
  align?: 'start' | 'end';
  /** Extra cell classes, such as `whitespace-nowrap` or `tabular-nums`. */
  className?: string;
}

interface DataTableProps<Row> {
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[] | undefined;
  rowKey: (row: Row) => Key;
  /** The query status; a placeholder page kept during refetch counts as `success`. */
  status: 'pending' | 'error' | 'success';
  errorMessage: ReactNode;
  emptyMessage: ReactNode;
  /** Minimum table width class so narrow screens scroll instead of squeezing columns. */
  minWidthClassName?: string;
  /** Top-align rows whose cells hold several lines. */
  alignTop?: boolean;
  skeletonRows?: number;
}

/** The loading, error, empty, or populated state of one list, built on the shadcn Table. */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  status,
  errorMessage,
  emptyMessage,
  minWidthClassName = 'min-w-[640px]',
  alignTop = false,
  skeletonRows = 4,
}: DataTableProps<Row>) {
  if (status === 'pending') {
    return (
      <div className="flex flex-col gap-2 p-4" aria-busy="true">
        {Array.from({ length: skeletonRows }, (_, index) => (
          <Skeleton key={index} className="h-9 w-full" />
        ))}
      </div>
    );
  }
  if (status === 'error') {
    return (
      <p role="alert" className="p-4 text-sm text-destructive">
        {errorMessage}
      </p>
    );
  }
  if (!rows || rows.length === 0) {
    return <EmptyState>{emptyMessage}</EmptyState>;
  }
  return (
    <Table className={minWidthClassName}>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead
              key={column.id}
              scope="col"
              className={cn(column.align === 'end' && 'text-right')}
            >
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={rowKey(row)} className={cn(alignTop && 'align-top')}>
            {columns.map((column) => (
              <TableCell
                key={column.id}
                className={cn(
                  column.align === 'end' && 'text-right',
                  alignTop && 'align-top',
                  column.className,
                )}
              >
                {column.cell(row)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

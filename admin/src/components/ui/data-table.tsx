import type { Key, ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
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

/** Panel body that renders the loading, error, empty, or populated state of one list. */
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
  return (
    <div className="panel-body overflow-x-auto p-0">
      {status === 'pending' ? (
        <div className="flex flex-col gap-2 p-4" aria-busy="true">
          {Array.from({ length: skeletonRows }, (_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>
      ) : status === 'error' ? (
        <p role="alert" className="p-4 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : !rows || rows.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <table className={cn('w-full text-sm', minWidthClassName)}>
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className={cn('px-4 py-2 font-medium', column.align === 'end' && 'text-right')}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className={cn('border-b last:border-0', alignTop && 'align-top')}
              >
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={cn(
                      'px-4 py-2',
                      column.align === 'end' && 'text-right',
                      column.className,
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/**
 * @component ResponsiveTable
 * @category Common
 * @status Stable
 * @description A data table that stacks each row into a labelled card below `md`, with its actions always visible.
 * @usage Use for lists that would otherwise scroll sideways on a phone. There is one DOM tree for both
 * layouts, so stateful cells are never mounted twice, and explicit ARIA roles keep the table semantics
 * that `display: block` removes.
 * @example
 * <ResponsiveTable
 *   rows={keys}
 *   getRowKey={key => key.id}
 *   columns={[
 *     { key: 'name', header: 'Name', primary: true, cell: key => key.name },
 *     { key: 'created', header: 'Created', cell: key => formatDate(key.createdAt) },
 *   ]}
 *   actions={{ label: 'Actions', cell: key => <RevokeButton keyId={key.id} /> }}
 *   empty={<EmptyState title="No API keys" />}
 * />
 */
import type { Key, ReactNode } from 'react';

import { Table, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/utils';

export interface ResponsiveTableColumn<Row> {
  key: string;
  /** The column heading, and the label beside the value on a phone. */
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  /** Shows the value as the card's title on a phone, without a label. */
  primary?: boolean;
  className?: string;
}

interface ResponsiveTableProps<Row> {
  columns: ResponsiveTableColumn<Row>[];
  rows: readonly Row[];
  getRowKey: (row: Row) => Key;
  /** Controls for one row. `label` names the column for assistive technology. */
  actions?: {
    label: ReactNode;
    cell: (row: Row) => ReactNode;
  };
  caption?: ReactNode;
  /** Replaces the table when there are no rows. */
  empty?: ReactNode;
  className?: string;
}

export function ResponsiveTable<Row>({
  columns,
  rows,
  getRowKey,
  actions,
  caption,
  empty,
  className,
}: ResponsiveTableProps<Row>) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div
      data-slot="responsive-table"
      className={cn('md:overflow-hidden md:rounded-md md:border md:bg-background', className)}
    >
      <Table role="table" className="max-md:block">
        {caption ? <TableCaption className="max-md:block">{caption}</TableCaption> : null}
        <TableHeader role="rowgroup" className="max-md:sr-only">
          <TableRow role="row">
            {columns.map(column => (
              <TableHead key={column.key} role="columnheader" scope="col" className={column.className}>
                {column.header}
              </TableHead>
            ))}
            {actions ? (
              <TableHead role="columnheader" scope="col" className="text-right">
                {actions.label}
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <tbody
          data-slot="table-body"
          role="rowgroup"
          className="max-md:block max-md:space-y-3 md:[&_tr:last-child]:border-0"
        >
          {rows.map(row => (
            <TableRow
              key={getRowKey(row)}
              role="row"
              className="max-md:block max-md:rounded-lg max-md:border max-md:bg-card max-md:p-4 max-md:hover:bg-card"
            >
              {columns.map(column => (
                <TableCell
                  key={column.key}
                  role="cell"
                  className={cn(
                    'max-md:px-0 max-md:py-1 max-md:whitespace-normal',
                    column.primary
                      ? 'max-md:block max-md:pb-2 max-md:text-base max-md:font-medium'
                      : 'max-md:flex max-md:items-start max-md:justify-between max-md:gap-4',
                    column.className
                  )}
                >
                  {column.primary ? null : (
                    <span aria-hidden="true" className="shrink-0 text-muted-foreground md:hidden">
                      {column.header}
                    </span>
                  )}
                  <div className={cn('min-w-0 wrap-anywhere', !column.primary && 'max-md:text-right')}>
                    {column.cell(row)}
                  </div>
                </TableCell>
              ))}
              {actions ? (
                <TableCell
                  role="cell"
                  className="max-md:mt-2 max-md:block max-md:border-t max-md:px-0 max-md:pt-3 max-md:pb-0"
                >
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {actions.cell(row)}
                  </div>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

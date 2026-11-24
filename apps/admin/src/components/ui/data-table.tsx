import { Fragment, type Key, type MouseEvent, type ReactNode } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { QueryError } from '@/components/ui/query-error';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useBelowSm } from '@/hooks/use-below-sm';
import { cn } from '@/lib/cn';

export interface DataTableColumn<Row> {
  id: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  /**
   * Where the column goes in the stacked card a row becomes below `sm`: `primary` opens the card,
   * `status` sits beside it, `meta` is a labelled value, and `actions` closes the card.
   * A column without a role is `meta`.
   */
  role?: 'primary' | 'status' | 'meta' | 'actions';
  /** Give a `meta` value the full card width, for long values such as a URL. */
  cardWide?: boolean;
  /** `end` right-aligns the header and cell, as for an actions column. */
  align?: 'start' | 'end';
  /** Extra cell classes, such as `whitespace-nowrap` or `tabular-nums`. */
  className?: string;
  /** Extra header classes, such as a fixed width for an icon column. */
  headerClassName?: string;
}

export interface DataTableDetails<Row> {
  /** Element id of the detail row, for the toggle's `aria-controls`. */
  id: (row: Row) => string;
  /** Full-width content under the row, or `null` while the row is collapsed. */
  render: (row: Row) => ReactNode;
}

interface DataTableProps<Row> {
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[] | undefined;
  rowKey: (row: Row) => Key;
  /** The query status; a placeholder page kept during refetch counts as `success`. */
  status: 'pending' | 'error' | 'success';
  errorMessage: ReactNode;
  /** The failure, whose request ID is shown for diagnostics. */
  error?: unknown;
  /** Offers a retry next to the error. */
  onRetry?: (() => void) | undefined;
  /** The retry is in flight. */
  retrying?: boolean | undefined;
  emptyMessage: ReactNode;
  /** A way out of the empty state, such as clearing the filters. */
  emptyAction?: ReactNode;
  /** Minimum table width class so narrow screens scroll instead of squeezing columns. */
  minWidthClassName?: string;
  /** Top-align rows whose cells hold several lines. */
  alignTop?: boolean;
  skeletonRows?: number;
  /** Expandable detail rows; an expanded row is marked selected. */
  details?: DataTableDetails<Row>;
  /**
   * Keep the header in view in a long list. The table scrolls inside a region as tall as the
   * viewport, because the horizontal scroller and the console shell would otherwise clip it.
   */
  stickyHeader?: boolean;
  /** Clicking a row runs its main action. Keep a button for it too: a row is not focusable. */
  onRowClick?: (row: Row) => void;
}

/** A click on the row itself, not on a control inside it, a portal, or a text selection. */
function isRowClick(event: MouseEvent<HTMLElement>) {
  const target = event.target as Element;
  return (
    event.currentTarget.contains(target) &&
    target.closest('a, button, input, select, textarea, label') === null &&
    !window.getSelection()?.toString()
  );
}

/** The loading, error, empty, or populated state of one list: a table, or cards on a phone. */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  status,
  errorMessage,
  error,
  onRetry,
  retrying,
  emptyMessage,
  emptyAction,
  minWidthClassName = 'min-w-[640px]',
  alignTop = false,
  skeletonRows = 4,
  details,
  stickyHeader = false,
  onRowClick,
}: DataTableProps<Row>) {
  const stacked = useBelowSm();

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
      <QueryError message={errorMessage} error={error} onRetry={onRetry} retrying={retrying} />
    );
  }
  if (!rows || rows.length === 0) {
    return (
      <EmptyState>
        <span className="flex flex-col items-center gap-3">
          <span>{emptyMessage}</span>
          {emptyAction}
        </span>
      </EmptyState>
    );
  }
  if (stacked) {
    return (
      <DataTableCards
        columns={columns}
        rows={rows}
        rowKey={rowKey}
        details={details}
        onRowClick={onRowClick}
      />
    );
  }
  return (
    <Table
      className={minWidthClassName}
      containerClassName={cn(stickyHeader && 'max-h-[calc(100dvh-8rem)]')}
    >
      <TableHeader
        className={cn(
          stickyHeader &&
            'sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_var(--border)] [&_tr]:border-b-0',
        )}
      >
        <TableRow>
          {columns.map((column) => (
            <TableHead
              key={column.id}
              scope="col"
              className={cn(column.align === 'end' && 'text-right', column.headerClassName)}
            >
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const detail = details?.render(row) ?? null;
          return (
            <Fragment key={rowKey(row)}>
              <TableRow
                className={cn(alignTop && 'align-top', onRowClick && 'cursor-pointer')}
                data-state={detail === null ? undefined : 'selected'}
                onClick={
                  onRowClick
                    ? (event) => {
                        if (isRowClick(event)) onRowClick(row);
                      }
                    : undefined
                }
              >
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
              {details && detail !== null ? (
                <TableRow id={details.id(row)} className="bg-muted/30 hover:bg-muted/30">
                  <TableCell colSpan={columns.length} className="px-4 py-3">
                    {detail}
                  </TableCell>
                </TableRow>
              ) : null}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}

interface DataTableCardsProps<Row> {
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => Key;
  details: DataTableDetails<Row> | undefined;
  onRowClick: ((row: Row) => void) | undefined;
}

/** One stacked card per row, so nothing that matters sits past the edge of a phone. */
function DataTableCards<Row>({
  columns,
  rows,
  rowKey,
  details,
  onRowClick,
}: DataTableCardsProps<Row>) {
  const withRole = (role: DataTableColumn<Row>['role']) =>
    columns.filter((column) => (column.role ?? 'meta') === role);
  const primary = withRole('primary');
  const status = withRole('status');
  const meta = withRole('meta');
  const actions = withRole('actions');

  return (
    <ul data-slot="data-table-cards" className="divide-y">
      {rows.map((row) => {
        const detail = details?.render(row) ?? null;
        return (
          // A pointer shortcut only: `onRowClick` requires a focusable control for the same action.
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
          <li
            key={rowKey(row)}
            data-state={detail === null ? undefined : 'selected'}
            className={cn(
              'flex flex-col gap-2.5 px-4 py-3 text-sm data-[state=selected]:bg-muted/40',
              onRowClick && 'cursor-pointer',
            )}
            onClick={
              onRowClick
                ? (event) => {
                    if (isRowClick(event)) onRowClick(row);
                  }
                : undefined
            }
          >
            {primary.length + status.length > 0 ? (
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0 [overflow-wrap:anywhere]">
                  {primary.map((column) => (
                    <Fragment key={column.id}>{column.cell(row)}</Fragment>
                  ))}
                </div>
                {status.length > 0 ? (
                  <div className="flex max-w-40 flex-col items-end gap-1 text-right">
                    {status.map((column) => (
                      <Fragment key={column.id}>{column.cell(row)}</Fragment>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {meta.length > 0 ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                {meta.map((column) => (
                  <div key={column.id} className={cn('min-w-0', column.cardWide && 'col-span-2')}>
                    <dt className="text-xs text-muted-foreground">{column.header}</dt>
                    <dd className="m-0 [overflow-wrap:anywhere]">{column.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {actions.length > 0 ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {actions.map((column) => (
                  <Fragment key={column.id}>{column.cell(row)}</Fragment>
                ))}
              </div>
            ) : null}
            {details && detail !== null ? (
              <div id={details.id(row)} className="min-w-0 border-t pt-2.5">
                {detail}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { PagePagination } from '@/components/ui/pagination';

interface Row {
  id: number;
  name: string;
}

const columns: DataTableColumn<Row>[] = [
  { id: 'name', header: 'Name', cell: (row) => row.name },
  { id: 'actions', header: 'Actions', align: 'end', cell: (row) => `#${row.id}` },
];

function renderTable(status: 'pending' | 'error' | 'success', rows?: Row[]) {
  return render(
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      status={status}
      errorMessage="Unavailable"
      emptyMessage="Nothing here"
    />,
  );
}

describe('DataTable', () => {
  it('shows a busy skeleton while pending', () => {
    const { container } = renderTable('pending');
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('announces the error message', () => {
    renderTable('error');
    expect(screen.getByRole('alert')).toHaveTextContent('Unavailable');
  });

  it('shows the empty message for an empty page', () => {
    renderTable('success', []);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('renders one row per item with aligned columns', () => {
    renderTable('success', [
      { id: 1, name: 'Ada' },
      { id: 2, name: 'Linus' },
    ]);
    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Actions' })).toHaveClass('text-right');
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(within(rows[2]!).getByText('#2')).toHaveClass('text-right');
  });
});

describe('PagePagination', () => {
  it('renders nothing for a single page', () => {
    const { container } = render(
      <PagePagination
        meta={{ current_page: 1, last_page: 1, per_page: 20, total: 3 }}
        label="Pages"
        onPageChange={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('moves between pages within bounds', () => {
    const onPageChange = vi.fn();
    render(
      <PagePagination
        meta={{ current_page: 1, last_page: 3, per_page: 20, total: 50 }}
        label="Pages"
        onPageChange={onPageChange}
      />,
    );
    expect(screen.getByRole('navigation', { name: 'Pages' })).toHaveTextContent('Page 1 of 3');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});

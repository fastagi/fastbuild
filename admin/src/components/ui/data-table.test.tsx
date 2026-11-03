import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { FilterPanel } from '@/components/ui/filter-panel';
import { PagePagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { ApiError } from '@/http/client';

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

function stubPhone() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
}

describe('DataTable states', () => {
  it('offers a retry and shows the request ID of a failure', () => {
    const onRetry = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={undefined}
        rowKey={(row) => row.id}
        status="error"
        errorMessage="Unavailable"
        error={new ApiError('failed', 'COMMON.INTERNAL_ERROR', { requestId: 'req-9' })}
        onRetry={onRetry}
        emptyMessage="Nothing here"
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Request ID: req-9');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('runs the row action for a click on the row, not on a control inside it', () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={[
          { id: 'name', header: 'Name', cell: (row: Row) => row.name },
          {
            id: 'actions',
            header: 'Actions',
            cell: () => <button type="button">Control</button>,
          },
        ]}
        rows={[{ id: 1, name: 'Ada' }]}
        rowKey={(row) => row.id}
        status="success"
        errorMessage="Unavailable"
        emptyMessage="Nothing here"
        onRowClick={onRowClick}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Control' }));
    expect(onRowClick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Ada'));
    expect(onRowClick).toHaveBeenCalledWith({ id: 1, name: 'Ada' });
  });
});

describe('DataTable below sm', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('stacks each row into a card, labelling only the metadata', () => {
    stubPhone();
    render(
      <DataTable
        columns={[
          { id: 'name', header: 'Name', role: 'primary', cell: (row: Row) => row.name },
          { id: 'state', header: 'State', role: 'status', cell: () => 'Active' },
          { id: 'joined', header: 'Joined', cell: () => 'Today' },
          { id: 'actions', header: 'Actions', role: 'actions', cell: () => <button>Open</button> },
        ]}
        rows={[{ id: 1, name: 'Ada' }]}
        rowKey={(row) => row.id}
        status="success"
        errorMessage="Unavailable"
        emptyMessage="Nothing here"
      />,
    );
    expect(screen.queryByRole('table')).toBeNull();
    const card = screen.getByRole('listitem');
    expect(within(card).getByText('Ada')).toBeInTheDocument();
    expect(within(card).getByText('Active')).toBeInTheDocument();
    expect(within(card).getByRole('term')).toHaveTextContent('Joined');
    expect(within(card).getByRole('definition')).toHaveTextContent('Today');
    expect(within(card).getByRole('button', { name: 'Open' })).toBeInTheDocument();
    expect(within(card).queryByText('Name')).toBeNull();
    expect(within(card).queryByText('Actions')).toBeNull();
  });
});

describe('FilterPanel', () => {
  afterEach(() => vi.unstubAllGlobals());

  const chips = [{ id: 'action', label: 'Action', value: 'store' }];

  function renderPanel() {
    render(
      <FilterPanel chips={chips} onRemove={vi.fn()} onClear={vi.fn()}>
        <form role="search" onSubmit={(event) => event.preventDefault()}>
          <label htmlFor="field">Field</label>
          <input id="field" />
        </form>
      </FilterPanel>,
    );
  }

  it('shows the form with no toggle on a wide screen', () => {
    renderPanel();
    expect(screen.queryByRole('button', { name: /^Filters/ })).toBeNull();
    expect(screen.getByRole('search')).toBeVisible();
  });

  it('collapses behind a counted toggle on a phone, keeps chips, and closes on submit', () => {
    stubPhone();
    renderPanel();
    const toggle = screen.getByRole('button', { name: 'Filters (1)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('search')).toBeNull();
    expect(screen.getByRole('list', { name: 'Active filters' })).toHaveTextContent('store');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.submit(screen.getByRole('search'));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('StatusBadge', () => {
  it('drops the dot and the tone for metadata', () => {
    render(
      <StatusBadge variant="metadata" tone="success">
        Owner
      </StatusBadge>,
    );
    const badge = screen.getByText('Owner');
    expect(badge).not.toHaveClass('bg-success-subtle');
    expect(badge.querySelector('span')).toBeNull();
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

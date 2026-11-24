import { act, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EmptyState, getUserInitials, PageContainer, PageHeader, ResponsiveTable } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

describe('getUserInitials', () => {
  it.each([
    ['Ada Lovelace', 'ada@example.com', 'AL'],
    ['  Ada   King  Lovelace ', null, 'AK'],
    ['ada', null, 'A'],
    ['王小明', null, '王'],
    ['', 'ada@example.com', 'A'],
    [null, null, ''],
  ])('%s / %s gives "%s"', (name, email, expected) => {
    expect(getUserInitials(name, email)).toBe(expected);
  });
});

describe('page primitives', () => {
  it('owns the h1 and renders optional parts only when given', () => {
    const { rerender } = render(<PageHeader title="Assets" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Assets' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(<PageHeader title="Assets" description="Files" actions={<button>Upload</button>} />);
    expect(screen.getByText('Files')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument();
  });

  it('sizes the container', () => {
    const { container, rerender } = render(<PageContainer>x</PageContainer>);
    expect(container.firstChild).toHaveClass('max-w-6xl');
    rerender(<PageContainer size="narrow">x</PageContainer>);
    expect(container.firstChild).toHaveClass('max-w-4xl');
  });

  it('renders an empty state with its optional action', () => {
    render(
      <EmptyState
        title="No organizations yet"
        description="Create one."
        icon={<svg data-testid="icon" />}
        action={<button>Create</button>}
      />
    );
    expect(screen.getByRole('heading', { level: 2, name: 'No organizations yet' })).toBeInTheDocument();
    expect(screen.getByText('Create one.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
    expect(screen.getByTestId('icon').parentElement).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('ResponsiveTable', () => {
  const rows = [
    { id: 'a', name: 'First', scope: 'read' },
    { id: 'b', name: 'Second', scope: 'write' },
  ];
  const columns = [
    { key: 'name', header: 'Name', primary: true, cell: (row: (typeof rows)[number]) => row.name },
    { key: 'scope', header: 'Scope', cell: (row: (typeof rows)[number]) => row.scope },
  ];

  it('keeps table semantics, one tree, and a per-row action in both layouts', () => {
    render(
      <ResponsiveTable
        rows={rows}
        columns={columns}
        getRowKey={row => row.id}
        actions={{ label: 'Actions', cell: row => <button>Revoke {row.name}</button> }}
      />
    );

    expect(screen.getByRole('table')).toHaveClass('max-md:block');
    expect(screen.getAllByRole('columnheader').map(h => h.textContent)).toEqual([
      'Name',
      'Scope',
      'Actions',
    ]);
    const row = screen.getByRole('row', { name: /First/ });
    expect(row).toHaveClass('max-md:block');
    // Actions are never behind hover, and each value is mounted once.
    expect(within(row).getByRole('button', { name: 'Revoke First' }).closest('td')).not.toHaveClass(
      'hidden'
    );
    expect(screen.getAllByText('First')).toHaveLength(1);
  });

  it('labels values for the card layout without repeating the label to assistive technology', () => {
    render(<ResponsiveTable rows={rows} columns={columns} getRowKey={row => row.id} />);

    const cell = screen.getByRole('cell', { name: 'read' });
    expect(within(cell).getByText('Scope')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('cell', { name: 'First' }).querySelector('[aria-hidden]')).toBeNull();
  });

  it('renders the empty slot instead of an empty table', () => {
    render(
      <ResponsiveTable
        rows={[]}
        columns={columns}
        getRowKey={(row: (typeof rows)[number]) => row.id}
        empty={<EmptyState title="Nothing here" />}
      />
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});

describe('touch targets', () => {
  it('raises small and icon buttons on coarse pointers only', () => {
    render(
      <>
        <Button size="sm">Small</Button>
        <Button isIcon className="h-9 w-9" aria-label="Icon" />
      </>
    );

    const small = screen.getByRole('button', { name: 'Small' });
    expect(small).toHaveClass('h-8', 'pointer-coarse:h-10');
    const icon = screen.getByRole('button', { name: 'Icon' });
    expect(icon).toHaveClass('h-9', 'w-9', 'pointer-coarse:size-10');
  });

  it('extends the checkbox hit area without moving its layout on desktop', () => {
    render(<Checkbox aria-label="Accept" />);
    expect(screen.getByRole('checkbox')).toHaveClass(
      'h-4',
      'w-4',
      'pointer-coarse:size-5',
      'pointer-coarse:after:inset-[-13px]'
    );
  });
});

describe('TabsList overflow', () => {
  function layout(element: HTMLElement, box: { left: number; right: number }) {
    element.getBoundingClientRect = () => ({ ...box, width: box.right - box.left }) as DOMRect;
  }

  function renderTabs(value: string) {
    return (
      <Tabs value={value}>
        <TabsList>
          <TabsTrigger value="first">First</TabsTrigger>
          <TabsTrigger value="last">Last</TabsTrigger>
        </TabsList>
      </Tabs>
    );
  }

  it('does not clip the leading tabs of an overflowing strip', () => {
    render(renderTabs('first'));
    const list = screen.getByRole('tablist');

    expect(list).toHaveClass('justify-start', 'overflow-x-auto', 'max-w-full');
    expect(list).not.toHaveClass('justify-center');
  });

  it('marks the edges that have more tabs and scrolls the list to a newly active tab', async () => {
    const { rerender } = render(renderTabs('first'));
    const list = screen.getByRole('tablist');
    const scrollTo = vi.fn();
    list.scrollTo = scrollTo;
    Object.defineProperty(list, 'clientWidth', { configurable: true, value: 300 });
    Object.defineProperty(list, 'scrollWidth', { configurable: true, value: 800 });
    layout(list, { left: 0, right: 300 });
    layout(screen.getByRole('tab', { name: 'Last' }), { left: 700, right: 800 });

    // Only the list moves: scrollIntoView would also scroll the page.
    await act(async () => {
      rerender(renderTabs('last'));
      await Promise.resolve();
    });

    expect(list).toHaveAttribute('data-overflow-end');
    expect(list).not.toHaveAttribute('data-overflow-start');
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 532 }));
  });
});

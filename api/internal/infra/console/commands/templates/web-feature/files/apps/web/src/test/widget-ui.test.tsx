import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WidgetWorkspace } from '@/features/widget/components/widget-workspace';
import { ApiErrorCode } from '@/http/codes';
import { ApiError } from '@/http/request';
import { messages } from '@/i18n/modules';

const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  params: new URLSearchParams(),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const state = vi.hoisted(() => ({
  role: 'owner' as string,
  widgets: {
    data: undefined as unknown,
    isPending: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
  create: { isPending: false, error: null as unknown, mutateAsync: vi.fn() },
  update: { isPending: false, error: null as unknown, mutateAsync: vi.fn() },
  remove: { isPending: false, error: null as unknown, mutateAsync: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/console/widgets',
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => navigation.params,
}));
vi.mock('sonner', () => ({ toast }));
vi.mock('@/features/organization/hooks/use-organizations', () => ({
  useOrganizations: () => ({
    data: {
      items: [
        { id: 1, name: 'Acme' },
        { id: 2, name: 'Globex' },
      ],
    },
    isPending: false,
    error: null,
    refetch: vi.fn(),
  }),
  useOrganizationContext: () => ({ data: { role: state.role } }),
}));
vi.mock('@/features/widget/hooks/use-widgets', () => ({
  useWidgets: () => state.widgets,
  useCreateWidget: () => state.create,
  useUpdateWidget: () => state.update,
  useDeleteWidget: () => state.remove,
}));

describe('widget workspace', () => {
  beforeEach(() => {
    navigation.replace.mockReset();
    navigation.params = new URLSearchParams();
    toast.success.mockReset();
    toast.error.mockReset();
    state.role = 'owner';
    state.widgets.data = page([widget(2, 'Second'), widget(1, 'First')], 1, 2);
    state.widgets.error = null;
    for (const mutation of [state.create, state.update, state.remove]) {
      mutation.isPending = false;
      mutation.error = null;
      mutation.mutateAsync.mockReset();
    }
  });

  it('lists a page and moves to the next one through the URL', () => {
    renderWithMessages(<WidgetWorkspace />);

    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(navigation.replace).toHaveBeenCalledWith('/console/widgets?organization=1&page=2', {
      scroll: false,
    });
  });

  it('hides write controls from members', () => {
    state.role = 'member';
    renderWithMessages(<WidgetWorkspace />);

    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New widget' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rename' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('creates a widget with a trimmed name and returns to the first page', async () => {
    state.create.mutateAsync.mockResolvedValue(widget(3, 'Third'));
    renderWithMessages(<WidgetWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: 'New widget' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: '  Third  ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'New widget' }));

    await waitFor(() => expect(state.create.mutateAsync).toHaveBeenCalledWith({ name: 'Third' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Widget created.'));
    expect(navigation.replace).toHaveBeenCalledWith('/console/widgets?organization=1', {
      scroll: false,
    });
  });

  it('shows localized copy for a rejected rename, never the backend message', async () => {
    state.update.error = new ApiError('pq: internal detail', ApiErrorCode.PERMISSION_DENIED);
    renderWithMessages(<WidgetWorkspace />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Rename' })[0]);
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText('Only owners and admins of this organization can change widgets.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/pq:/u)).toBeNull();
  });

  it('deletes after confirmation', async () => {
    state.remove.mutateAsync.mockResolvedValue(undefined);
    renderWithMessages(<WidgetWorkspace />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Delete "Second"? This cannot be undone.')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(state.remove.mutateAsync).toHaveBeenCalledWith(2));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Widget deleted.'));
  });

  it('explains an empty organization', () => {
    state.widgets.data = page([], 1, 1);
    renderWithMessages(<WidgetWorkspace />);

    expect(screen.getByText('No widgets yet')).toBeInTheDocument();
  });
});

function widget(id: number, name: string) {
  return {
    id,
    name,
    created_at: '2026-10-11T08:00:00Z',
    updated_at: '2026-10-11T08:00:00Z',
  };
}

function page(items: ReturnType<typeof widget>[], current: number, last: number) {
  return {
    items,
    meta: {
      current_page: current,
      per_page: 15,
      total: items.length,
      last_page: last,
      from: items.length ? 1 : 0,
      to: items.length,
    },
    links: { first: '/a', last: '/a', prev: null, next: null },
  };
}

function renderWithMessages(children: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en-US" messages={messages as unknown as AbstractIntlMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import '@/i18n';
import { chooseOption } from '@/test/select';
import { NotificationDeliveriesPage } from '@/features/notification-deliveries/components/notification-deliveries-page';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

function page<T>(data: T[], total = data.length, lastPage = 1) {
  return {
    code: 0,
    message: 'success',
    data,
    meta: { current_page: 1, last_page: lastPage, per_page: 20, total },
    links: { first: '', last: '', prev: null, next: null },
  };
}

function withQueryClient(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const failed = {
  id: 31,
  notification_id: 9,
  user_id: 4,
  kind: 'billing.invoice_paid',
  channel: 'email',
  status: 'failed',
  attempts: 5,
  last_failure_code: 'provider_rejected',
  available_at: '2026-09-02T00:00:00Z',
  delivered_at: null,
  created_at: '2026-09-02T00:00:00Z',
  updated_at: '2026-09-02T00:05:00Z',
};

describe('NotificationDeliveriesPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists delivery state with the stable failure code', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(json(page([failed]))));
    vi.stubGlobal('fetch', fetchMock);
    render(
      withQueryClient(
        <NotificationDeliveriesPage
          search={{ status: 'failed', user_id: 4 }}
          onSearchChange={vi.fn()}
        />,
      ),
    );

    const row = (await screen.findByText('billing.invoice_paid')).closest('tr') as HTMLElement;
    expect(within(row).getByText('User #4')).toBeInTheDocument();
    expect(within(row).getByText('Email')).toBeInTheDocument();
    expect(within(row).getByText('provider_rejected')).toBeInTheDocument();
    expect(within(row).getByText(/5 attempts/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/operator/notification-deliveries?page=1&per_page=50&status=failed&user_id=4',
      expect.anything(),
    );
  });

  it('moves filters into the URL state and ignores a non-numeric user ID', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(json(page([])))),
    );
    const onSearchChange = vi.fn();
    render(
      withQueryClient(
        <NotificationDeliveriesPage search={{ page: 2 }} onSearchChange={onSearchChange} />,
      ),
    );

    expect(await screen.findByText(/no deliveries match/i)).toBeInTheDocument();
    await chooseOption(screen.getByLabelText('Status'), 'Failed');
    await chooseOption(screen.getByLabelText('Channel'), 'Email');
    fireEvent.change(screen.getByLabelText('Recipient user ID'), { target: { value: 'abc' } });
    fireEvent.submit(screen.getByRole('search'));

    expect(onSearchChange).toHaveBeenCalledWith({
      status: 'failed',
      channel: 'email',
      user_id: undefined,
      page: undefined,
    });
  });

  it('counts each status under the current filters and filters by a clicked count', async () => {
    const totals: Record<string, number> = { pending: 2, processing: 1, delivered: 40, failed: 3 };
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const params = new URL(url, 'http://admin.test').searchParams;
      const status = params.get('status') ?? '';
      return Promise.resolve(
        json(params.get('per_page') === '1' ? page([], totals[status] ?? 0) : page([failed])),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    const onSearchChange = vi.fn();
    render(
      withQueryClient(
        <NotificationDeliveriesPage
          search={{ channel: 'email', status: 'failed' }}
          onSearchChange={onSearchChange}
        />,
      ),
    );

    const summary = screen.getByRole('group', { name: 'Deliveries by status' });
    const failedCount = within(summary).getByRole('button', { name: /failed/i });
    expect(await within(failedCount).findByText('3')).toBeInTheDocument();
    expect(within(summary).getByRole('button', { name: /delivered/i })).toHaveTextContent('40');
    expect(failedCount).toHaveAttribute('aria-pressed', 'true');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/operator/notification-deliveries?page=1&per_page=1&status=pending&channel=email',
      expect.anything(),
    );

    fireEvent.click(within(summary).getByRole('button', { name: /pending/i }));
    expect(onSearchChange).toHaveBeenLastCalledWith({
      channel: 'email',
      status: 'pending',
      page: undefined,
    });
    fireEvent.click(failedCount);
    expect(onSearchChange).toHaveBeenLastCalledWith({
      channel: 'email',
      status: undefined,
      page: undefined,
    });
  });
});

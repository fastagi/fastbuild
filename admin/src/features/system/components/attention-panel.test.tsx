import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import '@/i18n';
import { AttentionPanel } from '@/features/system/components/attention-panel';

vi.mock('@/config/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/config/env')>()),
  isOperatorFeatureEnabled: () => true,
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, search }: { children: ReactNode; to: string; search: object }) => (
    <a href={`${to}?${new URLSearchParams(search as Record<string, string>).toString()}`}>
      {children}
    </a>
  ),
}));

function respondWithFailedTotal(total: number) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        code: 0,
        message: 'success',
        data: [],
        meta: { current_page: 1, last_page: 1, per_page: 1, total },
      }),
      { headers: { 'content-type': 'application/json' } },
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <AttentionPanel />
    </QueryClientProvider>,
  );
  return fetchMock;
}

describe('AttentionPanel', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('links failed notification deliveries to the filtered ledger', async () => {
    const fetchMock = respondWithFailedTotal(3);

    const link = await screen.findByRole('link', { name: /3 notification deliveries failed/i });
    expect(link).toHaveAttribute('href', '/console/notifications?status=failed');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/operator/notification-deliveries?page=1&per_page=1&status=failed',
      expect.anything(),
    );
  });

  it('says so when nothing needs attention', async () => {
    respondWithFailedTotal(0);
    expect(await screen.findByText('Nothing needs attention right now.')).toBeInTheDocument();
  });
});

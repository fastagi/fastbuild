import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import '@/i18n';
import { OverviewPage } from '@/features/system/components/overview-page';

vi.mock('@/config/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/config/env')>()),
  isFeatureEnabled: () => true,
  isOperatorFeatureEnabled: () => true,
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    search,
    className,
  }: {
    children: ReactNode;
    to: string;
    search: object;
    className: string;
  }) => (
    <a
      className={className}
      href={`${to}?${new URLSearchParams(search as Record<string, string>).toString()}`}
    >
      {children}
    </a>
  ),
}));

function renderOverview(failedTotal: number) {
  const respond = (body: unknown) =>
    new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        url.includes('notification-deliveries')
          ? respond({
              code: 0,
              message: 'success',
              data: [],
              meta: { current_page: 1, last_page: 1, per_page: 1, total: failedTotal },
            })
          : url.includes('/operator/system')
            ? respond({
                code: 0,
                message: 'success',
                data: {
                  version: 'v1.2.3',
                  revision: 'abc123',
                  go_version: 'go1.26',
                  starters: ['operator'],
                  database: 'ok',
                },
              })
            : respond({ status: 'up' }),
      ),
    ),
  );
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <OverviewPage />
    </QueryClientProvider>,
  );
}

describe('OverviewPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('leads with API, database, and failed deliveries, and keeps constants in the profile', async () => {
    renderOverview(0);

    expect(await screen.findByText('None')).toHaveClass('text-success-strong');
    expect(screen.getAllByText('Database').length).toBeGreaterThan(0);
    const profile = screen.getByRole('region', { name: 'Release profile' });
    expect(profile).toHaveTextContent('OSS / CDN');
    expect(profile).toHaveTextContent('Static browser');
  });

  it('turns failed deliveries into a danger link to the filtered ledger', async () => {
    renderOverview(3);

    const link = await screen.findByRole('link', { name: /Failed deliveries\s*3/ });
    expect(link).toHaveAttribute('href', '/console/notifications?status=failed');
    expect(link).toHaveClass('bg-danger-subtle', 'text-danger-strong');
  });

  it('shows every part of the API build in full', async () => {
    renderOverview(0);

    for (const part of ['v1.2.3', 'abc123', 'go1.26']) {
      expect(await screen.findByText(part)).toBeInTheDocument();
    }
  });
});

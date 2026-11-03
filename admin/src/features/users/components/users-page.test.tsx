import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@/i18n';
import { UsersPage } from '@/features/users/components/users-page';
import type { UserSearch } from '@/features/users/types';

const page = {
  code: 0,
  message: 'success',
  data: [
    {
      id: 2,
      username: 'member',
      email: 'member@example.test',
      nickname: 'Member',
      status: 'active',
      is_operator: false,
      created_at: '2026-09-01T00:00:00Z',
      last_login: null,
    },
    {
      id: 1,
      username: 'ops',
      email: 'ops@example.test',
      nickname: 'Ops',
      status: 'active',
      is_operator: true,
      created_at: '2026-09-01T00:00:00Z',
      last_login: '2026-09-30T08:00:00Z',
    },
  ],
  meta: { current_page: 1, last_page: 1, per_page: 20, total: 2 },
  links: { first: '', last: '', prev: null, next: null },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

async function chooseRowAction(row: string, action: string | RegExp) {
  fireEvent.keyDown(await screen.findByRole('button', { name: `Actions for ${row}` }), {
    key: 'Enter',
  });
  fireEvent.click(await screen.findByRole('menuitem', { name: action }));
}

function renderPage(onSearchChange = vi.fn(), search: UserSearch = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <UsersPage search={search} onSearchChange={onSearchChange} />
    </QueryClientProvider>,
  );
  return onSearchChange;
}

describe('UsersPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists accounts and offers no actions on operator accounts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(json(page))),
    );
    renderPage();

    const memberRow = (await screen.findByText('member@example.test')).closest('tr');
    const operatorRow = screen.getByText('ops@example.test').closest('tr');
    expect(
      within(memberRow as HTMLElement).getByRole('button', { name: 'Actions for Member' }),
    ).toBeInTheDocument();
    expect(
      within(operatorRow as HTMLElement).queryByRole('button', { name: /^Actions for/ }),
    ).not.toBeInTheDocument();
    expect(
      within(operatorRow as HTMLElement).getByText(/managed from the cli/i),
    ).toBeInTheDocument();
  });

  it('disables an account only after confirmation', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      if (init.method === 'POST') {
        return Promise.resolve(
          json({ code: 0, message: 'success', data: { ...page.data[0], status: 'disabled' } }),
        );
      }
      return Promise.resolve(json(page));
    });
    vi.stubGlobal('fetch', fetchMock);
    renderPage();

    await chooseRowAction('Member', 'Disable');
    const dialog = await screen.findByRole('dialog');
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit).method === 'POST')).toBe(
      false,
    );

    fireEvent.click(within(dialog).getByRole('button', { name: 'Disable' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/operator/users/2/disable',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('returns focus to the row menu when the dialog closes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(json(page))),
    );
    renderPage();

    await chooseRowAction('Member', 'Disable');
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Actions for Member' })).toHaveFocus(),
    );
  });

  it('explains a protected-target rejection inside the dialog', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((_url: string, init: RequestInit) =>
          Promise.resolve(
            init.method === 'POST'
              ? json(
                  { code: 409, error_code: 'OPERATOR.TARGET_PROTECTED', message: 'protected' },
                  409,
                )
              : json(page),
          ),
        ),
    );
    renderPage();

    await chooseRowAction('Member', /end sessions/i);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /end sessions/i }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/server command line/i);
  });

  it('keeps the account identifier behind a copy button', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(json(page))),
    );
    renderPage();

    expect(await screen.findByText('Member')).toBeInTheDocument();
    expect(screen.queryByText('member')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copy member' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('member'));
  });

  it('separates an empty list from a filtered one and clears the filters', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(json({ ...page, data: [] }))),
    );
    const onSearchChange = vi.fn();
    renderPage(onSearchChange, { status: 'disabled' });

    expect(await screen.findByText('No accounts match these filters.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onSearchChange).toHaveBeenCalledWith({});
  });

  it('says nothing is loading once the list has failed, and retries', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve(
          json(
            {
              code: 500,
              error_code: 'COMMON.INTERNAL_ERROR',
              message: 'failed',
              request_id: 'req-500',
            },
            500,
          ),
        ),
      )
      .mockImplementation(() => Promise.resolve(json(page)));
    vi.stubGlobal('fetch', fetchMock);
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Request ID: req-500');
    expect(screen.queryByText('Loading accounts…')).not.toBeInTheDocument();

    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('2 accounts')).toBeInTheDocument();
  });

  it('moves the search into the URL state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(json(page))),
    );
    const onSearchChange = renderPage();

    fireEvent.change(await screen.findByPlaceholderText(/username or email/i), {
      target: { value: ' mem ' },
    });
    fireEvent.submit(screen.getByRole('search'));

    expect(onSearchChange).toHaveBeenCalledWith({ q: 'mem', page: undefined });
  });
});

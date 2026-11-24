import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { csrf } from '@/http/client';
import '@/i18n';
import { SignInPage } from '@/features/operator-session/components/sign-in-page';

const navigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <SignInPage redirectTo="/console/users" />
    </QueryClientProvider>,
  );
  return queryClient;
}

function respond(body: unknown, status: number) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json' },
        status,
      }),
    ),
  );
}

function submit() {
  fireEvent.change(screen.getByLabelText(/username or email/i), { target: { value: 'ops' } });
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'secret' } });
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
}

describe('SignInPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    navigate.mockReset();
    csrf.set(undefined);
  });

  it('keeps the CSRF token in memory and navigates to the requested console page', async () => {
    respond(
      {
        code: 0,
        message: 'success',
        data: {
          operator: { id: 1, username: 'ops', email: 'ops@example.test', nickname: 'Ops' },
          csrf_token: 'csrf-token-0123456789',
        },
      },
      200,
    );
    const queryClient = renderPage();

    submit();

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: '/console/users', replace: true }),
    );
    expect(csrf.get()).toBe('csrf-token-0123456789');
    expect(queryClient.getQueryData(['operator', 'session'])).toMatchObject({
      operator: { username: 'ops' },
    });
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('explains that a verified account lacks operator access', async () => {
    respond(
      { code: 403, error_code: 'OPERATOR.FORBIDDEN', message: 'Operator access is required' },
      403,
    );
    renderPage();

    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(/platform-operator access/i);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps submit enabled and validates empty fields only on submit', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderPage();

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    expect(submitButton).toBeEnabled();
    expect(screen.queryByText('Enter your username or email.')).not.toBeInTheDocument();

    fireEvent.click(submitButton);

    const identifier = screen.getByLabelText(/username or email/i);
    expect(identifier).toHaveAccessibleDescription('Enter your username or email.');
    expect(identifier).toHaveFocus();
    expect(screen.getByLabelText(/^password$/i)).toHaveAccessibleDescription(
      'Enter your password.',
    );
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(identifier, { target: { value: 'ops' } });
    expect(screen.queryByText('Enter your username or email.')).not.toBeInTheDocument();
  });

  it('reveals the password on request and warns while Caps Lock is on', () => {
    renderPage();
    const password = screen.getByLabelText(/^password$/i);
    expect(password).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: /show password/i }));
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /hide password/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // jsdom does not model Caps Lock, so the key event reports it the way a browser would.
    const capsLockKey = new KeyboardEvent('keyup', { key: 'A', bubbles: true });
    Object.defineProperty(capsLockKey, 'getModifierState', {
      value: (key: string) => key === 'CapsLock',
    });
    fireEvent(password, capsLockKey);
    expect(screen.getByText(/caps lock is on/i)).toBeInTheDocument();
    expect(password).toHaveAccessibleDescription(/caps lock is on/i);

    fireEvent.blur(password);
    expect(screen.queryByText(/caps lock is on/i)).not.toBeInTheDocument();
  });

  it('transitions to the MFA challenge step and completes verification', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            message: 'success',
            data: {
              mfa_required: true,
              challenge_token: 'admin-challenge-123',
              challenge_expires_in: 300,
              method: 'totp',
            },
          }),
          { headers: { 'content-type': 'application/json' }, status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            message: 'success',
            data: {
              operator: { id: 1, username: 'ops', email: 'ops@example.test', nickname: 'Ops' },
              csrf_token: 'csrf-token-mfa-9876543210',
            },
          }),
          { headers: { 'content-type': 'application/json' }, status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    renderPage();

    submit();

    const codeInput = await screen.findByLabelText(/verification or recovery code/i);
    expect(navigate).not.toHaveBeenCalled();

    fireEvent.change(codeInput, { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: /verify & sign in/i }));

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: '/console/users', replace: true }),
    );
    expect(csrf.get()).toBe('csrf-token-mfa-9876543210');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/v1/auth/mfa/challenge/verify');
  });
});

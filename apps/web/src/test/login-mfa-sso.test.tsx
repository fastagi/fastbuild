import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginForm } from '@/features/auth/components/login-form';
import authEn from '@/i18n/modules/auth/en-US';
import errorsEn from '@/i18n/modules/errors/en-US';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  verifyMfaChallenge: vi.fn(),
  listSsoProviders: vi.fn(),
  startSsoOidc: vi.fn(),
  replace: vi.fn(),
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/features/auth/services/auth-service', () => ({
  authService: {
    login: mocks.login,
    verifyMfaChallenge: mocks.verifyMfaChallenge,
    listSsoProviders: mocks.listSsoProviders,
    startSsoOidc: mocks.startSsoOidc,
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('sonner', () => ({ toast: mocks.toast }));

function renderLoginForm() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <NextIntlClientProvider locale="en-US" messages={{ auth: authEn, errors: errorsEn }}>
      <QueryClientProvider client={queryClient}>
        <LoginForm />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

describe('LoginForm SSO and MFA challenge flows', () => {
  beforeEach(() => {
    mocks.login.mockReset();
    mocks.verifyMfaChallenge.mockReset();
    mocks.listSsoProviders.mockReset();
    mocks.startSsoOidc.mockReset();
    mocks.replace.mockReset();
    mocks.toast.error.mockReset();
    mocks.toast.success.mockReset();
  });

  it('hides SSO divider when no providers are configured and renders buttons when configured', async () => {
    mocks.listSsoProviders.mockResolvedValueOnce([]);
    const firstRender = renderLoginForm();

    await waitFor(() => expect(mocks.listSsoProviders).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/or continue with/i)).not.toBeInTheDocument();
    firstRender.unmount();

    mocks.listSsoProviders.mockResolvedValueOnce([
      { slug: 'okta', name: 'Okta Enterprise' },
    ]);
    renderLoginForm();

    const ssoButton = await screen.findByRole('button', {
      name: /sign in with okta enterprise/i,
    });
    expect(ssoButton).toBeInTheDocument();
  });

  it('switches to the MFA challenge step and completes verification', async () => {
    mocks.listSsoProviders.mockResolvedValueOnce([]);
    mocks.login.mockResolvedValueOnce({
      mfa_required: true,
      challenge_token: 'challenge-token-abc',
      challenge_expires_in: 300,
      method: 'totp',
    });
    mocks.verifyMfaChallenge.mockResolvedValueOnce({
      user: { id: '1', email: 'user@example.test', name: 'Demo User' },
    });

    renderLoginForm();

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'user@example.test' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'correct-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    const mfaInput = await screen.findByLabelText(/verification or recovery code/i);
    expect(mocks.replace).not.toHaveBeenCalled();

    fireEvent.change(mfaInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /verify & sign in/i }));

    await waitFor(() => {
      expect(mocks.verifyMfaChallenge).toHaveBeenCalledWith({
        challenge_token: 'challenge-token-abc',
        code: '123456',
      });
    });
    expect(mocks.replace).toHaveBeenCalledWith('/console');
  });
});

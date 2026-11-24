import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@/i18n';
import { MfaSectionCard } from '@/features/preferences/components/mfa-section-card';

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MfaSectionCard />
    </QueryClientProvider>,
  );
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify({ code: 0, message: 'success', data }), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

describe('MfaSectionCard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('enrolls TOTP, verifies 6-digit code, and displays 8 one-time recovery codes', async () => {
    const recoveryCodes = [
      'AAAA-1111',
      'BBBB-2222',
      'CCCC-3333',
      'DDDD-4444',
      'EEEE-5555',
      'FFFF-6666',
      'GGGG-7777',
      'HHHH-8888',
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ enabled: false, method: 'totp', remaining_recovery_codes: 0 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          secret: 'ADMINSECRETBASE32',
          otpauth_uri: 'otpauth://totp/FastBuild:ops%40example.test?secret=ADMINSECRETBASE32',
          issuer: 'FastBuild',
          account_name: 'ops@example.test',
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ enabled: true, recovery_codes: recoveryCodes }))
      .mockResolvedValueOnce(
        jsonResponse({ enabled: true, method: 'totp', remaining_recovery_codes: 8 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    renderCard();

    fireEvent.click(
      await screen.findByRole('button', { name: /enable two-factor authentication/i }),
    );

    expect(await screen.findByDisplayValue('ADMINSECRETBASE32')).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(
        'otpauth://totp/FastBuild:ops%40example.test?secret=ADMINSECRETBASE32',
      ),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/6-digit verification code/i), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /verify & activate/i }));

    const codesEl = await screen.findByTestId('admin-mfa-recovery-codes');
    for (const code of recoveryCodes) {
      expect(codesEl).toHaveTextContent(code);
    }
  });

  it('disables TOTP when a verification code is submitted', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ enabled: true, method: 'totp', remaining_recovery_codes: 8 }),
      )
      .mockResolvedValueOnce(jsonResponse({ enabled: false }))
      .mockResolvedValueOnce(
        jsonResponse({ enabled: false, method: 'totp', remaining_recovery_codes: 0 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    renderCard();

    fireEvent.change(await screen.findByLabelText(/authenticator or recovery code/i), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /disable two-factor authentication/i }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some((call) => String(call[0]).includes('/v1/auth/mfa/totp/disable')),
      ).toBe(true);
    });
  });
});

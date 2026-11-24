import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MfaSecurityPanel } from '@/features/auth/components/mfa-security-panel';
import settingsEn from '@/i18n/modules/settings/en-US';

const mocks = vi.hoisted(() => ({
  getMfaStatus: vi.fn(),
  enrollMfaTotp: vi.fn(),
  verifyMfaTotp: vi.fn(),
  disableMfaTotp: vi.fn(),
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/features/auth/services/auth-service', () => ({
  authService: {
    getMfaStatus: mocks.getMfaStatus,
    enrollMfaTotp: mocks.enrollMfaTotp,
    verifyMfaTotp: mocks.verifyMfaTotp,
    disableMfaTotp: mocks.disableMfaTotp,
  },
}));

vi.mock('sonner', () => ({ toast: mocks.toast }));

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <NextIntlClientProvider locale="en-US" messages={{ settings: settingsEn }}>
      <QueryClientProvider client={queryClient}>
        <MfaSecurityPanel />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

describe('MfaSecurityPanel', () => {
  beforeEach(() => {
    mocks.getMfaStatus.mockReset();
    mocks.enrollMfaTotp.mockReset();
    mocks.verifyMfaTotp.mockReset();
    mocks.disableMfaTotp.mockReset();
    mocks.toast.error.mockReset();
    mocks.toast.success.mockReset();
  });

  it('enrolls TOTP, verifies 6-digit code, and displays 8 recovery codes', async () => {
    mocks.getMfaStatus
      .mockResolvedValueOnce({
        enabled: false,
        method: 'totp',
        remaining_recovery_codes: 0,
      })
      .mockResolvedValueOnce({
        enabled: true,
        method: 'totp',
        remaining_recovery_codes: 8,
        enrolled_at: '2026-11-24T12:00:00Z',
      });

    mocks.enrollMfaTotp.mockResolvedValueOnce({
      secret: 'JBSWY3DPEHPK3PXP',
      otpauth_uri: 'otpauth://totp/FastBuild:user%40example.test?secret=JBSWY3DPEHPK3PXP&issuer=FastBuild',
      issuer: 'FastBuild',
      account_name: 'user@example.test',
    });

    const recoveryCodes = [
      '1111-2222',
      '2222-3333',
      '3333-4444',
      '4444-5555',
      '5555-6666',
      '6666-7777',
      '7777-8888',
      '8888-9999',
    ];
    mocks.verifyMfaTotp.mockResolvedValueOnce({
      enabled: true,
      recovery_codes: recoveryCodes,
    });

    renderPanel();

    const startBtn = await screen.findByRole('button', {
      name: /enable two-factor authentication/i,
    });
    fireEvent.click(startBtn);

    expect(await screen.findByDisplayValue('JBSWY3DPEHPK3PXP')).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(
        'otpauth://totp/FastBuild:user%40example.test?secret=JBSWY3DPEHPK3PXP&issuer=FastBuild'
      )
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/6-digit verification code/i), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /verify & activate/i }));

    await waitFor(() => {
      expect(mocks.verifyMfaTotp).toHaveBeenCalledWith({ code: '123456' });
    });

    const codesContainer = await screen.findByTestId('mfa-recovery-codes');
    for (const code of recoveryCodes) {
      expect(codesContainer).toHaveTextContent(code);
    }
    expect(mocks.toast.success).toHaveBeenCalledWith('Two-factor authentication enabled');
  });

  it('disables TOTP when a valid code is submitted', async () => {
    mocks.getMfaStatus
      .mockResolvedValueOnce({
        enabled: true,
        method: 'totp',
        remaining_recovery_codes: 8,
        enrolled_at: '2026-11-24T12:00:00Z',
      })
      .mockResolvedValueOnce({
        enabled: false,
        method: 'totp',
        remaining_recovery_codes: 0,
      });

    mocks.disableMfaTotp.mockResolvedValueOnce({ enabled: false });

    renderPanel();

    const disableInput = await screen.findByLabelText(/authenticator or recovery code/i);
    fireEvent.change(disableInput, { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: /disable two-factor authentication/i }));

    await waitFor(() => {
      expect(mocks.disableMfaTotp).toHaveBeenCalledWith({ code: '654321' });
    });
    expect(mocks.toast.success).toHaveBeenCalledWith('Two-factor authentication disabled');
  });
});

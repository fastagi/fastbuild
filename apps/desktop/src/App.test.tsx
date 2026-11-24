import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '@/App.tsx';
import { DesktopTokenStore, type FastBuildDesktopBridge } from '@/lib/desktop-bridge.ts';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createBridgeStub(): FastBuildDesktopBridge {
  let storedTokens: { accessToken: string; refreshToken?: string; expiresAt?: number } | null = null;

  return {
    tokens: {
      get: vi.fn(async () => storedTokens),
      set: vi.fn(async (tokens) => {
        storedTokens = tokens;
      }),
      clear: vi.fn(async () => {
        storedTokens = null;
      }),
    },
    getRuntimeInfo: vi.fn(async () => ({
      appVersion: '0.1.0',
      platform: 'darwin',
      electronVersion: '35.2.0',
      storageMode: 'safeStorage' as const,
    })),
    theme: {
      get: vi.fn(async () => ({ mode: 'system' as const, shouldUseDarkColors: false })),
      set: vi.fn(async (mode) => ({ mode, shouldUseDarkColors: mode === 'dark' })),
      onUpdated: vi.fn(() => () => {}),
    },
  };
}

const DEMO_USER = {
  id: 7,
  username: 'alice',
  email: 'alice@fastbuild.dev',
  nickname: 'Alice Chen',
  status: 1 as const,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('Desktop App sign-in, workspace, and settings flow', () => {
  it('validates input, signs in via /v1/auth/native/login, renders Overview & Settings, and signs out', async () => {
    const bridge = createBridgeStub();
    const tokenStore = new DesktopTokenStore(bridge);

    const fetchMock = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.endsWith('/v1/auth/native/login') && init?.method === 'POST') {
        return jsonResponse({
          code: 0,
          message: 'success',
          data: {
            access_token: 'access-token-1',
            refresh_token: 'refresh-token-1',
            token_type: 'Bearer',
            expires_in: 900,
            user: DEMO_USER,
          },
        });
      }

      if (url.endsWith('/health')) {
        return jsonResponse({
          status: 'up',
          timestamp: '2026-11-24T17:00:00Z',
        });
      }

      if (url.endsWith('/v1/health')) {
        return jsonResponse({
          status: 'ok',
          version: 'v1',
        });
      }

      if (url.endsWith('/v1/auth/native/logout') && init?.method === 'POST') {
        return jsonResponse({
          code: 0,
          message: 'success',
          data: { success: true },
        });
      }

      return jsonResponse({ code: 404, error_code: 'COMMON.NOT_FOUND', message: 'Not found' }, 404);
    });

    render(<App bridge={bridge} tokenStore={tokenStore} fetchImpl={fetchMock} />);

    // Renders sign-in screen with @fastbuild/ui components
    expect(await screen.findByText('Sign in to your workspace')).toBeInTheDocument();
    expect(screen.getByText('FastBuild Desktop')).toBeInTheDocument();

    // Client-side validation via @fastbuild/core
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'ab' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Username must be at least 3 characters.',
    );

    // Valid native sign-in
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'alice' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    // Transitions to authenticated Overview shell
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByText('Alice Chen')).toBeInTheDocument();
    expect(screen.getAllByText('alice@fastbuild.dev').length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText('UP')).toBeInTheDocument();
    expect(bridge.tokens.set).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'access-token-1',
        refreshToken: 'refresh-token-1',
      }),
    );

    // Switch to Settings and toggle Dark theme
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    await waitFor(() => {
      expect(bridge.theme.set).toHaveBeenCalledWith('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    // Sign out revokes via /v1/auth/native/logout and clears keychain tokens
    const signOutButtons = screen.getAllByRole('button', { name: 'Sign out' });
    fireEvent.click(signOutButtons[0]!);

    expect(await screen.findByText('Sign in to your workspace')).toBeInTheDocument();
    expect(bridge.tokens.clear).toHaveBeenCalled();
  });

  it('displays normalized @fastbuild/core API errors when login fails', async () => {
    const bridge = createBridgeStub();
    const tokenStore = new DesktopTokenStore(bridge);

    const fetchMock = vi.fn<typeof globalThis.fetch>(async () =>
      jsonResponse(
        {
          code: 401,
          error_code: 'AUTH.INVALID_CREDENTIALS',
          message: 'Invalid username or password',
          request_id: 'req-desktop-42',
        },
        401,
      ),
    );

    render(<App bridge={bridge} tokenStore={tokenStore} fetchImpl={fetchMock} />);

    expect(await screen.findByText('Sign in to your workspace')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong-pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Invalid username or password');
    expect(alert).toHaveTextContent('AUTH.INVALID_CREDENTIALS');
    expect(alert).toHaveTextContent('req-desktop-42');
  });
});

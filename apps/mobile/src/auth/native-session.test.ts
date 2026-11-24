import { describe, expect, it, vi } from 'vitest';
import { MemoryTokenStore } from '@fastbuild/api-client';
import { ApiError, DEFAULT_MESSAGES, ERROR_CODES, I18N_KEYS } from '@fastbuild/core';
import {
  NATIVE_LOGIN_PATH,
  NATIVE_LOGOUT_PATH,
  NATIVE_REFRESH_PATH,
  createMobileApiClient,
  fetchApiHealth,
  mapApiErrorToMessage,
  restoreNativeSession,
  signInNative,
  signOutNative,
  validateSignInInput,
} from './native-session';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const SAMPLE_USER = {
  id: 7,
  username: 'alice',
  email: 'alice@example.com',
  status: 1 as const,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('native-session', () => {
  it('validates email, username, and password using @fastbuild/core rules', () => {
    expect(validateSignInInput('alice@example.com', 'secret123')).toEqual({ valid: true });
    expect(validateSignInInput('alice', 'secret123')).toEqual({ valid: true });

    const badEmail = validateSignInInput('bad@', 'secret123');
    expect(badEmail.valid).toBe(false);
    expect(badEmail.identifierError).toContain('email');

    const shortPassword = validateSignInInput('alice', '123');
    expect(shortPassword.valid).toBe(false);
    expect(shortPassword.passwordError).toContain('6');
  });

  it('maps canonical ApiError codes to reviewed local i18n copy', () => {
    const err = new ApiError('raw backend text', ERROR_CODES.AUTH_INVALID_CREDENTIALS, {
      status: 401,
    });
    expect(mapApiErrorToMessage(err)).toBe(DEFAULT_MESSAGES[I18N_KEYS.auth.invalidCredentials]);
    expect(mapApiErrorToMessage(new Error('boom'))).toBe(
      DEFAULT_MESSAGES[I18N_KEYS.common.unknownError],
    );
  });

  it('signs in via /v1/auth/native/login and persists rotating tokens', async () => {
    const tokenStore = new MemoryTokenStore();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe(`https://api.example.test${NATIVE_LOGIN_PATH}`);
      return jsonResponse({
        code: 0,
        message: 'success',
        data: {
          access_token: 'access_1',
          refresh_token: 'refresh_1',
          token_type: 'Bearer',
          expires_in: 900,
          user: SAMPLE_USER,
        },
      });
    });

    const client = createMobileApiClient({
      baseUrl: 'https://api.example.test/',
      tokenStore,
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    });

    const session = await signInNative(client, { username: 'alice', password: 'secret123' });
    expect(session.user.username).toBe('alice');
    expect(tokenStore.getTokens()?.accessToken).toBe('access_1');
    expect(tokenStore.getTokens()?.refreshToken).toBe('refresh_1');
  });

  it('rotates tokens via /v1/auth/native/refresh on 401 during session restore', async () => {
    const tokenStore = new MemoryTokenStore();
    tokenStore.setTokens({ accessToken: 'expired_access', refreshToken: 'refresh_1' });

    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(url);

      if (url.endsWith('/v1/users/profile')) {
        const authHeader = new Headers(init?.headers).get('authorization');
        if (authHeader === 'Bearer expired_access') {
          return jsonResponse(
            { code: 401, error_code: ERROR_CODES.AUTH_UNAUTHORIZED, message: 'expired' },
            401,
          );
        }
        expect(authHeader).toBe('Bearer rotated_access');
        return jsonResponse({ code: 0, message: 'success', data: SAMPLE_USER });
      }

      if (url.endsWith(NATIVE_REFRESH_PATH)) {
        return jsonResponse({
          code: 0,
          message: 'success',
          data: {
            access_token: 'rotated_access',
            refresh_token: 'refresh_2',
            token_type: 'Bearer',
            expires_in: 900,
            user: SAMPLE_USER,
          },
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = createMobileApiClient({
      baseUrl: 'https://api.example.test',
      tokenStore,
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    });

    const user = await restoreNativeSession(client, tokenStore);
    expect(user?.username).toBe('alice');
    expect(tokenStore.getTokens()?.accessToken).toBe('rotated_access');
    expect(tokenStore.getTokens()?.refreshToken).toBe('refresh_2');
    expect(calls).toEqual([
      'https://api.example.test/v1/users/profile',
      `https://api.example.test${NATIVE_REFRESH_PATH}`,
      'https://api.example.test/v1/users/profile',
    ]);
  });

  it('signs out via /v1/auth/native/logout and clears tokens', async () => {
    const tokenStore = new MemoryTokenStore();
    tokenStore.setTokens({ accessToken: 'access_1', refreshToken: 'refresh_1' });

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe(`https://api.example.test${NATIVE_LOGOUT_PATH}`);
      return jsonResponse({ code: 0, message: 'success', data: { success: true } });
    });

    const client = createMobileApiClient({
      baseUrl: 'https://api.example.test',
      tokenStore,
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    });

    await signOutNative(client, tokenStore);
    expect(tokenStore.getTokens()).toBeNull();
  });

  it('fetches /health without requiring auth', async () => {
    const tokenStore = new MemoryTokenStore();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe('https://api.example.test/health');
      return jsonResponse({ status: 'up', timestamp: '2026-01-01T00:00:00Z' });
    });

    const client = createMobileApiClient({
      baseUrl: 'https://api.example.test',
      tokenStore,
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    });

    const report = await fetchApiHealth(client);
    expect(report.status).toBe('up');
  });
});

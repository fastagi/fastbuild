import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ApiError, ERROR_CODES } from '@fastbuild/core';
import { createFastBuildClient, MemoryTokenStore } from './index.ts';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('@fastbuild/api-client cookie mode', () => {
  it('sends credentials include, unwraps envelopes, and recovers from CSRF rejection', async () => {
    let csrf = 'stale-csrf';
    const seenHeaders: string[] = [];
    let calls = 0;

    const client = createFastBuildClient({
      baseUrl: 'https://api.fastbuild.local',
      authMode: 'cookie',
      getCsrfToken: () => csrf,
      onCsrfRejected: async () => {
        csrf = 'fresh-csrf';
      },
      fetch: async (_input, init) => {
        calls += 1;
        assert.equal(init?.credentials, 'include');
        const headers = new Headers(init?.headers);
        seenHeaders.push(headers.get('x-csrf-token') ?? '');

        if (calls === 1) {
          return jsonResponse(
            { code: 403, error_code: ERROR_CODES.OPERATOR_CSRF_REJECTED, message: 'Invalid CSRF' },
            403,
          );
        }
        return jsonResponse({ code: 0, message: 'success', data: { ok: true } });
      },
    });

    const result = await client.post<{ ok: boolean }>('/v1/operator/action', { a: 1 });
    assert.deepEqual(result, { ok: true });
    assert.deepEqual(seenHeaders, ['stale-csrf', 'fresh-csrf']);
  });

  it('supports raw health endpoints without envelope unwrapping', async () => {
    const client = createFastBuildClient({
      baseUrl: 'https://api.fastbuild.local',
      fetch: async () => jsonResponse({ status: 'ok', version: 'v1' }),
    });

    const health = await client.health.v1();
    assert.deepEqual(health, { status: 'ok', version: 'v1' });
  });
});

describe('@fastbuild/api-client bearer mode', () => {
  it('rotates refresh tokens once across concurrent 401 requests and retries', async () => {
    const store = new MemoryTokenStore();
    store.setTokens({ accessToken: 'expired-access', refreshToken: 'refresh-1' });

    let refreshCalls = 0;
    const client = createFastBuildClient({
      baseUrl: 'https://api.fastbuild.local',
      authMode: 'bearer',
      tokenStore: store,
      fetch: async (input, init) => {
        const url = String(input);
        assert.equal(init?.credentials, 'omit');

        if (url.endsWith('/v1/auth/native/refresh')) {
          refreshCalls += 1;
          const body = JSON.parse(String(init?.body)) as { refresh_token: string };
          assert.equal(body.refresh_token, 'refresh-1');
          return jsonResponse({
            code: 0,
            message: 'success',
            data: {
              access_token: 'fresh-access',
              refresh_token: 'refresh-2',
              token_type: 'Bearer',
              expires_in: 900,
              user: {
                id: 1,
                username: 'alex',
                email: 'alex@example.com',
                status: 1,
                created_at: '2026-01-01T00:00:00Z',
                updated_at: '2026-01-01T00:00:00Z',
              },
            },
          });
        }

        const auth = new Headers(init?.headers).get('authorization');
        if (auth === 'Bearer expired-access') {
          return jsonResponse(
            { code: 401, error_code: ERROR_CODES.AUTH_UNAUTHORIZED, message: 'Expired' },
            401,
          );
        }

        assert.equal(auth, 'Bearer fresh-access');
        return jsonResponse({ code: 0, message: 'success', data: { path: url } });
      },
    });

    const [first, second] = await Promise.all([
      client.get<{ path: string }>('/v1/users/profile'),
      client.get<{ path: string }>('/v1/users/profile'),
    ]);

    assert.equal(refreshCalls, 1);
    assert.ok(first.path.endsWith('/v1/users/profile'));
    assert.ok(second.path.endsWith('/v1/users/profile'));
    assert.equal(store.getTokens()?.accessToken, 'fresh-access');
    assert.equal(store.getTokens()?.refreshToken, 'refresh-2');
  });

  it('clears tokens and notifies onUnauthorized when refresh fails', async () => {
    const store = new MemoryTokenStore();
    store.setTokens({ accessToken: 'expired-access', refreshToken: 'bad-refresh' });
    let unauthorizedCalled = false;

    const client = createFastBuildClient({
      baseUrl: 'https://api.fastbuild.local',
      authMode: 'bearer',
      tokenStore: store,
      onUnauthorized: () => {
        unauthorizedCalled = true;
      },
      fetch: async () =>
        jsonResponse(
          { code: 401, error_code: ERROR_CODES.AUTH_UNAUTHORIZED, message: 'Invalid' },
          401,
        ),
    });

    await assert.rejects(
      () => client.user.profile(),
      (err: unknown) => err instanceof ApiError && err.errorCode === ERROR_CODES.AUTH_UNAUTHORIZED,
    );
    assert.equal(unauthorizedCalled, true);
    assert.equal(store.getTokens(), null);
  });
});

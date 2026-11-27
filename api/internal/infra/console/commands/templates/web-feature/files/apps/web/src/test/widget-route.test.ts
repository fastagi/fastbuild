import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseOptionalWebFeatures } from '@/config/optional-features';

const cookieStore = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
const getSessionUser = vi.hoisted(() => vi.fn());

vi.mock('next/headers', () => ({
  cookies: async () => cookieStore,
  headers: async () => new Headers(),
}));
vi.mock('@/features/auth/server/session', async importOriginal => {
  const original = await importOriginal<typeof import('@/features/auth/server/session')>();
  return { ...original, getSessionUser };
});

const originalEnv = { ...process.env };
const managedKeys = [
  'API_ADAPTER_ENABLED',
  'API_UPSTREAM_MAX_RESPONSE_BYTES',
  'API_UPSTREAM_TIMEOUT_MS',
  'API_UPSTREAM_URL',
  'MOCK_BFF_ENABLED',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_OPTIONAL_FEATURES',
] as const;

type WidgetRoute = typeof import('@/features/widget/server/widget-route');

describe('widget browser route boundary', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    vi.resetModules();
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    cookieStore.get.mockReset();
    cookieStore.set.mockReset();
    getSessionUser.mockReset();
    process.env.NEXT_PUBLIC_API_URL = '/api';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
    process.env.NEXT_PUBLIC_OPTIONAL_FEATURES = 'organization,widget';
    process.env.API_UPSTREAM_TIMEOUT_MS = '5000';
    process.env.API_UPSTREAM_MAX_RESPONSE_BYTES = '1048576';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    for (const key of managedKeys) {
      delete process.env[key];
      if (originalEnv[key] !== undefined) process.env[key] = originalEnv[key];
    }
  });

  it('selects the feature only with organization ownership', () => {
    expect(parseOptionalWebFeatures('organization,widget')).toEqual(['organization', 'widget']);
    expect(() => parseOptionalWebFeatures('widget')).toThrow('requires "organization"');
  });

  it('stays unavailable when the feature is not selected', async () => {
    process.env.MOCK_BFF_ENABLED = 'true';
    process.env.NEXT_PUBLIC_OPTIONAL_FEATURES = 'organization';
    getSessionUser.mockResolvedValue(mockUser('demo-admin'));
    const route = await loadRoute();

    const response = await route.listWidgetsRoute(
      request('/api/widgets', { headers: organization() })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error_code: 'COMMON.SERVICE_UNAVAILABLE',
    });
    expect(getSessionUser).not.toHaveBeenCalled();
  });

  it('creates, pages newest first, reads, renames, and deletes', async () => {
    process.env.MOCK_BFF_ENABLED = 'true';
    getSessionUser.mockResolvedValue(mockUser('demo-admin'));
    const route = await loadRoute();

    const first = await create(route, { name: '  First  ' });
    expect(first.status).toBe(201);
    expect(first.headers.get('cache-control')).toBe('private, no-store');
    expect(first.headers.get('vary')).toContain('Organization-Id');
    const created = (await first.json()).data;
    expect(created).toMatchObject({ name: 'First' });
    expect(created).not.toHaveProperty('organization_id');
    const second = (await (await create(route, { name: 'Second' })).json()).data;

    const page = await route.listWidgetsRoute(
      request('/api/widgets?per_page=1', { headers: organization() })
    );
    await expect(page.json()).resolves.toMatchObject({
      code: 0,
      data: [{ id: second.id, name: 'Second' }],
      meta: { current_page: 1, per_page: 1, total: 2, last_page: 2 },
    });

    const path = `/api/widgets/${created.id}`;
    const read = await route.getWidgetRoute(
      request(path, { headers: organization() }),
      String(created.id)
    );
    expect(read.status).toBe(200);

    const renamed = await route.updateWidgetRoute(
      request(path, {
        method: 'PUT',
        body: JSON.stringify({ name: 'Renamed' }),
        headers: organization(),
      }),
      String(created.id)
    );
    await expect(renamed.json()).resolves.toMatchObject({ data: { name: 'Renamed' } });

    const removed = await route.deleteWidgetRoute(
      request(path, { method: 'DELETE', headers: organization() }),
      String(created.id)
    );
    expect(removed.status).toBe(204);
    const gone = await route.getWidgetRoute(
      request(path, { headers: organization() }),
      String(created.id)
    );
    expect(gone.status).toBe(404);
    await expect(gone.json()).resolves.toMatchObject({ error_code: 'COMMON.NOT_FOUND' });
  });

  it('isolates organizations and lets members read but only owners and admins write', async () => {
    process.env.MOCK_BFF_ENABLED = 'true';
    getSessionUser.mockResolvedValue(mockUser('demo-admin'));
    const route = await loadRoute();
    const created = (await (await create(route, { name: 'Private to one' })).json()).data;
    const path = `/api/widgets/${created.id}`;

    getSessionUser.mockResolvedValue(mockUser('demo-member'));
    const read = await route.getWidgetRoute(
      request(path, { headers: organization() }),
      String(created.id)
    );
    expect(read.status).toBe(200);
    const forbidden = await create(route, { name: 'Member write' });
    expect(forbidden.status).toBe(403);
    await expect(forbidden.json()).resolves.toMatchObject({ error_code: 'PERMISSION.DENIED' });

    getSessionUser.mockResolvedValue(mockUser('demo-admin'));
    const otherOrganization = await route.getWidgetRoute(
      request(path, { headers: organization('999') }),
      String(created.id)
    );
    expect(otherOrganization.status).toBe(404);
    await expect(otherOrganization.json()).resolves.toMatchObject({
      error_code: 'ORGANIZATION.NOT_FOUND',
    });

    const missingContext = await route.listWidgetsRoute(request('/api/widgets'));
    expect(missingContext.status).toBe(400);
    await expect(missingContext.json()).resolves.toMatchObject({
      error_code: 'ORGANIZATION.CONTEXT_REQUIRED',
    });
  });

  it('validates input like the API', async () => {
    process.env.MOCK_BFF_ENABLED = 'true';
    getSessionUser.mockResolvedValue(mockUser('demo-admin'));
    const route = await loadRoute();

    const missing = await create(route, {});
    expect(missing.status).toBe(422);
    await expect(missing.json()).resolves.toMatchObject({
      error_code: 'COMMON.VALIDATION_FAILED',
      errors: { name: ['The name field is required'] },
    });
    const unknown = await create(route, { name: 'Example', organization_id: 2 });
    expect(unknown.status).toBe(422);
    const blank = await create(route, { name: '   ' });
    expect(blank.status).toBe(400);
    const tooLong = await create(route, { name: 'x'.repeat(256) });
    expect(tooLong.status).toBe(422);

    const badId = await route.getWidgetRoute(
      request('/api/widgets/abc', { headers: organization() }),
      'abc'
    );
    expect(badId.status).toBe(400);
    await expect(badId.json()).resolves.toMatchObject({ error_code: 'COMMON.INVALID_INPUT' });
  });

  it('rejects cross-origin writes before authentication or body parsing', async () => {
    process.env.MOCK_BFF_ENABLED = 'true';
    const route = await loadRoute();

    const response = await route.createWidgetRoute(
      request('/api/widgets', {
        method: 'POST',
        body: '{',
        origin: 'https://evil.example',
        headers: organization(),
      })
    );

    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(getSessionUser).not.toHaveBeenCalled();
  });

  it('forwards only fixed production paths and bounded queries', async () => {
    process.env.API_ADAPTER_ENABLED = 'true';
    process.env.API_UPSTREAM_URL = 'https://api.example.com/v1';
    cookieStore.get.mockReturnValue({ value: 'A'.repeat(43) });
    fetchMock
      .mockResolvedValueOnce(
        Response.json({
          code: 0,
          message: 'success',
          data: [],
          meta: { current_page: 1, per_page: 100, total: 0, last_page: 1, from: 0, to: 0 },
          links: { first: '/a', last: '/a', prev: null, next: null },
        })
      )
      .mockResolvedValueOnce(
        Response.json(
          { code: 404, error_code: 'COMMON.NOT_FOUND', message: 'Resource not found' },
          { status: 404 }
        )
      );
    const route = await loadRoute();

    await route.listWidgetsRoute(
      request('/api/widgets?per_page=500&page=3&extra=1', { headers: organization() })
    );
    const missing = await route.updateWidgetRoute(
      request('/api/widgets/12', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Renamed' }),
        headers: organization(),
      }),
      '12'
    );

    const listURL = new URL(String(fetchMock.mock.calls[0][0]));
    expect(`${listURL.origin}${listURL.pathname}`).toBe('https://api.example.com/v1/widgets');
    expect(Object.fromEntries(listURL.searchParams)).toEqual({ page: '3', per_page: '100' });
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('organization-id')).toBe('1');
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://api.example.com/v1/widgets/12');
    expect(fetchMock.mock.calls[1][1]?.method).toBe('PUT');
    expect(missing.status).toBe(404);
  });
});

async function loadRoute(): Promise<WidgetRoute> {
  const route = await import('@/features/widget/server/widget-route');
  const store = await import('@/features/widget/server/mock-widget-store');
  store.mockWidgetStore.reset();
  return route;
}

function create(route: WidgetRoute, body: Record<string, unknown>) {
  return route.createWidgetRoute(
    request('/api/widgets', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: organization(),
    })
  );
}

function organization(id = '1'): Record<string, string> {
  return { 'Organization-Id': id };
}

function request(
  path: string,
  options: {
    method?: string;
    body?: string;
    origin?: string;
    headers?: Record<string, string>;
  } = {}
): Request {
  const result = new Request(`https://app.example.com${path}`, {
    method: options.method ?? 'GET',
    body: options.body,
    headers: options.headers,
  });
  if (options.body) result.headers.set('content-type', 'application/json');
  if (options.method && options.method !== 'GET') {
    result.headers.set('origin', options.origin ?? 'https://app.example.com');
    result.headers.set('sec-fetch-site', options.origin ? 'cross-site' : 'same-origin');
  }
  return result;
}

function mockUser(id: string) {
  return { id, email: `${id}@example.com`, name: id };
}

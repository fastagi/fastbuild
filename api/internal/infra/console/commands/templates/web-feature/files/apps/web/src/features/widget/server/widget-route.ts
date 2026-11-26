import 'server-only';

import { NextResponse } from 'next/server';

import { apiErrorResponse, apiJsonBodyErrorResponse } from '@/app/api/_shared/error-response';
import { readJsonBody } from '@/app/api/_shared/json-body';
import { guardSameOriginMutation } from '@/app/api/_shared/mock-bff';
import {
  apiNoContentResponse,
  apiPaginatedResponse,
  apiSuccessResponse,
} from '@/app/api/_shared/success-response';
import { env } from '@/config/env';
import { isWebFeatureEnabled } from '@/config/features';
import { isMockBffEnabled } from '@/config/mock-bff';
import { serverEnv } from '@/config/server-env';
import { getApiSessionToken } from '@/features/auth/server/api-session';
import { getSessionUser } from '@/features/auth/server/session';
import type { AuthUser } from '@/features/auth/types';
import { mockOrganizationStore } from '@/features/organization/server/mock-organization-store';
import { parseOrganizationId } from '@/features/organization/server/organization-route';
import type { OrganizationContext } from '@/features/organization/types';
import {
  WIDGET_NAME_MAX_LENGTH,
  WIDGET_PAGE_MAX_SIZE,
  widgetRouteIdSchema,
} from '@/features/widget/schemas';
import {
  mockWidgetStore,
  type MockWidgetWriteResult,
} from '@/features/widget/server/mock-widget-store';
import type { Widget } from '@/features/widget/types';
import { ApiErrorCode } from '@/http/codes';
import { forwardAuthenticatedGoApi } from '@/server/api-adapter/authenticated-route';
import { privateNoStoreHeaders, privateNoStoreResponse } from '@/server/http/private-response';

/**
 * Browser route boundary of the widget feature. Every handler selects the Go API adapter or the
 * development mock, requires the explicit `organization,widget` feature selection, and resolves
 * the active organization from `Organization-Id`. Writes check availability, then the browser
 * origin, then authentication, before reading a body. Organization membership and the owner/admin
 * write rule stay authoritative in the API; the mock reproduces them for development.
 */

type WidgetBackend = 'go-api' | 'mock';

interface WidgetRouteEnvironment {
  adapterEnabled: boolean;
  featureEnabled: boolean;
  mockBffEnabled: boolean;
  nodeEnv: 'development' | 'production' | 'test';
}

type WidgetRouteResolution =
  { available: true; backend: WidgetBackend } | { available: false; response: NextResponse };

type AuthenticatedWidgetBackend =
  | { authenticated: true; backend: 'go-api'; accessToken: string }
  | { authenticated: true; backend: 'mock'; user: AuthUser }
  | { authenticated: false; response: NextResponse };

type Authentication = Extract<AuthenticatedWidgetBackend, { authenticated: true }>;

type WidgetTarget =
  | { available: true; backend: 'go-api'; organizationId: number; accessToken: string }
  | { available: true; backend: 'mock'; organizationId: number; context: OrganizationContext }
  | { available: false; response: NextResponse };

type Parsed<T> = { ok: true; value: T } | { ok: false; response: NextResponse };

const defaultPerPage = 15;
const maxWidgetBodyBytes = 16 * 1_024;

export function resolveWidgetRoute(
  environment: WidgetRouteEnvironment = currentEnvironment()
): WidgetRouteResolution {
  if (!environment.featureEnabled) return unavailable('Widget Web feature is disabled');
  if (environment.adapterEnabled) return { available: true, backend: 'go-api' };
  if (isMockBffEnabled({ enabled: environment.mockBffEnabled, nodeEnv: environment.nodeEnv })) {
    return { available: true, backend: 'mock' };
  }
  return unavailable('Widget backend is unavailable');
}

export function privateWidgetResponse<T extends Response>(response: T): T {
  return privateNoStoreResponse(response, ['Cookie', 'Organization-Id']);
}

export async function listWidgetsRoute(request: Request): Promise<NextResponse> {
  const target = await resolveWidgetReadRoute(request);
  if (!target.available) return target.response;
  const query = new URL(request.url).searchParams;
  const page = positiveInteger(query.get('page'), 1);
  const perPage = Math.min(positiveInteger(query.get('per_page'), defaultPerPage), WIDGET_PAGE_MAX_SIZE);

  if (target.backend === 'go-api') {
    return forwardAuthenticatedGoApi(request, {
      method: 'GET',
      path: 'widgets',
      accessToken: target.accessToken,
      organizationId: String(target.organizationId),
      searchParams: new URLSearchParams({ page: String(page), per_page: String(perPage) }),
    });
  }
  const result = mockWidgetStore.list(target.organizationId, page, perPage);
  return apiPaginatedResponse(result.items, result.meta, result.links, privateWidgetHeaders());
}

export async function getWidgetRoute(request: Request, rawId: string): Promise<NextResponse> {
  const target = await resolveWidgetReadRoute(request);
  if (!target.available) return target.response;
  const widgetId = parseWidgetId(rawId);
  if (!widgetId.ok) return widgetId.response;

  if (target.backend === 'go-api') {
    return forwardAuthenticatedGoApi(request, {
      method: 'GET',
      path: `widgets/${widgetId.value}`,
      accessToken: target.accessToken,
      organizationId: String(target.organizationId),
    });
  }
  const widget = mockWidgetStore.get(target.organizationId, widgetId.value);
  return widget ? widgetResponse(widget) : widgetNotFound();
}

export async function createWidgetRoute(request: Request): Promise<NextResponse> {
  const target = await resolveWidgetMutationRoute(request);
  if (!target.available) return target.response;
  const manager = requireManager(target);
  if (manager) return manager;
  const input = await widgetBody(request, 'create');
  if (!input.ok) return input.response;

  if (target.backend === 'go-api') {
    return forwardAuthenticatedGoApi(request, {
      method: 'POST',
      path: 'widgets',
      accessToken: target.accessToken,
      organizationId: String(target.organizationId),
      body: input.value,
      fieldMap: { name: 'name' },
    });
  }
  const name = input.value.name?.trim() ?? '';
  if (name === '') return invalidInput('Invalid widget name');
  return mockWriteResponse(mockWidgetStore.create(target.organizationId, { name }), 201);
}

export async function updateWidgetRoute(request: Request, rawId: string): Promise<NextResponse> {
  const target = await resolveWidgetMutationRoute(request);
  if (!target.available) return target.response;
  const manager = requireManager(target);
  if (manager) return manager;
  const widgetId = parseWidgetId(rawId);
  if (!widgetId.ok) return widgetId.response;
  const input = await widgetBody(request, 'update');
  if (!input.ok) return input.response;

  if (target.backend === 'go-api') {
    return forwardAuthenticatedGoApi(request, {
      method: 'PUT',
      path: `widgets/${widgetId.value}`,
      accessToken: target.accessToken,
      organizationId: String(target.organizationId),
      body: input.value,
      fieldMap: { name: 'name' },
    });
  }
  const name = input.value.name?.trim();
  if (name === '') return invalidInput('Invalid widget name');
  return mockWriteResponse(
    mockWidgetStore.update(target.organizationId, widgetId.value, {
      ...(name === undefined ? {} : { name }),
    }),
    200
  );
}

export async function deleteWidgetRoute(request: Request, rawId: string): Promise<NextResponse> {
  const target = await resolveWidgetMutationRoute(request);
  if (!target.available) return target.response;
  const manager = requireManager(target);
  if (manager) return manager;
  const widgetId = parseWidgetId(rawId);
  if (!widgetId.ok) return widgetId.response;

  if (target.backend === 'go-api') {
    return forwardAuthenticatedGoApi(request, {
      method: 'DELETE',
      path: `widgets/${widgetId.value}`,
      accessToken: target.accessToken,
      organizationId: String(target.organizationId),
    });
  }
  return mockWidgetStore.delete(target.organizationId, widgetId.value)
    ? apiNoContentResponse(privateWidgetHeaders())
    : widgetNotFound();
}

/** Reads: feature availability, then authentication, then the organization context. */
async function resolveWidgetReadRoute(request: Request): Promise<WidgetTarget> {
  const resolution = resolveWidgetRoute();
  if (!resolution.available) return resolution;
  const authentication = await authenticateWidgetBackend(resolution.backend);
  if (!authentication.authenticated) return { available: false, response: authentication.response };
  return resolveOrganizationTarget(authentication, request);
}

/**
 * Writes: feature availability, then the same-origin check, then authentication, then the
 * organization context. Handlers read the body only after this resolves.
 */
async function resolveWidgetMutationRoute(request: Request): Promise<WidgetTarget> {
  const resolution = resolveWidgetRoute();
  if (!resolution.available) return resolution;
  const guard = guardSameOriginMutation(request);
  if (guard) return { available: false, response: privateWidgetResponse(guard) };
  const authentication = await authenticateWidgetBackend(resolution.backend);
  if (!authentication.authenticated) return { available: false, response: authentication.response };
  return resolveOrganizationTarget(authentication, request);
}

async function authenticateWidgetBackend(
  backend: WidgetBackend
): Promise<AuthenticatedWidgetBackend> {
  if (backend === 'go-api') {
    const accessToken = await getApiSessionToken();
    return accessToken
      ? { authenticated: true, backend, accessToken }
      : { authenticated: false, response: unauthenticated() };
  }
  const user = await getSessionUser();
  return user
    ? { authenticated: true, backend, user }
    : { authenticated: false, response: unauthenticated() };
}

function resolveOrganizationTarget(authentication: Authentication, request: Request): WidgetTarget {
  const rawOrganizationId = request.headers.get('organization-id');
  if (rawOrganizationId === null) {
    return organizationFailure(
      ApiErrorCode.ORGANIZATION_CONTEXT_REQUIRED,
      'Organization context is required'
    );
  }
  const organizationId = parseOrganizationId(rawOrganizationId);
  if (!organizationId) {
    return organizationFailure(
      ApiErrorCode.ORGANIZATION_CONTEXT_INVALID,
      'Organization context is invalid'
    );
  }
  if (authentication.backend === 'go-api') {
    return {
      available: true,
      backend: 'go-api',
      organizationId,
      accessToken: authentication.accessToken,
    };
  }
  const context = mockOrganizationStore.resolveContext(authentication.user, organizationId);
  if (!context) {
    return {
      available: false,
      response: apiErrorResponse({
        status: 404,
        errorCode: ApiErrorCode.ORGANIZATION_NOT_FOUND,
        message: 'Organization not found',
        headers: privateWidgetHeaders(),
      }),
    };
  }
  return { available: true, backend: 'mock', organizationId, context };
}

/** The mock enforces the API's owner/admin write rule; the API enforces it for the adapter. */
function requireManager(target: Extract<WidgetTarget, { available: true }>) {
  if (target.backend !== 'mock') return null;
  const role = target.context.role;
  return role === 'owner' || role === 'admin'
    ? null
    : apiErrorResponse({
        status: 403,
        errorCode: ApiErrorCode.PERMISSION_DENIED,
        message: 'Operation forbidden',
        headers: privateWidgetHeaders(),
      });
}

async function widgetBody(
  request: Request,
  mode: 'create' | 'update'
): Promise<Parsed<{ name?: string }>> {
  const payload = await readJsonBody(request, maxWidgetBodyBytes);
  if (!payload.ok) {
    return { ok: false, response: privateWidgetResponse(apiJsonBodyErrorResponse(payload.error)) };
  }
  const value = payload.data;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, response: invalidInput('Malformed JSON body') };
  }
  const fields = value as Record<string, unknown>;
  const errors: Record<string, string[]> = {};
  for (const key of Object.keys(fields)) {
    if (key !== 'name') errors[key] = ['The field is not allowed'];
  }
  const { name } = fields;
  if (name === undefined) {
    if (mode === 'create') errors.name = ['The name field is required'];
  } else if (
    typeof name !== 'string' ||
    (mode === 'create' && name === '') ||
    name.length > WIDGET_NAME_MAX_LENGTH
  ) {
    errors.name = ['The name field is invalid'];
  }
  if (Object.keys(errors).length > 0) return { ok: false, response: validationFailed(errors) };
  return { ok: true, value: typeof name === 'string' ? { name } : {} };
}

function parseWidgetId(value: string): Parsed<number> {
  const parsed = widgetRouteIdSchema.safeParse(value);
  const id = parsed.success ? Number(parsed.data) : Number.NaN;
  return Number.isSafeInteger(id)
    ? { ok: true, value: id }
    : { ok: false, response: invalidInput('Invalid widget ID') };
}

/** Mirrors the API: a missing or malformed number uses the fallback. */
function positiveInteger(value: string | null, fallback: number): number {
  if (value === null || !/^[1-9]\d{0,8}$/u.test(value)) return fallback;
  return Number(value);
}

function mockWriteResponse(result: MockWidgetWriteResult, status: 200 | 201): NextResponse {
  if (result.ok) return widgetResponse(result.widget, status);
  return result.error === 'capacity'
    ? unavailableResponse('Mock widget store is full')
    : widgetNotFound();
}

function widgetResponse(widget: Widget, status = 200): NextResponse {
  return apiSuccessResponse(widget, { status, headers: privateWidgetHeaders() });
}

function currentEnvironment(): WidgetRouteEnvironment {
  return {
    adapterEnabled: serverEnv.API_ADAPTER_ENABLED,
    featureEnabled: isWebFeatureEnabled('widget'),
    mockBffEnabled: serverEnv.MOCK_BFF_ENABLED,
    nodeEnv: env.NODE_ENV,
  };
}

function privateWidgetHeaders(): Headers {
  return privateNoStoreHeaders(undefined, ['Cookie', 'Organization-Id']);
}

function organizationFailure(
  errorCode:
    | typeof ApiErrorCode.ORGANIZATION_CONTEXT_REQUIRED
    | typeof ApiErrorCode.ORGANIZATION_CONTEXT_INVALID,
  message: string
): WidgetTarget {
  return {
    available: false,
    response: apiErrorResponse({
      status: 400,
      errorCode,
      message,
      headers: privateWidgetHeaders(),
    }),
  };
}

function invalidInput(message: string): NextResponse {
  return apiErrorResponse({
    status: 400,
    errorCode: ApiErrorCode.COMMON_INVALID_INPUT,
    message,
    headers: privateWidgetHeaders(),
  });
}

function validationFailed(errors: Record<string, string[]>): NextResponse {
  return apiErrorResponse({
    status: 422,
    errorCode: ApiErrorCode.COMMON_VALIDATION_FAILED,
    message: 'Validation failed',
    errors,
    headers: privateWidgetHeaders(),
  });
}

function widgetNotFound(): NextResponse {
  return apiErrorResponse({
    status: 404,
    errorCode: ApiErrorCode.COMMON_NOT_FOUND,
    message: 'Widget not found',
    headers: privateWidgetHeaders(),
  });
}

function unauthenticated(): NextResponse {
  return apiErrorResponse({
    status: 401,
    errorCode: ApiErrorCode.AUTH_UNAUTHORIZED,
    message: 'Authentication required',
    headers: privateWidgetHeaders(),
  });
}

function unavailableResponse(message: string): NextResponse {
  return apiErrorResponse({
    status: 503,
    errorCode: ApiErrorCode.COMMON_SERVICE_UNAVAILABLE,
    message,
    headers: privateWidgetHeaders(),
  });
}

function unavailable(message: string): WidgetRouteResolution {
  return {
    available: false,
    response: apiErrorResponse({
      status: 503,
      errorCode: ApiErrorCode.COMMON_SERVICE_UNAVAILABLE,
      message,
      headers: new Headers({ 'cache-control': 'no-store', pragma: 'no-cache' }),
    }),
  };
}

import {
  ApiError,
  CLIENT_ERROR_CODES,
  ERROR_CODES,
  isUnauthorizedError,
  normalizeApiError,
} from '@fastbuild/core';
import type {
  ApiVersionHealth,
  AuthenticationLoginRequest,
  AuthenticationLogoutData,
  AuthenticationMFAChallenge,
  AuthenticationMFAChallengeVerifyRequest,
  AuthenticationMFACodeRequest,
  AuthenticationMFADisable,
  AuthenticationMFAStatus,
  AuthenticationMFATOTPEnroll,
  AuthenticationMFATOTPVerify,
  AuthenticationRegisterRequest,
  AuthenticationSession,
  AuthenticationSSOOIDCCallbackRequest,
  AuthenticationSSOOIDCStart,
  AuthenticationSSOOIDCStartRequest,
  AuthenticationSSOProviderSummary,
  AuthenticationUser,
  HealthReport,
  NativeAuthenticationSession,
  OperatorSystemStatus,
  UserProfileUpdateRequest,
} from './types.ts';

export type AuthMode = 'cookie' | 'bearer';
export type HttpMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';
export type ResponseMode = 'envelope' | 'raw' | 'void';

export interface AuthTokenPair {
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresAt?: number;
}

export interface TokenStore {
  getTokens(): AuthTokenPair | null | Promise<AuthTokenPair | null>;
  setTokens(tokens: AuthTokenPair): void | Promise<void>;
  clearTokens(): void | Promise<void>;
}

export class MemoryTokenStore implements TokenStore {
  private tokens: AuthTokenPair | null = null;

  getTokens(): AuthTokenPair | null {
    return this.tokens;
  }

  setTokens(tokens: AuthTokenPair): void {
    this.tokens = tokens;
  }

  clearTokens(): void {
    this.tokens = null;
  }
}

export interface RequestOptions {
  readonly headers?: HeadersInit;
  readonly responseMode?: ResponseMode;
  readonly signal?: AbortSignal;
  readonly skipAuth?: boolean;
  readonly timeoutMs?: number;
}

export interface FastBuildClientOptions {
  readonly baseUrl: string;
  readonly authMode?: AuthMode;
  readonly tokenStore?: TokenStore;
  readonly refreshPath?: string;
  readonly refreshTokens?: (
    refreshToken: string,
  ) => Promise<AuthTokenPair | null>;
  readonly getCsrfToken?: () => string | undefined;
  readonly onCsrfRejected?: () => Promise<void>;
  readonly onUnauthorized?: (error: ApiError) => void | Promise<void>;
  readonly defaultHeaders?: HeadersInit;
  readonly timeoutMs?: number;
  readonly maxResponseBytes?: number;
  readonly fetch?: typeof globalThis.fetch;
}

export interface FastBuildClient {
  request<T>(
    path: string,
    options: RequestOptions & { readonly method: HttpMethod; readonly body?: unknown },
  ): Promise<T>;
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  delete<T>(path: string, options?: RequestOptions): Promise<T>;
  readonly health: {
    check(): Promise<HealthReport>;
    v1(): Promise<ApiVersionHealth>;
  };
  readonly auth: {
    login(
      payload: AuthenticationLoginRequest,
      path?: string,
    ): Promise<AuthenticationSession | NativeAuthenticationSession>;
    register(payload: AuthenticationRegisterRequest): Promise<AuthenticationUser>;
    logout(path?: string): Promise<AuthenticationLogoutData>;
    readonly mfa: {
      status(): Promise<AuthenticationMFAStatus>;
      enrollTotp(): Promise<AuthenticationMFATOTPEnroll>;
      verifyTotp(payload: AuthenticationMFACodeRequest): Promise<AuthenticationMFATOTPVerify>;
      disableTotp(payload: AuthenticationMFACodeRequest): Promise<AuthenticationMFADisable>;
      verifyChallenge(
        payload: AuthenticationMFAChallengeVerifyRequest,
      ): Promise<AuthenticationSession | NativeAuthenticationSession>;
    };
    readonly sso: {
      providers(): Promise<readonly AuthenticationSSOProviderSummary[]>;
      startOidc(payload: AuthenticationSSOOIDCStartRequest): Promise<AuthenticationSSOOIDCStart>;
      callbackOidc(
        payload: AuthenticationSSOOIDCCallbackRequest,
      ): Promise<AuthenticationSession | AuthenticationMFAChallenge>;
    };
  };
  readonly user: {
    profile(): Promise<AuthenticationUser>;
    updateProfile(payload: UserProfileUpdateRequest): Promise<AuthenticationUser>;
    deleteAccount(): Promise<void>;
  };
  readonly system: {
    status(path?: string): Promise<OperatorSystemStatus>;
  };
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const DEFAULT_REFRESH_PATH = '/v1/auth/native/refresh';

function isUnsafeMethod(method: HttpMethod): boolean {
  return method !== 'GET';
}

function buildUrl(baseUrl: string, path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new ApiError(
      'HTTP request paths must be root-relative',
      CLIENT_ERROR_CODES.FETCH_ERROR,
    );
  }
  return `${baseUrl.replace(/\/+$/, '')}${path}`;
}

async function readResponsePayload(
  response: Response,
  maxBytes: number,
  responseMode: ResponseMode,
): Promise<unknown> {
  if (response.status === 204 || responseMode === 'void') {
    return undefined;
  }

  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ApiError(
      'Response exceeded the client safety limit',
      CLIENT_ERROR_CODES.INVALID_RESPONSE,
      { status: response.status },
    );
  }

  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new ApiError(
      'Response exceeded the client safety limit',
      CLIENT_ERROR_CODES.INVALID_RESPONSE,
      { status: response.status },
    );
  }

  if (!text) {
    return null;
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('json')) {
    throw new ApiError(
      'API returned a non-JSON response',
      CLIENT_ERROR_CODES.INVALID_RESPONSE,
      { status: response.status },
    );
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (cause) {
    throw new ApiError(
      'API returned malformed JSON',
      CLIENT_ERROR_CODES.INVALID_RESPONSE,
      { status: response.status, cause },
    );
  }
}

function unwrapEnvelope<T>(payload: unknown, responseMode: ResponseMode): T {
  if (responseMode === 'void') {
    return undefined as T;
  }
  if (responseMode === 'raw') {
    return payload as T;
  }
  if (
    !payload ||
    typeof payload !== 'object' ||
    (payload as Record<string, unknown>).code !== 0 ||
    !Object.prototype.hasOwnProperty.call(payload, 'data')
  ) {
    throw new ApiError(
      'API returned an invalid success envelope',
      CLIENT_ERROR_CODES.INVALID_RESPONSE,
    );
  }
  return (payload as { data: T }).data;
}

function tokensFromSession(
  session: AuthenticationSession | NativeAuthenticationSession,
): AuthTokenPair {
  const refreshToken =
    'refresh_token' in session && typeof session.refresh_token === 'string'
      ? session.refresh_token
      : undefined;
  const expiresAt =
    typeof session.expires_in === 'number' && session.expires_in > 0
      ? Date.now() + session.expires_in * 1000
      : undefined;

  return {
    accessToken: session.access_token,
    ...(refreshToken !== undefined ? { refreshToken } : {}),
    ...(expiresAt !== undefined ? { expiresAt } : {}),
  };
}

export function createFastBuildClient(options: FastBuildClientOptions): FastBuildClient {
  const authMode: AuthMode = options.authMode ?? 'cookie';
  const tokenStore = options.tokenStore;
  const refreshPath = options.refreshPath ?? DEFAULT_REFRESH_PATH;
  const defaultTimeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  const fetchImpl = options.fetch ?? globalThis.fetch;

  let inflightRefresh: Promise<AuthTokenPair | null> | null = null;

  async function sendOnce<T>(
    path: string,
    req: RequestOptions & { readonly method: HttpMethod; readonly body?: unknown },
    accessTokenOverride?: string,
  ): Promise<T> {
    const controller = new AbortController();
    let timedOut = false;
    const timeoutMs = req.timeoutMs ?? defaultTimeoutMs;
    const timer = globalThis.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    const onExternalAbort = () => controller.abort(req.signal?.reason);
    if (req.signal?.aborted) {
      onExternalAbort();
    } else {
      req.signal?.addEventListener('abort', onExternalAbort, { once: true });
    }

    const headers = new Headers(options.defaultHeaders);
    if (req.headers) {
      new Headers(req.headers).forEach((value, key) => headers.set(key, value));
    }
    headers.set('Accept', 'application/json');
    if (req.body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    if (authMode === 'cookie' && isUnsafeMethod(req.method)) {
      const csrf = options.getCsrfToken?.();
      if (csrf) {
        headers.set('X-CSRF-Token', csrf);
      }
    }

    if (authMode === 'bearer' && !req.skipAuth) {
      const token =
        accessTokenOverride ?? (tokenStore ? (await tokenStore.getTokens())?.accessToken : undefined);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    const responseMode = req.responseMode ?? 'envelope';

    try {
      const init: RequestInit = {
        method: req.method,
        headers,
        credentials: authMode === 'cookie' ? 'include' : 'omit',
        signal: controller.signal,
      };
      if (req.body !== undefined) {
        init.body = JSON.stringify(req.body);
      }

      const response = await fetchImpl(buildUrl(options.baseUrl, path), init);
      const payload = await readResponsePayload(
        response,
        maxResponseBytes,
        response.ok ? responseMode : 'raw',
      );

      if (!response.ok) {
        const requestId = response.headers.get('x-request-id') ?? undefined;
        throw normalizeApiError(payload, response.status, requestId);
      }

      return unwrapEnvelope<T>(payload, responseMode);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (controller.signal.aborted) {
        throw new ApiError(
          timedOut ? 'Request timed out' : 'Request was cancelled',
          timedOut ? CLIENT_ERROR_CODES.TIMEOUT : CLIENT_ERROR_CODES.CANCELLED,
          { cause: error },
        );
      }
      throw new ApiError('Unable to reach the API', CLIENT_ERROR_CODES.NETWORK_ERROR, {
        cause: error,
      });
    } finally {
      globalThis.clearTimeout(timer);
      req.signal?.removeEventListener('abort', onExternalAbort);
    }
  }

  async function refreshBearerTokens(): Promise<AuthTokenPair | null> {
    if (!tokenStore) {
      return null;
    }
    if (inflightRefresh) {
      return inflightRefresh;
    }

    inflightRefresh = (async () => {
      const current = await tokenStore.getTokens();
      if (!current?.refreshToken) {
        await tokenStore.clearTokens();
        return null;
      }

      try {
        let nextTokens: AuthTokenPair | null;
        if (options.refreshTokens) {
          nextTokens = await options.refreshTokens(current.refreshToken);
        } else {
          const refreshed = await sendOnce<NativeAuthenticationSession>(refreshPath, {
            method: 'POST',
            body: { refresh_token: current.refreshToken },
            skipAuth: true,
          });
          nextTokens = tokensFromSession(refreshed);
        }

        if (!nextTokens?.accessToken) {
          await tokenStore.clearTokens();
          return null;
        }
        await tokenStore.setTokens(nextTokens);
        return nextTokens;
      } catch {
        await tokenStore.clearTokens();
        return null;
      } finally {
        inflightRefresh = null;
      }
    })();

    return inflightRefresh;
  }

  async function request<T>(
    path: string,
    req: RequestOptions & { readonly method: HttpMethod; readonly body?: unknown },
  ): Promise<T> {
    try {
      return await sendOnce<T>(path, req);
    } catch (error) {
      if (
        authMode === 'cookie' &&
        isUnsafeMethod(req.method) &&
        options.onCsrfRejected &&
        error instanceof ApiError &&
        error.errorCode === ERROR_CODES.OPERATOR_CSRF_REJECTED
      ) {
        await options.onCsrfRejected();
        return sendOnce<T>(path, req);
      }

      if (
        authMode === 'bearer' &&
        !req.skipAuth &&
        path !== refreshPath &&
        isUnauthorizedError(error)
      ) {
        const refreshed = await refreshBearerTokens();
        if (refreshed) {
          return sendOnce<T>(path, req, refreshed.accessToken);
        }
        if (error instanceof ApiError) {
          await options.onUnauthorized?.(error);
        }
      } else if (isUnauthorizedError(error) && error instanceof ApiError) {
        await options.onUnauthorized?.(error);
      }

      throw error;
    }
  }

  const client: FastBuildClient = {
    request,
    get: <T>(path: string, req: RequestOptions = {}) =>
      request<T>(path, { ...req, method: 'GET' }),
    post: <T>(path: string, body?: unknown, req: RequestOptions = {}) =>
      request<T>(path, { ...req, method: 'POST', body }),
    put: <T>(path: string, body?: unknown, req: RequestOptions = {}) =>
      request<T>(path, { ...req, method: 'PUT', body }),
    patch: <T>(path: string, body?: unknown, req: RequestOptions = {}) =>
      request<T>(path, { ...req, method: 'PATCH', body }),
    delete: <T>(path: string, req: RequestOptions = {}) =>
      request<T>(path, { ...req, method: 'DELETE' }),

    health: {
      check: () => request<HealthReport>('/health', { method: 'GET', responseMode: 'raw', skipAuth: true }),
      v1: () => request<ApiVersionHealth>('/v1/health', { method: 'GET', responseMode: 'raw', skipAuth: true }),
    },

    auth: {
      async login(payload, path = '/v1/login') {
        const session = await request<AuthenticationSession | NativeAuthenticationSession>(path, {
          method: 'POST',
          body: payload,
          skipAuth: true,
        });
        if (authMode === 'bearer' && tokenStore && session?.access_token) {
          await tokenStore.setTokens(tokensFromSession(session));
        }
        return session;
      },
      register: (payload) =>
        request<AuthenticationUser>('/v1/register', {
          method: 'POST',
          body: payload,
          skipAuth: true,
        }),
      async logout(path = '/v1/logout') {
        try {
          return await request<AuthenticationLogoutData>(path, { method: 'POST' });
        } finally {
          if (authMode === 'bearer' && tokenStore) {
            await tokenStore.clearTokens();
          }
        }
      },
      mfa: {
        status: () =>
          request<AuthenticationMFAStatus>('/v1/auth/mfa/status', { method: 'GET' }),
        enrollTotp: () =>
          request<AuthenticationMFATOTPEnroll>('/v1/auth/mfa/totp/enroll', { method: 'POST' }),
        verifyTotp: (payload) =>
          request<AuthenticationMFATOTPVerify>('/v1/auth/mfa/totp/verify', {
            method: 'POST',
            body: payload,
          }),
        disableTotp: (payload) =>
          request<AuthenticationMFADisable>('/v1/auth/mfa/totp/disable', {
            method: 'POST',
            body: payload,
          }),
        async verifyChallenge(payload) {
          const session = await request<AuthenticationSession | NativeAuthenticationSession>(
            '/v1/auth/mfa/challenge/verify',
            {
              method: 'POST',
              body: payload,
              skipAuth: true,
            },
          );
          if (authMode === 'bearer' && tokenStore && session?.access_token) {
            await tokenStore.setTokens(tokensFromSession(session));
          }
          return session;
        },
      },
      sso: {
        providers: () =>
          request<readonly AuthenticationSSOProviderSummary[]>('/v1/auth/sso/providers', {
            method: 'GET',
            skipAuth: true,
          }),
        startOidc: (payload) =>
          request<AuthenticationSSOOIDCStart>('/v1/auth/sso/oidc/start', {
            method: 'POST',
            body: payload,
            skipAuth: true,
          }),
        async callbackOidc(payload) {
          const result = await request<AuthenticationSession | AuthenticationMFAChallenge>(
            '/v1/auth/sso/oidc/callback',
            {
              method: 'POST',
              body: payload,
              skipAuth: true,
            },
          );
          if (
            authMode === 'bearer' &&
            tokenStore &&
            'access_token' in result &&
            typeof result.access_token === 'string' &&
            result.access_token
          ) {
            await tokenStore.setTokens(tokensFromSession(result));
          }
          return result;
        },
      },
    },

    user: {
      profile: () => request<AuthenticationUser>('/v1/users/profile', { method: 'GET' }),
      updateProfile: (payload) =>
        request<AuthenticationUser>('/v1/users/profile', { method: 'PUT', body: payload }),
      deleteAccount: () =>
        request<void>('/v1/users/account', { method: 'DELETE', responseMode: 'void' }),
    },

    system: {
      status: (path = '/v1/operator/system') =>
        request<OperatorSystemStatus>(path, { method: 'GET' }),
    },
  };

  return client;
}

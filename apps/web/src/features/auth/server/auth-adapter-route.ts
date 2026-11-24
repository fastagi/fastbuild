import 'server-only';

import { headers } from 'next/headers';
import type { NextResponse } from 'next/server';

import { apiErrorResponse } from '@/app/api/_shared/error-response';
import { apiSuccessResponse } from '@/app/api/_shared/success-response';
import { serverEnv } from '@/config/server-env';
import type {
  AuthBootstrap,
  LoginRequest,
  MfaChallengeVerifyRequest,
  RegisterRequest,
  SsoOidcCallbackRequest,
  SsoOidcStartRequest,
} from '@/features/auth/types';
import { isMfaChallengeResponse } from '@/features/auth/utils/auth-response';
import {
  clearApiSessionCookie,
  getApiSessionToken,
  setApiSessionCookie,
} from '@/features/auth/server/api-session';
import { privateAuthResponse } from '@/features/auth/server/auth-response';
import {
  type AdapterError,
  GoApiAuthAdapter,
} from '@/features/auth/server/go-api-auth-adapter';
import { clearSessionCookie } from '@/features/auth/server/session';
import { ApiErrorCode } from '@/http/codes';

let adapter: GoApiAuthAdapter | undefined;

function configuredAdapter(): GoApiAuthAdapter {
  if (!serverEnv.API_UPSTREAM_URL) {
    throw new Error('API_UPSTREAM_URL is required by the production API adapter');
  }

  adapter ??= new GoApiAuthAdapter({
    apiUrl: serverEnv.API_UPSTREAM_URL,
    timeoutMs: serverEnv.API_UPSTREAM_TIMEOUT_MS,
    maxResponseBytes: serverEnv.API_UPSTREAM_MAX_RESPONSE_BYTES,
    clientIpHeader: serverEnv.API_CLIENT_IP_HEADER,
  });
  return adapter;
}

function adapterErrorResponse(error: AdapterError): NextResponse {
  return privateAuthResponse(
    apiErrorResponse({
      status: error.status,
      errorCode: error.errorCode,
      message: error.message,
      errors: error.fieldErrors,
      headers: error.responseHeaders,
      requestId: error.requestId,
    })
  );
}

export async function loginWithGoApi(
  request: Request,
  input: LoginRequest
): Promise<NextResponse> {
  const result = await configuredAdapter().login(
    input,
    request.headers,
    request.signal
  );

  if (!result.ok) {
    return adapterErrorResponse(result.error);
  }

  if (isMfaChallengeResponse(result.data)) {
    return privateAuthResponse(apiSuccessResponse(result.data));
  }

  await clearSessionCookie();
  await setApiSessionCookie(
    result.data.accessToken,
    result.data.maxAgeSeconds
  );

  return privateAuthResponse(apiSuccessResponse({ user: result.data.user }));
}

export async function registerWithGoApi(
  request: Request,
  input: RegisterRequest
): Promise<NextResponse> {
  const result = await configuredAdapter().register(
    input,
    request.headers,
    request.signal
  );

  if (!result.ok) {
    return adapterErrorResponse(result.error);
  }

  if (isMfaChallengeResponse(result.data)) {
    return privateAuthResponse(apiSuccessResponse(result.data));
  }

  await clearSessionCookie();
  await setApiSessionCookie(
    result.data.accessToken,
    result.data.maxAgeSeconds
  );

  return privateAuthResponse(apiSuccessResponse({ user: result.data.user }));
}

export async function currentGoApiSession(
  incomingHeaders: Headers,
  signal?: AbortSignal
) {
  const accessToken = await getApiSessionToken();
  if (!accessToken) {
    return {
      ok: false as const,
      error: {
        status: 401,
        errorCode: ApiErrorCode.AUTH_UNAUTHORIZED,
        message: 'Authentication required',
      } satisfies AdapterError,
    };
  }

  return configuredAdapter().profile(accessToken, incomingHeaders, signal);
}

export async function getCurrentGoApiSession(
  request: Request
): Promise<NextResponse> {
  const result = await currentGoApiSession(request.headers, request.signal);

  if (!result.ok) {
    if (result.error.status === 401) {
      await clearApiSessionCookie();
    }
    return adapterErrorResponse(result.error);
  }

  return privateAuthResponse(apiSuccessResponse(result.data));
}

export async function logoutFromGoApi(request: Request): Promise<NextResponse> {
  const accessToken = await getApiSessionToken();
  let result: Awaited<ReturnType<GoApiAuthAdapter['logout']>> | undefined;

  try {
    if (accessToken) {
      result = await configuredAdapter().logout(
        accessToken,
        request.headers,
        request.signal
      );
    }
  } finally {
    await clearApiSessionCookie();
    await clearSessionCookie();
  }

  if (
    result &&
    !result.ok &&
    result.error.status !== 401
  ) {
    return adapterErrorResponse(result.error);
  }

  return privateAuthResponse(apiSuccessResponse({ success: true as const }));
}

export async function resolveGoApiAuthBootstrap(): Promise<AuthBootstrap> {
  const incomingHeaders = new Headers(await headers());
  const result = await currentGoApiSession(incomingHeaders);

  if (result.ok) {
    return { status: 'authenticated', user: result.data.user };
  }
  if (
    result.error.errorCode === ApiErrorCode.AUTH_FORBIDDEN ||
    result.error.errorCode === ApiErrorCode.AUTH_ACCOUNT_DISABLED ||
    result.error.status === 403
  ) {
    return { status: 'forbidden' };
  }
  if (
    result.error.errorCode === ApiErrorCode.AUTH_UNAUTHORIZED ||
    result.error.status === 401
  ) {
    return { status: 'unauthenticated' };
  }

  return { status: 'unavailable' };
}

async function requireApiSessionToken(): Promise<
  { ok: true; accessToken: string } | { ok: false; response: NextResponse }
> {
  const accessToken = await getApiSessionToken();
  if (!accessToken) {
    return {
      ok: false,
      response: adapterErrorResponse({
        status: 401,
        errorCode: ApiErrorCode.AUTH_UNAUTHORIZED,
        message: 'Authentication required',
      }),
    };
  }
  return { ok: true, accessToken };
}

export async function getMfaStatusWithGoApi(
  request: Request
): Promise<NextResponse> {
  const token = await requireApiSessionToken();
  if (!token.ok) {
    return token.response;
  }

  const result = await configuredAdapter().mfaStatus(
    token.accessToken,
    request.headers,
    request.signal
  );
  if (!result.ok) {
    return adapterErrorResponse(result.error);
  }
  return privateAuthResponse(apiSuccessResponse(result.data));
}

export async function enrollMfaTotpWithGoApi(
  request: Request
): Promise<NextResponse> {
  const token = await requireApiSessionToken();
  if (!token.ok) {
    return token.response;
  }

  const result = await configuredAdapter().enrollMfaTotp(
    token.accessToken,
    request.headers,
    request.signal
  );
  if (!result.ok) {
    return adapterErrorResponse(result.error);
  }
  return privateAuthResponse(apiSuccessResponse(result.data));
}

export async function verifyMfaTotpWithGoApi(
  request: Request,
  code: string
): Promise<NextResponse> {
  const token = await requireApiSessionToken();
  if (!token.ok) {
    return token.response;
  }

  const result = await configuredAdapter().verifyMfaTotp(
    token.accessToken,
    code,
    request.headers,
    request.signal
  );
  if (!result.ok) {
    return adapterErrorResponse(result.error);
  }
  return privateAuthResponse(apiSuccessResponse(result.data));
}

export async function disableMfaTotpWithGoApi(
  request: Request,
  code: string
): Promise<NextResponse> {
  const token = await requireApiSessionToken();
  if (!token.ok) {
    return token.response;
  }

  const result = await configuredAdapter().disableMfaTotp(
    token.accessToken,
    code,
    request.headers,
    request.signal
  );
  if (!result.ok) {
    return adapterErrorResponse(result.error);
  }
  return privateAuthResponse(apiSuccessResponse(result.data));
}

export async function verifyMfaChallengeWithGoApi(
  request: Request,
  input: MfaChallengeVerifyRequest
): Promise<NextResponse> {
  const result = await configuredAdapter().verifyMfaChallenge(
    input,
    request.headers,
    request.signal
  );
  if (!result.ok) {
    return adapterErrorResponse(result.error);
  }

  await clearSessionCookie();
  await setApiSessionCookie(
    result.data.accessToken,
    result.data.maxAgeSeconds
  );

  return privateAuthResponse(apiSuccessResponse({ user: result.data.user }));
}

export async function listSsoProvidersWithGoApi(
  request: Request
): Promise<NextResponse> {
  const result = await configuredAdapter().listSsoProviders(
    request.headers,
    request.signal
  );
  if (!result.ok) {
    return adapterErrorResponse(result.error);
  }
  return privateAuthResponse(apiSuccessResponse(result.data));
}

export async function startSsoOidcWithGoApi(
  request: Request,
  input: SsoOidcStartRequest
): Promise<NextResponse> {
  const result = await configuredAdapter().startSsoOidc(
    input,
    request.headers,
    request.signal
  );
  if (!result.ok) {
    return adapterErrorResponse(result.error);
  }
  return privateAuthResponse(apiSuccessResponse(result.data));
}

export async function callbackSsoOidcWithGoApi(
  request: Request,
  input: SsoOidcCallbackRequest
): Promise<NextResponse> {
  const result = await configuredAdapter().callbackSsoOidc(
    input,
    request.headers,
    request.signal
  );
  if (!result.ok) {
    return adapterErrorResponse(result.error);
  }

  if (isMfaChallengeResponse(result.data)) {
    return privateAuthResponse(apiSuccessResponse(result.data));
  }

  await clearSessionCookie();
  await setApiSessionCookie(
    result.data.accessToken,
    result.data.maxAgeSeconds
  );

  return privateAuthResponse(apiSuccessResponse({ user: result.data.user }));
}

import {
  createFastBuildClient,
  type AuthenticationLoginRequest,
  type AuthenticationSession,
  type AuthenticationUser,
  type FastBuildClient,
  type HealthReport,
  type NativeAuthenticationSession,
  type TokenStore,
} from '@fastbuild/api-client';
import {
  ApiError,
  DEFAULT_MESSAGES,
  ERROR_CODES,
  I18N_KEYS,
  errorCodeToMessageKey,
  isApiError,
  isUnauthorizedError,
  validateEmail,
  validatePassword,
  validateUsername,
} from '@fastbuild/core';
import { normalizeApiBaseUrl } from '../config/env';

export const NATIVE_LOGIN_PATH = '/v1/auth/native/login' as const;
export const NATIVE_REFRESH_PATH = '/v1/auth/native/refresh' as const;
export const NATIVE_LOGOUT_PATH = '/v1/auth/native/logout' as const;

export interface MobileClientConfig {
  readonly baseUrl: string;
  readonly tokenStore: TokenStore;
  readonly onUnauthorized?: (error: ApiError) => void | Promise<void>;
  readonly fetch?: typeof globalThis.fetch;
  readonly timeoutMs?: number;
}

/**
 * Creates a FastBuild API client configured for native mobile bearer-token auth
 * with rotating refresh tokens at `/v1/auth/native/refresh`.
 */
export function createMobileApiClient(config: MobileClientConfig): FastBuildClient {
  return createFastBuildClient({
    baseUrl: normalizeApiBaseUrl(config.baseUrl),
    authMode: 'bearer',
    tokenStore: config.tokenStore,
    refreshPath: NATIVE_REFRESH_PATH,
    ...(config.onUnauthorized ? { onUnauthorized: config.onUnauthorized } : {}),
    ...(config.fetch ? { fetch: config.fetch } : {}),
    ...(config.timeoutMs !== undefined ? { timeoutMs: config.timeoutMs } : {}),
  });
}

const VALIDATION_MESSAGES: Readonly<Record<string, string>> = {
  'auth.validation.email_required': 'Please enter your email address.',
  'auth.validation.email_invalid': 'Please enter a valid email address.',
  'auth.validation.username_too_short': 'Username must be at least 3 characters.',
  'auth.validation.username_too_long': 'Username must be 50 characters or fewer.',
  'auth.validation.username_no_at': 'Username cannot contain @ unless signing in with an email.',
  'auth.validation.password_required': 'Please enter your password.',
  'auth.validation.password_too_short': 'Password must be at least 6 characters.',
  'auth.validation.password_too_long': 'Password must be 50 characters or fewer.',
};

export interface SignInValidationResult {
  readonly valid: boolean;
  readonly identifierError?: string;
  readonly passwordError?: string;
}

/**
 * Validates sign-in credentials using `@fastbuild/core` rules.
 * Accepts either an email address or a username as the identifier.
 */
export function validateSignInInput(identifier: string, password: string): SignInValidationResult {
  const trimmed = identifier.trim();
  const idCheck = trimmed.includes('@') ? validateEmail(trimmed) : validateUsername(trimmed);
  const passwordCheck = validatePassword(password);

  const identifierError =
    !idCheck.valid && idCheck.reason
      ? (VALIDATION_MESSAGES[idCheck.reason] ?? 'Please enter a valid username or email.')
      : undefined;
  const passwordError =
    !passwordCheck.valid && passwordCheck.reason
      ? (VALIDATION_MESSAGES[passwordCheck.reason] ?? 'Please enter a valid password.')
      : undefined;

  return {
    valid: idCheck.valid && passwordCheck.valid,
    ...(identifierError ? { identifierError } : {}),
    ...(passwordError ? { passwordError } : {}),
  };
}

/**
 * Maps an `ApiError` (or unknown error) to reviewed local user-facing copy
 * via `@fastbuild/core` i18n keys rather than rendering raw backend text.
 */
export function mapApiErrorToMessage(error: unknown): string {
  if (isApiError(error)) {
    const key = errorCodeToMessageKey(error.errorCode);
    return DEFAULT_MESSAGES[key] ?? DEFAULT_MESSAGES[I18N_KEYS.common.unknownError]!;
  }
  return DEFAULT_MESSAGES[I18N_KEYS.common.unknownError]!;
}

/**
 * Signs in via `/v1/auth/native/login` and persists rotating bearer tokens.
 */
export async function signInNative(
  client: FastBuildClient,
  payload: AuthenticationLoginRequest,
): Promise<AuthenticationSession | NativeAuthenticationSession> {
  return client.auth.login(payload, NATIVE_LOGIN_PATH);
}

/**
 * Restores an existing native session if tokens are stored.
 * Automatically triggers rotating refresh on 401 via `@fastbuild/api-client`.
 */
export async function restoreNativeSession(
  client: FastBuildClient,
  tokenStore: TokenStore,
): Promise<AuthenticationUser | null> {
  const tokens = await tokenStore.getTokens();
  if (!tokens?.accessToken) {
    return null;
  }

  try {
    return await client.user.profile();
  } catch (error) {
    if (isUnauthorizedError(error)) {
      await tokenStore.clearTokens();
      return null;
    }
    throw error;
  }
}

/**
 * Signs out via `/v1/auth/native/logout` and clears stored tokens even if the
 * remote call fails (e.g., offline or expired token).
 */
export async function signOutNative(
  client: FastBuildClient,
  tokenStore: TokenStore,
): Promise<void> {
  try {
    await client.auth.logout(NATIVE_LOGOUT_PATH);
  } catch (error) {
    if (
      isApiError(error) &&
      (error.errorCode === ERROR_CODES.AUTH_UNAUTHORIZED ||
        error.errorCode === ERROR_CODES.AUTH_REFRESH_TOKEN_EXPIRED ||
        error.errorCode === ERROR_CODES.AUTH_REFRESH_TOKEN_INVALID)
    ) {
      // Session already expired on server; local token cleanup is sufficient.
      return;
    }
    await tokenStore.clearTokens();
  }
}

/**
 * Queries `/health` without requiring authentication.
 */
export async function fetchApiHealth(client: FastBuildClient): Promise<HealthReport> {
  return client.health.check();
}

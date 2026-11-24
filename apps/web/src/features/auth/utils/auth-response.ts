import type {
  AuthResponse,
  LoginResult,
  LogoutResponse,
  MfaChallengeResponse,
  MfaStatusResponse,
  MfaTotpDisableResponse,
  MfaTotpEnrollResponse,
  MfaTotpVerifyResponse,
  SsoOidcStartResponse,
  SsoProviderSummary,
} from '@/features/auth/types';
import { isAuthUser } from '@/features/auth/utils/auth-user';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isAuthResponse(value: unknown): value is AuthResponse {
  return isRecord(value) && isAuthUser(value.user);
}

export function isMfaChallengeResponse(value: unknown): value is MfaChallengeResponse {
  return (
    isRecord(value) &&
    value.mfa_required === true &&
    isNonEmptyString(value.challenge_token) &&
    typeof value.challenge_expires_in === 'number' &&
    value.challenge_expires_in > 0 &&
    isNonEmptyString(value.method)
  );
}

export function isLoginResult(value: unknown): value is LoginResult {
  return isAuthResponse(value) || isMfaChallengeResponse(value);
}

export function isLogoutResponse(value: unknown): value is LogoutResponse {
  return isRecord(value) && value.success === true;
}

export function isMfaStatusResponse(value: unknown): value is MfaStatusResponse {
  return (
    isRecord(value) &&
    typeof value.enabled === 'boolean' &&
    typeof value.method === 'string' &&
    typeof value.remaining_recovery_codes === 'number' &&
    value.remaining_recovery_codes >= 0 &&
    (value.enrolled_at === undefined || typeof value.enrolled_at === 'string')
  );
}

export function isMfaTotpEnrollResponse(value: unknown): value is MfaTotpEnrollResponse {
  return (
    isRecord(value) &&
    isNonEmptyString(value.secret) &&
    isNonEmptyString(value.otpauth_uri) &&
    isNonEmptyString(value.issuer) &&
    isNonEmptyString(value.account_name)
  );
}

export function isMfaTotpVerifyResponse(value: unknown): value is MfaTotpVerifyResponse {
  return (
    isRecord(value) &&
    value.enabled === true &&
    Array.isArray(value.recovery_codes) &&
    value.recovery_codes.every(code => isNonEmptyString(code))
  );
}

export function isMfaTotpDisableResponse(value: unknown): value is MfaTotpDisableResponse {
  return isRecord(value) && value.enabled === false;
}

export function isSsoProviderList(value: unknown): value is SsoProviderSummary[] {
  return (
    Array.isArray(value) &&
    value.every(
      item =>
        isRecord(item) && isNonEmptyString(item.slug) && isNonEmptyString(item.name)
    )
  );
}

export function isSsoOidcStartResponse(value: unknown): value is SsoOidcStartResponse {
  return (
    isRecord(value) &&
    isNonEmptyString(value.authorize_url) &&
    isNonEmptyString(value.state)
  );
}

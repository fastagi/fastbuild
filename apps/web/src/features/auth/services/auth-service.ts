import request from '@/http';
import type {
  AuthResponse,
  LoginRequest,
  LoginResult,
  LogoutResponse,
  MfaChallengeVerifyRequest,
  MfaCodeRequest,
  MfaStatusResponse,
  MfaTotpDisableResponse,
  MfaTotpEnrollResponse,
  MfaTotpVerifyResponse,
  RegisterRequest,
  SsoOidcCallbackRequest,
  SsoOidcStartRequest,
  SsoOidcStartResponse,
  SsoProviderSummary,
} from '@/features/auth/types';
import {
  isAuthResponse,
  isLoginResult,
  isLogoutResponse,
  isMfaStatusResponse,
  isMfaTotpDisableResponse,
  isMfaTotpEnrollResponse,
  isMfaTotpVerifyResponse,
  isSsoOidcStartResponse,
  isSsoProviderList,
} from '@/features/auth/utils/auth-response';
import { ClientErrorCode } from '@/http/codes';
import { ApiError } from '@/http/request';

async function validateResponse<T>(
  requestPromise: Promise<unknown>,
  isValid: (value: unknown) => value is T,
  contractName: string
): Promise<T> {
  const response = await requestPromise;

  if (!isValid(response)) {
    throw new ApiError(`Invalid ${contractName} response`, ClientErrorCode.INVALID_RESPONSE);
  }

  return response;
}

export const authService = {
  login: (data: LoginRequest) =>
    validateResponse<LoginResult>(
      request.post<unknown, LoginRequest>('/auth/login', data),
      isLoginResult,
      'login'
    ),

  register: (data: RegisterRequest) =>
    validateResponse<LoginResult>(
      request.post<unknown, RegisterRequest>('/auth/register', data),
      isLoginResult,
      'registration'
    ),

  me: () =>
    validateResponse<AuthResponse>(
      request.get<unknown>('/auth/me'),
      isAuthResponse,
      'current-session'
    ),

  logout: () =>
    validateResponse<LogoutResponse>(
      request.post<unknown, undefined>('/auth/logout'),
      isLogoutResponse,
      'logout'
    ),

  getMfaStatus: () =>
    validateResponse<MfaStatusResponse>(
      request.get<unknown>('/auth/mfa/status'),
      isMfaStatusResponse,
      'mfa-status'
    ),

  enrollMfaTotp: () =>
    validateResponse<MfaTotpEnrollResponse>(
      request.post<unknown, undefined>('/auth/mfa/totp/enroll'),
      isMfaTotpEnrollResponse,
      'mfa-totp-enroll'
    ),

  verifyMfaTotp: (data: MfaCodeRequest) =>
    validateResponse<MfaTotpVerifyResponse>(
      request.post<unknown, MfaCodeRequest>('/auth/mfa/totp/verify', data),
      isMfaTotpVerifyResponse,
      'mfa-totp-verify'
    ),

  disableMfaTotp: (data: MfaCodeRequest) =>
    validateResponse<MfaTotpDisableResponse>(
      request.post<unknown, MfaCodeRequest>('/auth/mfa/totp/disable', data),
      isMfaTotpDisableResponse,
      'mfa-totp-disable'
    ),

  verifyMfaChallenge: (data: MfaChallengeVerifyRequest) =>
    validateResponse<AuthResponse>(
      request.post<unknown, MfaChallengeVerifyRequest>('/auth/mfa/challenge/verify', data),
      isAuthResponse,
      'mfa-challenge-verify'
    ),

  listSsoProviders: () =>
    validateResponse<SsoProviderSummary[]>(
      request.get<unknown>('/auth/sso/providers'),
      isSsoProviderList,
      'sso-providers'
    ),

  startSsoOidc: (data: SsoOidcStartRequest) =>
    validateResponse<SsoOidcStartResponse>(
      request.post<unknown, SsoOidcStartRequest>('/auth/sso/oidc/start', data),
      isSsoOidcStartResponse,
      'sso-oidc-start'
    ),

  callbackSsoOidc: (data: SsoOidcCallbackRequest) =>
    validateResponse<LoginResult>(
      request.post<unknown, SsoOidcCallbackRequest>('/auth/sso/oidc/callback', data),
      isLoginResult,
      'sso-oidc-callback'
    ),
};

export type AuthService = typeof authService;

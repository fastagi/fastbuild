export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Serializable result passed from a protected Server Component to its
 * request-scoped client auth store.
 */
export type AuthBootstrap =
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'unauthenticated' }
  | { status: 'forbidden' }
  | { status: 'unavailable' }
  | { status: 'client-required' };

export type AuthStatus =
  | 'idle'
  | 'loading'
  | 'authenticated'
  | 'unauthenticated'
  | 'forbidden'
  | 'unavailable';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUser;
}

export interface MfaChallengeResponse {
  mfa_required: true;
  challenge_token: string;
  challenge_expires_in: number;
  method: string;
}

export type LoginResult = AuthResponse | MfaChallengeResponse;

export interface LogoutResponse {
  success: true;
}

export interface MfaStatusResponse {
  enabled: boolean;
  method: string;
  remaining_recovery_codes: number;
  enrolled_at?: string;
}

export interface MfaTotpEnrollResponse {
  secret: string;
  otpauth_uri: string;
  issuer: string;
  account_name: string;
}

export interface MfaCodeRequest {
  code: string;
}

export interface MfaTotpVerifyResponse {
  enabled: true;
  recovery_codes: string[];
}

export interface MfaTotpDisableResponse {
  enabled: false;
}

export interface MfaChallengeVerifyRequest {
  challenge_token: string;
  code: string;
}

export interface SsoProviderSummary {
  slug: string;
  name: string;
}

export interface SsoOidcStartRequest {
  provider: string;
  redirect_uri?: string;
}

export interface SsoOidcStartResponse {
  authorize_url: string;
  state: string;
}

export interface SsoOidcCallbackRequest {
  provider: string;
  code: string;
  state: string;
}

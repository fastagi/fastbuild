/**
 * Shared FastBuild HTTP envelope and domain DTO types aligned with
 * `packages/contracts/openapi.yaml` and `packages/contracts/README.md`.
 */

export interface ApiSuccessEnvelope<T> {
  readonly code: 0;
  readonly message: string;
  readonly data: T;
}

export interface PaginationMeta {
  readonly current_page: number;
  readonly per_page: number;
  readonly total: number;
  readonly last_page: number;
  readonly from: number;
  readonly to: number;
}

export interface PaginationLinks {
  readonly first: string;
  readonly last: string;
  readonly prev: string | null;
  readonly next: string | null;
}

export interface ApiPaginatedEnvelope<T> extends ApiSuccessEnvelope<readonly T[]> {
  readonly meta: PaginationMeta;
  readonly links: PaginationLinks;
}

export interface CursorPageMeta {
  readonly per_page: number;
  readonly has_more: boolean;
  readonly next_cursor: string | null;
}

export interface ApiCursorEnvelope<T> extends ApiSuccessEnvelope<readonly T[]> {
  readonly meta: CursorPageMeta;
}

export interface ApiErrorEnvelope {
  readonly code: number;
  readonly error_code: string;
  readonly message: string;
  readonly error?: string;
  readonly errors?: Readonly<Record<string, readonly string[]>>;
  readonly request_id?: string;
}

/* --- Health --- */

export type HealthStatus = 'up' | 'degraded' | 'down';

export interface HealthCheckResult {
  readonly status: HealthStatus;
  readonly message?: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly latency_ms: number;
  readonly timestamp: string;
}

export interface HealthReport {
  readonly status: HealthStatus;
  readonly timestamp: string;
  readonly checks?: Readonly<Record<string, HealthCheckResult>>;
}

export interface HealthLivenessProbe {
  readonly status: 'up';
}

export interface HealthReadinessProbe {
  readonly status: 'up' | 'degraded';
}

export interface ApiVersionHealth {
  readonly status: 'ok';
  readonly version: 'v1';
}

/* --- Authentication & User --- */

/** 0 disabled, 1 active, 2 pending, 3 banned. */
export type UserStatus = 0 | 1 | 2 | 3;

export interface AuthenticationUser {
  readonly id: number;
  readonly username: string;
  readonly email: string;
  readonly nickname?: string;
  readonly avatar?: string;
  readonly phone?: string;
  readonly bio?: string;
  readonly status: UserStatus;
  readonly last_login?: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface AuthenticationLoginRequest {
  readonly username: string;
  readonly password: string;
}

export interface AuthenticationSession {
  readonly access_token: string;
  readonly token_type: 'Bearer';
  readonly expires_in: number;
  readonly user: AuthenticationUser;
}

export interface NativeAuthenticationSession extends AuthenticationSession {
  readonly refresh_token: string;
  readonly refresh_expires_in?: number;
}

export interface NativeRefreshRequest {
  readonly refresh_token: string;
}

export interface AuthenticationRegisterRequest {
  readonly username: string;
  readonly password: string;
  readonly email: string;
  readonly nickname?: string;
  readonly phone?: string;
}

export interface AuthenticationPasswordResetRequest {
  readonly email: string;
}

export interface AuthenticationPasswordResetConfirmRequest {
  readonly token: string;
  readonly new_password: string;
}

export interface AuthenticationLogoutData {
  readonly success: boolean;
}

export interface UserProfileUpdateRequest {
  readonly nickname?: string;
  readonly avatar?: string;
  readonly phone?: string;
  readonly bio?: string;
}

export interface UserChangePasswordRequest {
  readonly old_password: string;
  readonly new_password: string;
}

/* --- MFA (TOTP + Recovery Codes) --- */

export interface AuthenticationMFAChallenge {
  readonly mfa_required: true;
  readonly challenge_token: string;
  readonly challenge_expires_in: number;
  readonly method: 'totp';
}

export interface AuthenticationMFAStatus {
  readonly enabled: boolean;
  readonly method: string;
  readonly remaining_recovery_codes: number;
  readonly enrolled_at?: string;
}

export interface AuthenticationMFATOTPEnroll {
  readonly secret: string;
  readonly otpauth_uri: string;
  readonly issuer: string;
  readonly account_name: string;
}

export interface AuthenticationMFACodeRequest {
  readonly code: string;
}

export interface AuthenticationMFATOTPVerify {
  readonly enabled: true;
  readonly recovery_codes: readonly string[];
}

export interface AuthenticationMFADisable {
  readonly enabled: false;
}

export interface AuthenticationMFAChallengeVerifyRequest {
  readonly challenge_token: string;
  readonly code: string;
}

/* --- Enterprise SSO (OIDC) --- */

export interface AuthenticationSSOProviderSummary {
  readonly slug: string;
  readonly name: string;
}

export interface AuthenticationSSOOIDCStartRequest {
  readonly provider: string;
  readonly redirect_uri?: string;
}

export interface AuthenticationSSOOIDCStart {
  readonly authorize_url: string;
  readonly state: string;
}

export interface AuthenticationSSOOIDCCallbackRequest {
  readonly provider: string;
  readonly code: string;
  readonly state: string;
}

/* --- System --- */

export interface OperatorSystemStatus {
  readonly version: string;
  readonly revision: string;
  readonly go_version: string;
  readonly starters: readonly string[];
  readonly database: 'ok' | 'unavailable';
}

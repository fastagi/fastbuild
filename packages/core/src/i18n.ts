import { CLIENT_ERROR_CODES, ERROR_CODES } from './errors.ts';

/**
 * Shared i18n message keys for auth, common actions, status labels, and error copy.
 * UI layers map `error_code` to reviewed local copy rather than rendering raw backend text.
 */

export const I18N_KEYS = {
  auth: {
    signIn: 'auth.sign_in',
    signOut: 'auth.sign_out',
    register: 'auth.register',
    email: 'auth.email',
    username: 'auth.username',
    password: 'auth.password',
    invalidCredentials: 'auth.error.invalid_credentials',
    accountDisabled: 'auth.error.account_disabled',
    sessionExpired: 'auth.error.session_expired',
    forbidden: 'auth.error.forbidden',
  },
  common: {
    loading: 'common.loading',
    retry: 'common.retry',
    save: 'common.save',
    cancel: 'common.cancel',
    confirm: 'common.confirm',
    delete: 'common.delete',
    unknownError: 'common.error.unknown',
    networkError: 'common.error.network',
    timeoutError: 'common.error.timeout',
    rateLimited: 'common.error.rate_limited',
    notFound: 'common.error.not_found',
    validationFailed: 'common.error.validation_failed',
    serviceUnavailable: 'common.error.service_unavailable',
  },
  status: {
    up: 'status.up',
    degraded: 'status.degraded',
    down: 'status.down',
    active: 'status.active',
    disabled: 'status.disabled',
    pending: 'status.pending',
    banned: 'status.banned',
  },
} as const;

export const DEFAULT_MESSAGES: Readonly<Record<string, string>> = {
  [I18N_KEYS.auth.signIn]: 'Sign in',
  [I18N_KEYS.auth.signOut]: 'Sign out',
  [I18N_KEYS.auth.register]: 'Create account',
  [I18N_KEYS.auth.email]: 'Email',
  [I18N_KEYS.auth.username]: 'Username',
  [I18N_KEYS.auth.password]: 'Password',
  [I18N_KEYS.auth.invalidCredentials]: 'Invalid username or password.',
  [I18N_KEYS.auth.accountDisabled]: 'This account has been disabled.',
  [I18N_KEYS.auth.sessionExpired]: 'Your session has expired. Please sign in again.',
  [I18N_KEYS.auth.forbidden]: 'You do not have permission to perform this action.',

  [I18N_KEYS.common.loading]: 'Loading...',
  [I18N_KEYS.common.retry]: 'Retry',
  [I18N_KEYS.common.save]: 'Save',
  [I18N_KEYS.common.cancel]: 'Cancel',
  [I18N_KEYS.common.confirm]: 'Confirm',
  [I18N_KEYS.common.delete]: 'Delete',
  [I18N_KEYS.common.unknownError]: 'Something went wrong. Please try again.',
  [I18N_KEYS.common.networkError]: 'Unable to reach the server. Check your connection.',
  [I18N_KEYS.common.timeoutError]: 'The request timed out. Please try again.',
  [I18N_KEYS.common.rateLimited]: 'Too many requests. Please wait a moment and try again.',
  [I18N_KEYS.common.notFound]: 'The requested resource was not found.',
  [I18N_KEYS.common.validationFailed]: 'Please check the highlighted fields and try again.',
  [I18N_KEYS.common.serviceUnavailable]: 'The service is temporarily unavailable.',

  [I18N_KEYS.status.up]: 'Operational',
  [I18N_KEYS.status.degraded]: 'Degraded',
  [I18N_KEYS.status.down]: 'Unavailable',
  [I18N_KEYS.status.active]: 'Active',
  [I18N_KEYS.status.disabled]: 'Disabled',
  [I18N_KEYS.status.pending]: 'Pending',
  [I18N_KEYS.status.banned]: 'Banned',
};

const ERROR_CODE_TO_KEY: Readonly<Record<string, string>> = {
  [ERROR_CODES.AUTH_INVALID_CREDENTIALS]: I18N_KEYS.auth.invalidCredentials,
  [ERROR_CODES.AUTH_ACCOUNT_DISABLED]: I18N_KEYS.auth.accountDisabled,
  [ERROR_CODES.AUTH_UNAUTHORIZED]: I18N_KEYS.auth.sessionExpired,
  [ERROR_CODES.AUTH_REFRESH_TOKEN_INVALID]: I18N_KEYS.auth.sessionExpired,
  [ERROR_CODES.AUTH_REFRESH_TOKEN_EXPIRED]: I18N_KEYS.auth.sessionExpired,
  [ERROR_CODES.AUTH_FORBIDDEN]: I18N_KEYS.auth.forbidden,
  [ERROR_CODES.OPERATOR_FORBIDDEN]: I18N_KEYS.auth.forbidden,
  [ERROR_CODES.COMMON_VALIDATION_FAILED]: I18N_KEYS.common.validationFailed,
  [ERROR_CODES.COMMON_RATE_LIMITED]: I18N_KEYS.common.rateLimited,
  [ERROR_CODES.COMMON_NOT_FOUND]: I18N_KEYS.common.notFound,
  [ERROR_CODES.COMMON_TIMEOUT]: I18N_KEYS.common.timeoutError,
  [ERROR_CODES.COMMON_SERVICE_UNAVAILABLE]: I18N_KEYS.common.serviceUnavailable,
  [CLIENT_ERROR_CODES.NETWORK_ERROR]: I18N_KEYS.common.networkError,
  [CLIENT_ERROR_CODES.TIMEOUT]: I18N_KEYS.common.timeoutError,
};

export function errorCodeToMessageKey(errorCode: string): string {
  return ERROR_CODE_TO_KEY[errorCode] ?? I18N_KEYS.common.unknownError;
}

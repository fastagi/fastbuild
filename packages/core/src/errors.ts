/**
 * Canonical FastBuild HTTP error codes and normalized ApiError representation.
 * Aligned with `packages/contracts/README.md` and `packages/contracts/openapi.yaml`.
 */

export type ApiFieldErrors = Record<string, string[]>;

export const ERROR_CODES = {
  COMMON_INTERNAL: 'COMMON.INTERNAL',
  COMMON_INVALID_INPUT: 'COMMON.INVALID_INPUT',
  COMMON_VALIDATION_FAILED: 'COMMON.VALIDATION_FAILED',
  COMMON_RATE_LIMITED: 'COMMON.RATE_LIMITED',
  COMMON_REQUEST_TOO_LARGE: 'COMMON.REQUEST_TOO_LARGE',
  COMMON_TIMEOUT: 'COMMON.TIMEOUT',
  COMMON_SERVICE_UNAVAILABLE: 'COMMON.SERVICE_UNAVAILABLE',
  COMMON_NOT_FOUND: 'COMMON.NOT_FOUND',
  COMMON_CONFLICT: 'COMMON.CONFLICT',

  AUTH_UNAUTHORIZED: 'AUTH.UNAUTHORIZED',
  AUTH_FORBIDDEN: 'AUTH.FORBIDDEN',
  AUTH_INVALID_CREDENTIALS: 'AUTH.INVALID_CREDENTIALS',
  AUTH_ACCOUNT_DISABLED: 'AUTH.ACCOUNT_DISABLED',
  AUTH_PASSWORD_RESET_TOKEN_INVALID: 'AUTH.PASSWORD_RESET_TOKEN_INVALID',
  AUTH_PASSWORD_RESET_TOKEN_EXPIRED: 'AUTH.PASSWORD_RESET_TOKEN_EXPIRED',
  AUTH_REFRESH_TOKEN_INVALID: 'AUTH.REFRESH_TOKEN_INVALID',
  AUTH_REFRESH_TOKEN_EXPIRED: 'AUTH.REFRESH_TOKEN_EXPIRED',

  USER_NOT_FOUND: 'USER.NOT_FOUND',
  USER_EMAIL_ALREADY_EXISTS: 'USER.EMAIL_ALREADY_EXISTS',
  USER_USERNAME_ALREADY_EXISTS: 'USER.USERNAME_ALREADY_EXISTS',

  OPERATOR_FORBIDDEN: 'OPERATOR.FORBIDDEN',
  OPERATOR_ORIGIN_REJECTED: 'OPERATOR.ORIGIN_REJECTED',
  OPERATOR_CSRF_REJECTED: 'OPERATOR.CSRF_REJECTED',
  OPERATOR_TARGET_PROTECTED: 'OPERATOR.TARGET_PROTECTED',
} as const;

export type ErrorCodeValue = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const CLIENT_ERROR_CODES = {
  CANCELLED: 'CLIENT.CANCELLED',
  FETCH_ERROR: 'CLIENT.FETCH_ERROR',
  INVALID_RESPONSE: 'CLIENT.INVALID_RESPONSE',
  NETWORK_ERROR: 'CLIENT.NETWORK_ERROR',
  TIMEOUT: 'CLIENT.TIMEOUT',
} as const;

export type ClientErrorCodeValue =
  (typeof CLIENT_ERROR_CODES)[keyof typeof CLIENT_ERROR_CODES];

export const HTTP_STATUS_ERROR_CODES: Readonly<Record<number, ErrorCodeValue>> = {
  400: ERROR_CODES.COMMON_INVALID_INPUT,
  401: ERROR_CODES.AUTH_UNAUTHORIZED,
  403: ERROR_CODES.AUTH_FORBIDDEN,
  404: ERROR_CODES.COMMON_NOT_FOUND,
  409: ERROR_CODES.COMMON_CONFLICT,
  413: ERROR_CODES.COMMON_REQUEST_TOO_LARGE,
  422: ERROR_CODES.COMMON_VALIDATION_FAILED,
  429: ERROR_CODES.COMMON_RATE_LIMITED,
  500: ERROR_CODES.COMMON_INTERNAL,
  503: ERROR_CODES.COMMON_SERVICE_UNAVAILABLE,
};

const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9]*(?:\.[A-Z][A-Z0-9_]*)+$/;

export function isErrorCode(value: unknown): value is string {
  return typeof value === 'string' && ERROR_CODE_PATTERN.test(value);
}

export interface ApiErrorOptions {
  readonly status?: number;
  readonly requestId?: string;
  readonly fieldErrors?: ApiFieldErrors;
  readonly cause?: unknown;
}

export class ApiError extends Error {
  readonly errorCode: string;
  readonly status?: number;
  readonly requestId?: string;
  readonly fieldErrors?: ApiFieldErrors;

  constructor(message: string, errorCode: string, options: ApiErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'ApiError';
    this.errorCode = errorCode;
    if (options.status !== undefined) {
      this.status = options.status;
    }
    if (options.requestId !== undefined) {
      this.requestId = options.requestId;
    }
    if (options.fieldErrors !== undefined) {
      this.fieldErrors = options.fieldErrors;
    }
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

export function isUnauthorizedError(value: unknown): boolean {
  if (!isApiError(value)) {
    return false;
  }
  return (
    value.status === 401 ||
    value.errorCode === ERROR_CODES.AUTH_UNAUTHORIZED ||
    value.errorCode === ERROR_CODES.AUTH_REFRESH_TOKEN_INVALID ||
    value.errorCode === ERROR_CODES.AUTH_REFRESH_TOKEN_EXPIRED
  );
}

function extractFieldErrors(raw: unknown): ApiFieldErrors | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  const entries = Object.entries(raw as Record<string, unknown>).filter(
    (entry): entry is [string, string[]] =>
      Array.isArray(entry[1]) && entry[1].every((item) => typeof item === 'string'),
  );
  if (entries.length === 0) {
    return undefined;
  }
  return Object.fromEntries(entries);
}

/**
 * Normalizes any thrown value or raw HTTP error envelope into an `ApiError`.
 */
export function normalizeApiError(
  input: unknown,
  fallbackStatus?: number,
  fallbackRequestId?: string,
): ApiError {
  if (isApiError(input)) {
    return input;
  }

  if (input && typeof input === 'object') {
    const record = input as Record<string, unknown>;
    const status =
      typeof record.code === 'number' && record.code >= 400 && record.code <= 599
        ? record.code
        : typeof record.status === 'number'
          ? record.status
          : fallbackStatus;

    const rawCode = isErrorCode(record.error_code)
      ? record.error_code
      : isErrorCode(record.errorCode)
        ? record.errorCode
        : isErrorCode(record.code)
          ? record.code
          : status !== undefined
            ? HTTP_STATUS_ERROR_CODES[status]
            : undefined;

    const errorCode = rawCode ?? CLIENT_ERROR_CODES.FETCH_ERROR;

    const message =
      typeof record.message === 'string' && record.message.trim().length > 0
        ? record.message.trim()
        : typeof record.error === 'string' && record.error.trim().length > 0
          ? record.error.trim()
          : status !== undefined
            ? `Request failed with HTTP ${status}`
            : 'Unexpected error';

    const requestId =
      typeof record.request_id === 'string' && record.request_id.trim().length > 0
        ? record.request_id.trim()
        : typeof record.requestId === 'string' && record.requestId.trim().length > 0
          ? record.requestId.trim()
          : fallbackRequestId;

    const fieldErrors = extractFieldErrors(record.errors ?? record.fieldErrors);

    return new ApiError(message, errorCode, {
      ...(status !== undefined ? { status } : {}),
      ...(requestId !== undefined ? { requestId } : {}),
      ...(fieldErrors !== undefined ? { fieldErrors } : {}),
      ...(input instanceof Error ? { cause: input } : {}),
    });
  }

  const message = typeof input === 'string' && input.trim() ? input.trim() : 'Unexpected error';
  const errorCode =
    fallbackStatus !== undefined
      ? (HTTP_STATUS_ERROR_CODES[fallbackStatus] ?? CLIENT_ERROR_CODES.FETCH_ERROR)
      : CLIENT_ERROR_CODES.FETCH_ERROR;

  return new ApiError(message, errorCode, {
    ...(fallbackStatus !== undefined ? { status: fallbackStatus } : {}),
    ...(fallbackRequestId !== undefined ? { requestId: fallbackRequestId } : {}),
  });
}

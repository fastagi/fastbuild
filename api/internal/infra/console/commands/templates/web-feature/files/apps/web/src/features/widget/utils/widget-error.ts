import { ApiErrorCode, ClientErrorCode } from '@/http/codes';
import { ApiError } from '@/http/request';

export type WidgetErrorKey =
  | 'errors.forbidden'
  | 'errors.generic'
  | 'errors.invalid'
  | 'errors.invalidResponse'
  | 'errors.notFound'
  | 'errors.organizationUnavailable'
  | 'errors.unavailable';

/** Maps a failure to stable local copy; backend message text is never shown. */
export function resolveWidgetErrorKey(error: unknown): WidgetErrorKey {
  if (!(error instanceof ApiError)) return 'errors.generic';
  if (error.errorCode === ClientErrorCode.INVALID_RESPONSE) return 'errors.invalidResponse';
  if (
    error.errorCode === ClientErrorCode.NETWORK_ERROR ||
    error.errorCode === ClientErrorCode.TIMEOUT ||
    error.errorCode === ApiErrorCode.COMMON_TIMEOUT ||
    error.errorCode === ApiErrorCode.COMMON_SERVICE_UNAVAILABLE
  ) {
    return 'errors.unavailable';
  }
  if (
    error.errorCode === ApiErrorCode.AUTH_FORBIDDEN ||
    error.errorCode === ApiErrorCode.PERMISSION_DENIED
  ) {
    return 'errors.forbidden';
  }
  if (
    error.errorCode === ApiErrorCode.ORGANIZATION_NOT_FOUND ||
    error.errorCode === ApiErrorCode.ORGANIZATION_CONTEXT_REQUIRED ||
    error.errorCode === ApiErrorCode.ORGANIZATION_CONTEXT_INVALID
  ) {
    return 'errors.organizationUnavailable';
  }
  if (error.errorCode === ApiErrorCode.COMMON_NOT_FOUND) return 'errors.notFound';
  if (
    error.errorCode === ApiErrorCode.COMMON_INVALID_INPUT ||
    error.errorCode === ApiErrorCode.COMMON_VALIDATION_FAILED
  ) {
    return 'errors.invalid';
  }
  return 'errors.generic';
}

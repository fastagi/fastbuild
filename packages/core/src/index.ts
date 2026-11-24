export {
  ApiError,
  CLIENT_ERROR_CODES,
  ERROR_CODES,
  HTTP_STATUS_ERROR_CODES,
  isApiError,
  isErrorCode,
  isUnauthorizedError,
  normalizeApiError,
  type ApiErrorOptions,
  type ApiFieldErrors,
  type ClientErrorCodeValue,
  type ErrorCodeValue,
} from './errors.ts';
export { DEFAULT_MESSAGES, errorCodeToMessageKey, I18N_KEYS } from './i18n.ts';
export {
  isValidEmail,
  isValidSlug,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  SLUG_MAX_LENGTH,
  toSlug,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  validateEmail,
  validatePassword,
  validateUsername,
  type ValidationResult,
} from './validation.ts';

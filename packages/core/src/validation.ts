/**
 * Platform-neutral validation helpers aligned with FastBuild OpenAPI contracts.
 */

export interface ValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 50;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 50;
export const SLUG_MAX_LENGTH = 64;

export function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 254 && EMAIL_PATTERN.test(trimmed);
}

export function validateEmail(value: string): ValidationResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return { valid: false, reason: 'auth.validation.email_required' };
  }
  if (!isValidEmail(trimmed)) {
    return { valid: false, reason: 'auth.validation.email_invalid' };
  }
  return { valid: true };
}

export function validatePassword(
  value: string,
  options: { minLength?: number; maxLength?: number } = {},
): ValidationResult {
  const min = options.minLength ?? PASSWORD_MIN_LENGTH;
  const max = options.maxLength ?? PASSWORD_MAX_LENGTH;

  if (!value) {
    return { valid: false, reason: 'auth.validation.password_required' };
  }
  if (value.length < min) {
    return { valid: false, reason: 'auth.validation.password_too_short' };
  }
  if (value.length > max) {
    return { valid: false, reason: 'auth.validation.password_too_long' };
  }
  return { valid: true };
}

export function validateUsername(value: string): ValidationResult {
  const trimmed = value.trim();
  if (trimmed.length < USERNAME_MIN_LENGTH) {
    return { valid: false, reason: 'auth.validation.username_too_short' };
  }
  if (trimmed.length > USERNAME_MAX_LENGTH) {
    return { valid: false, reason: 'auth.validation.username_too_long' };
  }
  if (trimmed.includes('@')) {
    return { valid: false, reason: 'auth.validation.username_no_at' };
  }
  return { valid: true };
}

export function isValidSlug(value: string): boolean {
  return value.length > 0 && value.length <= SLUG_MAX_LENGTH && SLUG_PATTERN.test(value);
}

export function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, '');
}

export const DEFAULT_API_BASE_URL = 'http://localhost:8080';

/**
 * Normalizes a user- or environment-supplied API base URL by trimming
 * whitespace and trailing slashes. Falls back to `DEFAULT_API_BASE_URL`.
 */
export function normalizeApiBaseUrl(raw?: string | null): string {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) {
    return DEFAULT_API_BASE_URL;
  }
  return trimmed.replace(/\/+$/, '');
}

/**
 * Resolves the initial API base URL from Expo public env variables or
 * `DEFAULT_API_BASE_URL`.
 */
export function getInitialApiBaseUrl(): string {
  const envUrl =
    typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_API_BASE_URL : undefined;
  return normalizeApiBaseUrl(envUrl);
}

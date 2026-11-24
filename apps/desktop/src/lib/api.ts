import {
  createFastBuildClient,
  type FastBuildClient,
  type TokenStore,
} from '@fastbuild/api-client';
import type { ApiError } from '@fastbuild/core';

export const DEFAULT_API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || 'http://127.0.0.1:8025';

export const NATIVE_AUTH_PATHS = {
  login: '/v1/auth/native/login',
  refresh: '/v1/auth/native/refresh',
  logout: '/v1/auth/native/logout',
} as const;

const API_BASE_URL_STORAGE_KEY = 'fastbuild.desktop.apiBaseUrl';

export function normalizeApiBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('API base URL is required.');
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Enter a valid http:// or https:// API base URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('API base URL must use http:// or https://.');
  }
  return parsed.toString().replace(/\/+$/, '');
}

export function loadSavedApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_API_BASE_URL;
  }
  try {
    const saved = window.localStorage.getItem(API_BASE_URL_STORAGE_KEY);
    if (!saved) {
      return DEFAULT_API_BASE_URL;
    }
    return normalizeApiBaseUrl(saved);
  } catch {
    return DEFAULT_API_BASE_URL;
  }
}

export function saveApiBaseUrl(url: string): string {
  const normalized = normalizeApiBaseUrl(url);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(API_BASE_URL_STORAGE_KEY, normalized);
  }
  return normalized;
}

export interface CreateDesktopClientOptions {
  readonly baseUrl: string;
  readonly tokenStore: TokenStore;
  readonly onUnauthorized?: (error: ApiError) => void | Promise<void>;
  readonly fetch?: typeof globalThis.fetch;
}

export function createDesktopApiClient(options: CreateDesktopClientOptions): FastBuildClient {
  return createFastBuildClient({
    baseUrl: options.baseUrl,
    authMode: 'bearer',
    tokenStore: options.tokenStore,
    refreshPath: NATIVE_AUTH_PATHS.refresh,
    ...(options.onUnauthorized ? { onUnauthorized: options.onUnauthorized } : {}),
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
}

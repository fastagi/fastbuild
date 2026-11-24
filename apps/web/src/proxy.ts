import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { authConfig } from '@/config/auth';
import { isDevtoolsEnabled, isDevtoolsPath } from '@/config/devtools';
import { getMockSessionCookieName } from '@/config/mock-session';
import { getAuthRuntimeMode } from '@/features/auth/server/auth-runtime';
import { verifySession } from '@/lib/session-signing';

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isProtectedPath(pathname: string): boolean {
  return authConfig.protectedRoutes.some(route => matchesPrefix(pathname, route));
}

function isPublicOnlyPath(pathname: string): boolean {
  return authConfig.publicOnlyRoutes.some(route => matchesPrefix(pathname, route));
}

/**
 * Verify the mock session before protected render work begins.
 *
 * This is navigation defense in depth for mock-session mode. Route Handlers,
 * Server Actions, and the Go API remain the authorization boundaries.
 */
async function hasValidSession(request: NextRequest): Promise<boolean> {
  const raw = request.cookies.get(getMockSessionCookieName())?.value;
  if (!raw) return false;
  const payload = await verifySession(raw);
  if (!payload) return false;
  try {
    const obj = JSON.parse(payload) as { exp?: number };
    return typeof obj.exp === 'number' && obj.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

/**
 * Unmatched internal path; rewriting to it renders the app's not-found page
 * with a 404 status.
 */
const DEVTOOLS_DISABLED_PATH = '/_devtools-disabled';

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Disabled devtools 404 before any auth redirect or render work, so they
  // neither reveal themselves nor stream page content. The route group layout
  // repeats the check as defense in depth.
  if (!isDevtoolsEnabled() && isDevtoolsPath(pathname)) {
    return NextResponse.rewrite(new URL(DEVTOOLS_DISABLED_PATH, request.url));
  }

  if (getAuthRuntimeMode() !== 'mock-session') {
    return NextResponse.next();
  }

  const valid = await hasValidSession(request);

  if (!valid && isProtectedPath(pathname)) {
    const loginUrl = new URL(authConfig.routes.login, request.url);
    loginUrl.searchParams.set('returnUrl', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (valid && isPublicOnlyPath(pathname)) {
    return NextResponse.redirect(new URL(authConfig.routes.afterLogin, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/console/:path*', '/styleguide/:path*', '/i18n-test/:path*', '/login', '/register'],
};

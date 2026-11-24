import { ROUTES } from '@/constants/routes';

import { env } from './env';

/**
 * Devtools are internal playgrounds, not product behavior. They are available
 * outside production and return 404 in production builds unless the build sets
 * `NEXT_PUBLIC_DEVTOOLS_ENABLED=true`.
 */
export const devtoolsRoutes = Object.values(ROUTES.DEVTOOLS);

export function isDevtoolsEnabled(): boolean {
  return env.NEXT_PUBLIC_DEVTOOLS_ENABLED;
}

export function isDevtoolsPath(pathname: string): boolean {
  return devtoolsRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

import type { PropsWithChildren } from 'react';
import { notFound } from 'next/navigation';

import { isDevtoolsEnabled } from '@/config/devtools';

/**
 * Devtools route group gate. Production builds serve 404 here unless
 * `NEXT_PUBLIC_DEVTOOLS_ENABLED=true` was set at build time.
 */
export default function DevtoolsLayout({ children }: PropsWithChildren) {
  if (!isDevtoolsEnabled()) {
    notFound();
  }

  return children;
}

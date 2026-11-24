import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/http/client';

let onUnauthorizedHandler: (() => void) | null = null;

/** Register a single app-level handler invoked when a mid-session request returns HTTP 401. */
export function registerUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorizedHandler = handler;
}

function handlePotentialUnauthorized(error: unknown, queryKey?: readonly unknown[]) {
  if (!(error instanceof ApiError) || error.status !== 401) {
    return;
  }
  // The operator-session probe itself handles initial unauthenticated redirects in the route guard.
  if (queryKey?.[0] === 'operator-session') {
    return;
  }
  onUnauthorizedHandler?.();
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError(error, query) {
      handlePotentialUnauthorized(error, query.queryKey);
    },
  }),
  mutationCache: new MutationCache({
    onError(error) {
      handlePotentialUnauthorized(error);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry(failureCount, error) {
        if (error instanceof ApiError && error.status && error.status < 500) {
          return false;
        }
        return failureCount < 1;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

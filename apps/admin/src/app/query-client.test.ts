import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryClient, registerUnauthorizedHandler } from '@/app/query-client';
import { ApiError } from '@/http/client';

describe('queryClient mid-session 401 handling', () => {
  afterEach(() => {
    registerUnauthorizedHandler(null);
    queryClient.clear();
  });

  it('invokes the registered unauthorized handler on a mid-session 401 query error', async () => {
    const onUnauthorized = vi.fn();
    registerUnauthorizedHandler(onUnauthorized);

    await expect(
      queryClient.fetchQuery({
        queryKey: ['audit-logs', 'test'],
        queryFn: () =>
          Promise.reject(new ApiError('Unauthorized', 'AUTH.UNAUTHORIZED', { status: 401 })),
      }),
    ).rejects.toBeInstanceOf(ApiError);

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('skips the handler for the operator-session probe, mfa status probe, and non-401 errors', async () => {
    const onUnauthorized = vi.fn();
    registerUnauthorizedHandler(onUnauthorized);

    await expect(
      queryClient.fetchQuery({
        queryKey: ['operator', 'session'],
        queryFn: () =>
          Promise.reject(new ApiError('Unauthorized', 'AUTH.UNAUTHORIZED', { status: 401 })),
      }),
    ).rejects.toBeInstanceOf(ApiError);

    await expect(
      queryClient.fetchQuery({
        queryKey: ['auth', 'mfa', 'status'],
        queryFn: () =>
          Promise.reject(new ApiError('Unauthorized', 'AUTH.UNAUTHORIZED', { status: 401 })),
      }),
    ).rejects.toBeInstanceOf(ApiError);

    await expect(
      queryClient.fetchQuery({
        queryKey: ['users', 'test'],
        queryFn: () => Promise.reject(new ApiError('Forbidden', 'AUTH.FORBIDDEN', { status: 403 })),
      }),
    ).rejects.toBeInstanceOf(ApiError);

    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

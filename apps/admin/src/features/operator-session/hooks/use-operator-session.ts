import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiErrorCode } from '@/http/codes';
import { ApiError, csrf } from '@/http/client';
import { operatorSessionService } from '@/features/operator-session/services/operator-session-service';
import {
  isMfaChallenge,
  type MfaChallengeVerifyInput,
  type OperatorSession,
  type SignInInput,
  type SignInResult,
} from '@/features/operator-session/types';

export const operatorSessionQueryKey = ['operator', 'session'] as const;
export const mfaStatusQueryKey = ['auth', 'mfa', 'status'] as const;

export function operatorSessionQueryOptions() {
  return queryOptions({
    queryKey: operatorSessionQueryKey,
    queryFn: async ({ signal }) => {
      const session = await operatorSessionService.current(signal);
      csrf.set(session.csrf_token);
      return session;
    },
    retry: false,
    staleTime: 60_000,
  });
}

/** Errors that mean the browser has no usable operator session and must sign in again. */
export function isSignedOut(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 401 ||
      error.errorCode === ApiErrorCode.OPERATOR_FORBIDDEN ||
      error.errorCode === ApiErrorCode.AUTH_ACCOUNT_DISABLED)
  );
}

export function useOperatorSession() {
  return useQuery(operatorSessionQueryOptions());
}

export function useSignIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SignInInput) => operatorSessionService.signIn(input),
    onSuccess: (result: SignInResult) => {
      if (isMfaChallenge(result)) {
        return;
      }
      csrf.set(result.csrf_token);
      queryClient.setQueryData(operatorSessionQueryKey, result);
    },
  });
}

export function useVerifyMfaChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MfaChallengeVerifyInput) =>
      operatorSessionService.verifyMfaChallenge(input),
    onSuccess: (session: OperatorSession) => {
      csrf.set(session.csrf_token);
      queryClient.setQueryData(operatorSessionQueryKey, session);
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => operatorSessionService.signOut(),
    onSettled: () => {
      csrf.set(undefined);
      queryClient.clear();
    },
  });
}

export function useMfaStatus() {
  return useQuery({
    queryKey: mfaStatusQueryKey,
    queryFn: ({ signal }) => operatorSessionService.getMfaStatus(signal),
    retry: false,
  });
}

export function useEnrollMfaTotp() {
  return useMutation({
    mutationFn: () => operatorSessionService.enrollMfaTotp(),
  });
}

export function useVerifyMfaTotp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => operatorSessionService.verifyMfaTotp(code),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mfaStatusQueryKey });
    },
  });
}

export function useDisableMfaTotp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => operatorSessionService.disableMfaTotp(code),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mfaStatusQueryKey });
    },
  });
}

/** Refetches the session once so a stale CSRF token can be replaced before a retry. */
export async function recoverCsrfToken(): Promise<void> {
  const session = await operatorSessionService.current();
  csrf.set(session.csrf_token);
}

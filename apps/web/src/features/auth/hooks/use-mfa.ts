'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LOCAL_ERROR_HANDLING_META } from '@/config/query-meta';
import { authService } from '@/features/auth/services/auth-service';
import type { MfaCodeRequest } from '@/features/auth/types';

export const mfaStatusQueryKey = ['auth', 'mfa', 'status'] as const;

/**
 * @hook useMfaStatus
 * @description Loads the authenticated user's MFA enrollment status.
 */
export function useMfaStatus() {
  return useQuery({
    queryKey: mfaStatusQueryKey,
    queryFn: () => authService.getMfaStatus(),
    meta: LOCAL_ERROR_HANDLING_META,
    retry: false,
  });
}

/**
 * @hook useEnrollMfaTotp
 * @description Starts RFC 6238 TOTP enrollment and returns the secret and otpauth URI.
 */
export function useEnrollMfaTotp() {
  return useMutation({
    mutationFn: () => authService.enrollMfaTotp(),
    meta: LOCAL_ERROR_HANDLING_META,
    retry: false,
  });
}

/**
 * @hook useVerifyMfaTotp
 * @description Verifies the initial TOTP code, activates MFA, and invalidates MFA status.
 */
export function useVerifyMfaTotp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: MfaCodeRequest) => authService.verifyMfaTotp(data),
    meta: LOCAL_ERROR_HANDLING_META,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mfaStatusQueryKey });
    },
  });
}

/**
 * @hook useDisableMfaTotp
 * @description Disables TOTP MFA using a current TOTP or recovery code and invalidates status.
 */
export function useDisableMfaTotp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: MfaCodeRequest) => authService.disableMfaTotp(data),
    meta: LOCAL_ERROR_HANDLING_META,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mfaStatusQueryKey });
    },
  });
}

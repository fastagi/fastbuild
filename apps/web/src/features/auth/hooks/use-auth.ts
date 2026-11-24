'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { authConfig } from '@/config/auth';
import { LOCAL_ERROR_HANDLING_META } from '@/config/query-meta';
import { authService } from '@/features/auth/services/auth-service';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { isUnauthenticatedAuthError, resolveAuthErrorKey } from '@/features/auth/utils/auth-error';
import { isMfaChallengeResponse } from '@/features/auth/utils/auth-response';
import { resolveReturnUrl } from '@/features/auth/utils/return-url';
import type {
  LoginRequest,
  MfaChallengeResponse,
  MfaChallengeVerifyRequest,
  RegisterRequest,
  SsoOidcStartRequest,
} from '@/features/auth/types';
import { useT } from '@/i18n';

export const ssoProvidersQueryKey = ['auth', 'sso', 'providers'] as const;

/**
 * @hook useLogin
 * @description Runs the configured login contract and redirects after validated success,
 * or triggers onMfaChallenge when two-factor verification is required.
 */
export function useLogin(options?: {
  onMfaChallenge?: (challenge: MfaChallengeResponse) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useT();

  return useMutation({
    mutationFn: (data: LoginRequest) => authService.login(data),
    meta: LOCAL_ERROR_HANDLING_META,
    retry: false,
    onSuccess: result => {
      if (isMfaChallengeResponse(result)) {
        options?.onMfaChallenge?.(result);
        return;
      }
      toast.success(t('auth.loginSuccess'));
      router.replace(resolveReturnUrl(searchParams.get('returnUrl')));
    },
  });
}

/**
 * @hook useVerifyMfaChallenge
 * @description Completes a pending login MFA challenge and redirects to the target route.
 */
export function useVerifyMfaChallenge() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useT();

  return useMutation({
    mutationFn: (data: MfaChallengeVerifyRequest) => authService.verifyMfaChallenge(data),
    meta: LOCAL_ERROR_HANDLING_META,
    retry: false,
    onSuccess: () => {
      toast.success(t('auth.loginSuccess'));
      router.replace(resolveReturnUrl(searchParams.get('returnUrl')));
    },
  });
}

/**
 * @hook useSsoProviders
 * @description Lists enabled OIDC SSO providers; fails closed to an empty list when unavailable.
 */
export function useSsoProviders() {
  return useQuery({
    queryKey: ssoProvidersQueryKey,
    queryFn: () => authService.listSsoProviders(),
    meta: LOCAL_ERROR_HANDLING_META,
    retry: false,
    staleTime: 60_000,
  });
}

/**
 * @hook useStartSsoOidc
 * @description Starts an OIDC PKCE flow and returns the provider authorize URL.
 */
export function useStartSsoOidc() {
  return useMutation({
    mutationFn: (data: SsoOidcStartRequest) => authService.startSsoOidc(data),
    meta: LOCAL_ERROR_HANDLING_META,
    retry: false,
  });
}

/**
 * @hook useRegister
 * @description Runs the configured registration contract and redirects after validated success.
 */
export function useRegister() {
  const router = useRouter();
  const t = useT();

  return useMutation({
    mutationFn: (data: RegisterRequest) => authService.register(data),
    meta: LOCAL_ERROR_HANDLING_META,
    retry: false,
    onSuccess: () => {
      toast.success(t('auth.accountCreated'));
      router.replace(authConfig.routes.afterLogin);
    },
  });
}

/**
 * @hook useLogout
 * @description Ends the configured session and reconciles local auth state idempotently.
 */
export function useLogout() {
  const router = useRouter();
  const reset = useAuthStore.use.reset();
  const t = useT();

  const completeLogout = () => {
    reset();
    router.replace(authConfig.routes.afterLogout);
  };

  return useMutation({
    mutationFn: () => authService.logout(),
    meta: LOCAL_ERROR_HANDLING_META,
    retry: false,
    onSuccess: () => {
      completeLogout();
      toast.success(t('auth.logoutSuccess'));
    },
    onError: error => {
      if (isUnauthenticatedAuthError(error)) {
        completeLogout();
        toast.success(t('auth.logoutSuccess'));
        return;
      }

      toast.error(t(resolveAuthErrorKey(error, 'logout')));
    },
  });
}

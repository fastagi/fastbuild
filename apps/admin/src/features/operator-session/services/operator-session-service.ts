import { z } from 'zod';
import { assertContract, type Accepts, type ContractData, type ContractRequest, type Sends } from '@/http/contract';
import { http } from '@/http/client';
import {
  mfaStatusSchema,
  mfaTotpDisableSchema,
  mfaTotpEnrollSchema,
  mfaTotpVerifySchema,
  operatorSessionSchema,
  signInResultSchema,
  type MfaChallengeVerifyInput,
  type MfaStatus,
  type MfaTotpDisable,
  type MfaTotpEnroll,
  type MfaTotpVerify,
  type OperatorSession,
  type SignInInput,
  type SignInResult,
} from '@/features/operator-session/types';

const mfaChallengeVerifyResultSchema = z.union([
  operatorSessionSchema,
  z.object({ user: z.unknown() }).passthrough(),
]);

export const operatorSessionService = {
  current(signal?: AbortSignal): Promise<OperatorSession> {
    return http.get('/v1/operator/session', {
      schema: operatorSessionSchema,
      ...(signal ? { signal } : {}),
    });
  },
  signIn(input: SignInInput): Promise<SignInResult> {
    return http.post('/v1/operator/session', input, { schema: signInResultSchema });
  },
  async verifyMfaChallenge(input: MfaChallengeVerifyInput): Promise<OperatorSession> {
    const result = await http.post('/v1/auth/mfa/challenge/verify', input, {
      schema: mfaChallengeVerifyResultSchema,
    });
    const parsedOperator = operatorSessionSchema.safeParse(result);
    if (parsedOperator.success) {
      return parsedOperator.data;
    }
    return this.current();
  },
  signOut(): Promise<void> {
    return http.delete('/v1/operator/session', { responseMode: 'json' });
  },
  getMfaStatus(signal?: AbortSignal): Promise<MfaStatus> {
    return http.get('/v1/auth/mfa/status', {
      schema: mfaStatusSchema,
      ...(signal ? { signal } : {}),
    });
  },
  enrollMfaTotp(): Promise<MfaTotpEnroll> {
    return http.post('/v1/auth/mfa/totp/enroll', undefined, {
      schema: mfaTotpEnrollSchema,
    });
  },
  verifyMfaTotp(code: string): Promise<MfaTotpVerify> {
    return http.post('/v1/auth/mfa/totp/verify', { code }, {
      schema: mfaTotpVerifySchema,
    });
  },
  disableMfaTotp(code: string): Promise<MfaTotpDisable> {
    return http.post('/v1/auth/mfa/totp/disable', { code }, {
      schema: mfaTotpDisableSchema,
    });
  },
};

// Fails type-check when packages/contracts/openapi.yaml and these schemas disagree.
assertContract<Accepts<z.input<typeof operatorSessionSchema>, ContractData<'getOperatorSession', 200>>>();
assertContract<Accepts<z.input<typeof signInResultSchema>, ContractData<'signInOperator', 200>>>();
assertContract<Sends<SignInInput, ContractRequest<'signInOperator'>>>();

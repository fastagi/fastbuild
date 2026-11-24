import { z } from 'zod';

export const operatorSchema = z.object({
  id: z.number().int().positive(),
  username: z.string(),
  email: z.string(),
  nickname: z.string(),
});

export const operatorSessionSchema = z.object({
  operator: operatorSchema,
  csrf_token: z.string().min(16).max(128),
});

export const mfaChallengeSchema = z.object({
  mfa_required: z.literal(true),
  challenge_token: z.string().min(1),
  challenge_expires_in: z.number().int().positive(),
  method: z.string().min(1),
});

export const signInResultSchema = z.union([operatorSessionSchema, mfaChallengeSchema]);

export const mfaStatusSchema = z.object({
  enabled: z.boolean(),
  method: z.string(),
  remaining_recovery_codes: z.number().int().nonnegative(),
  enrolled_at: z.string().optional(),
});

export const mfaTotpEnrollSchema = z.object({
  secret: z.string().min(1),
  otpauth_uri: z.string().min(1),
  issuer: z.string().min(1),
  account_name: z.string().min(1),
});

export const mfaTotpVerifySchema = z.object({
  enabled: z.literal(true),
  recovery_codes: z.array(z.string().min(1)),
});

export const mfaTotpDisableSchema = z.object({
  enabled: z.literal(false),
});

export type Operator = z.infer<typeof operatorSchema>;
export type OperatorSession = z.infer<typeof operatorSessionSchema>;
export type MfaChallenge = z.infer<typeof mfaChallengeSchema>;
export type SignInResult = z.infer<typeof signInResultSchema>;
export type MfaStatus = z.infer<typeof mfaStatusSchema>;
export type MfaTotpEnroll = z.infer<typeof mfaTotpEnrollSchema>;
export type MfaTotpVerify = z.infer<typeof mfaTotpVerifySchema>;
export type MfaTotpDisable = z.infer<typeof mfaTotpDisableSchema>;

export function isMfaChallenge(value: SignInResult): value is MfaChallenge {
  return 'mfa_required' in value && value.mfa_required === true;
}

export interface SignInInput {
  identifier: string;
  password: string;
}

export interface MfaChallengeVerifyInput {
  challenge_token: string;
  code: string;
}

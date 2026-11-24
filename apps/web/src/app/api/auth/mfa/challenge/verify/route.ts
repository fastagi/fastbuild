import { z } from 'zod';
import {
  apiErrorResponse,
  apiJsonBodyErrorResponse,
  apiValidationErrorResponse,
} from '@/app/api/_shared/error-response';
import { readJsonBody } from '@/app/api/_shared/json-body';
import { resolveAuthRoute } from '@/app/api/_shared/auth-route';
import { guardSameOriginMutation } from '@/app/api/_shared/mock-bff';
import { verifyMfaChallengeWithGoApi } from '@/features/auth/server/auth-adapter-route';
import { privateAuthResponse } from '@/features/auth/server/auth-response';
import { ApiErrorCode } from '@/http/codes';

const challengeVerifySchema = z.object({
  challenge_token: z.string().trim().min(1).max(256),
  code: z.string().trim().min(1).max(32),
});

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return privateAuthResponse(await handleChallengeVerify(request));
}

async function handleChallengeVerify(request: Request) {
  const resolution = resolveAuthRoute();

  if (!resolution.available) {
    return resolution.response;
  }

  const sameOriginGuard = guardSameOriginMutation(request);
  if (sameOriginGuard) {
    return sameOriginGuard;
  }

  const payload = await readJsonBody(request);
  if (!payload.ok) {
    return apiJsonBodyErrorResponse(payload.error);
  }

  const parsed = challengeVerifySchema.safeParse(payload.data);
  if (!parsed.success) {
    return apiValidationErrorResponse('Invalid MFA challenge payload', parsed.error);
  }

  if (resolution.backend === 'go-api') {
    return verifyMfaChallengeWithGoApi(request, parsed.data);
  }

  return apiErrorResponse({
    status: 401,
    errorCode: ApiErrorCode.AUTH_MFA_CHALLENGE_INVALID,
    message: 'MFA challenge is invalid or expired',
  });
}

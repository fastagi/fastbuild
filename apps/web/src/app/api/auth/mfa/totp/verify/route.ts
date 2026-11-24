import { z } from 'zod';
import {
  apiErrorResponse,
  apiJsonBodyErrorResponse,
  apiValidationErrorResponse,
} from '@/app/api/_shared/error-response';
import { readJsonBody } from '@/app/api/_shared/json-body';
import { resolveAuthRoute } from '@/app/api/_shared/auth-route';
import { guardSameOriginMutation } from '@/app/api/_shared/mock-bff';
import { apiSuccessResponse } from '@/app/api/_shared/success-response';
import { verifyMfaTotpWithGoApi } from '@/features/auth/server/auth-adapter-route';
import { privateAuthResponse } from '@/features/auth/server/auth-response';
import { verifyMockMfaTotp } from '@/features/auth/server/mock-mfa';
import { getSessionUser } from '@/features/auth/server/session';
import { ApiErrorCode } from '@/http/codes';

const mfaCodeSchema = z.object({
  code: z.string().trim().min(1).max(32),
});

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return privateAuthResponse(await handleMfaVerify(request));
}

async function handleMfaVerify(request: Request) {
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

  const parsed = mfaCodeSchema.safeParse(payload.data);
  if (!parsed.success) {
    return apiValidationErrorResponse('Invalid verification code payload', parsed.error);
  }

  if (resolution.backend === 'go-api') {
    return verifyMfaTotpWithGoApi(request, parsed.data.code);
  }

  const user = await getSessionUser();
  if (!user) {
    return apiErrorResponse({
      status: 401,
      errorCode: ApiErrorCode.AUTH_UNAUTHORIZED,
      message: 'Authentication required',
    });
  }

  const result = verifyMockMfaTotp(user.id, parsed.data.code);
  if (result === 'not_pending') {
    return apiErrorResponse({
      status: 409,
      errorCode: ApiErrorCode.AUTH_MFA_NOT_ENABLED,
      message: 'No pending MFA enrollment',
    });
  }
  if (result === 'invalid_code') {
    return apiErrorResponse({
      status: 401,
      errorCode: ApiErrorCode.AUTH_MFA_INVALID_CODE,
      message: 'Invalid verification code',
    });
  }

  return apiSuccessResponse(result);
}

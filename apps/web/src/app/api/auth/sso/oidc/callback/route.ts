import { z } from 'zod';
import {
  apiErrorResponse,
  apiJsonBodyErrorResponse,
  apiValidationErrorResponse,
} from '@/app/api/_shared/error-response';
import { readJsonBody } from '@/app/api/_shared/json-body';
import { resolveAuthRoute } from '@/app/api/_shared/auth-route';
import { guardSameOriginMutation } from '@/app/api/_shared/mock-bff';
import { callbackSsoOidcWithGoApi } from '@/features/auth/server/auth-adapter-route';
import { privateAuthResponse } from '@/features/auth/server/auth-response';
import { ApiErrorCode } from '@/http/codes';

const ssoCallbackSchema = z.object({
  provider: z.string().trim().min(1).max(64),
  code: z.string().trim().min(1).max(2048),
  state: z.string().trim().min(1).max(256),
});

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return privateAuthResponse(await handleSsoCallback(request));
}

async function handleSsoCallback(request: Request) {
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

  const parsed = ssoCallbackSchema.safeParse(payload.data);
  if (!parsed.success) {
    return apiValidationErrorResponse('Invalid SSO callback payload', parsed.error);
  }

  if (resolution.backend === 'go-api') {
    return callbackSsoOidcWithGoApi(request, parsed.data);
  }

  return apiErrorResponse({
    status: 404,
    errorCode: ApiErrorCode.AUTH_SSO_PROVIDER_NOT_FOUND,
    message: 'SSO provider not found',
  });
}

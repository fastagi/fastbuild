import { apiErrorResponse } from '@/app/api/_shared/error-response';
import { resolveAuthRoute } from '@/app/api/_shared/auth-route';
import { apiSuccessResponse } from '@/app/api/_shared/success-response';
import { getMfaStatusWithGoApi } from '@/features/auth/server/auth-adapter-route';
import { privateAuthResponse } from '@/features/auth/server/auth-response';
import { getMockMfaStatus } from '@/features/auth/server/mock-mfa';
import { getSessionUser } from '@/features/auth/server/session';
import { ApiErrorCode } from '@/http/codes';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return privateAuthResponse(await handleMfaStatus(request));
}

async function handleMfaStatus(request: Request) {
  const resolution = resolveAuthRoute();

  if (!resolution.available) {
    return resolution.response;
  }
  if (resolution.backend === 'go-api') {
    return getMfaStatusWithGoApi(request);
  }

  const user = await getSessionUser();
  if (!user) {
    return apiErrorResponse({
      status: 401,
      errorCode: ApiErrorCode.AUTH_UNAUTHORIZED,
      message: 'Authentication required',
    });
  }

  return apiSuccessResponse(getMockMfaStatus(user.id));
}

import { resolveAuthRoute } from '@/app/api/_shared/auth-route';
import { apiSuccessResponse } from '@/app/api/_shared/success-response';
import { listSsoProvidersWithGoApi } from '@/features/auth/server/auth-adapter-route';
import { privateAuthResponse } from '@/features/auth/server/auth-response';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return privateAuthResponse(await handleListSsoProviders(request));
}

async function handleListSsoProviders(request: Request) {
  const resolution = resolveAuthRoute();

  if (!resolution.available) {
    return resolution.response;
  }

  if (resolution.backend === 'go-api') {
    return listSsoProvidersWithGoApi(request);
  }

  return apiSuccessResponse([]);
}

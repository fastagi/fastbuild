import {
  createWidgetRoute,
  listWidgetsRoute,
  privateWidgetResponse,
} from '@/features/widget/server/widget-route';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return privateWidgetResponse(await listWidgetsRoute(request));
}

export async function POST(request: Request) {
  return privateWidgetResponse(await createWidgetRoute(request));
}

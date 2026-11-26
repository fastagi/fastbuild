import {
  deleteWidgetRoute,
  getWidgetRoute,
  privateWidgetResponse,
  updateWidgetRoute,
} from '@/features/widget/server/widget-route';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return privateWidgetResponse(await getWidgetRoute(request, id));
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return privateWidgetResponse(await updateWidgetRoute(request, id));
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return privateWidgetResponse(await deleteWidgetRoute(request, id));
}

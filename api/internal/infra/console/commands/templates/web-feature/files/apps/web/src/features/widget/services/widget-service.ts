import type { z } from 'zod/mini';

import {
  assertContract,
  type Accepts,
  type ContractData,
  type ContractRequest,
  type ContractResponse,
  type Sends,
} from '@/http/contract';
import { ClientErrorCode } from '@/http/codes';
import request, { ApiError } from '@/http/request';
import {
  WIDGET_PAGE_MAX_SIZE,
  widgetPageEnvelopeSchema,
  widgetSchema,
} from '@/features/widget/schemas';
import type {
  CreateWidgetInput,
  UpdateWidgetInput,
  Widget,
  WidgetPage,
} from '@/features/widget/types';

interface ListOptions {
  page?: number;
  perPage?: number;
}

/**
 * Browser service for the widget routes in `packages/contracts/openapi.yaml`. Every call carries
 * the active organization, and every successful response is validated before it is cached.
 */
export const widgetService = {
  async list(
    organizationId: number,
    { page = 1, perPage = 15 }: ListOptions = {}
  ): Promise<WidgetPage> {
    validId(page);
    if (!Number.isSafeInteger(perPage) || perPage < 1 || perPage > WIDGET_PAGE_MAX_SIZE) {
      throw invalidResponse();
    }
    const value = await request.getEnvelope<unknown>('/widgets', {
      headers: organizationHeaders(organizationId),
      params: { page, per_page: perPage },
    });
    const parsed = widgetPageEnvelopeSchema.safeParse(value);
    if (!parsed.success) throw invalidResponse();
    return { items: parsed.data.data, meta: parsed.data.meta, links: parsed.data.links };
  },

  async get(organizationId: number, widgetId: number): Promise<Widget> {
    validId(widgetId);
    const value = await request.get<unknown>(`/widgets/${widgetId}`, {
      headers: organizationHeaders(organizationId),
    });
    return parseWidget(value, widgetId);
  },

  async create(organizationId: number, input: CreateWidgetInput): Promise<Widget> {
    const value = await request.post<unknown, CreateWidgetInput>('/widgets', input, {
      headers: organizationHeaders(organizationId),
    });
    return parseWidget(value);
  },

  async update(
    organizationId: number,
    widgetId: number,
    input: UpdateWidgetInput
  ): Promise<Widget> {
    validId(widgetId);
    const value = await request.put<unknown, UpdateWidgetInput>(`/widgets/${widgetId}`, input, {
      headers: organizationHeaders(organizationId),
    });
    return parseWidget(value, widgetId);
  },

  async remove(organizationId: number, widgetId: number): Promise<void> {
    validId(widgetId);
    await request.delete<void>(`/widgets/${widgetId}`, {
      headers: organizationHeaders(organizationId),
    });
  },
};

export function parseWidget(value: unknown, expectedId?: number): Widget {
  const parsed = widgetSchema.safeParse(value);
  if (!parsed.success || (expectedId !== undefined && parsed.data.id !== expectedId)) {
    throw invalidResponse();
  }
  return parsed.data;
}

function organizationHeaders(organizationId: number): Record<string, string> {
  validId(organizationId);
  return { 'Organization-Id': String(organizationId) };
}

function validId(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1) throw invalidResponse();
}

function invalidResponse(): ApiError {
  return new ApiError(
    'Widget service returned an invalid response',
    ClientErrorCode.INVALID_RESPONSE
  );
}

assertContract<
  Accepts<z.input<typeof widgetPageEnvelopeSchema>, ContractResponse<'listWidgets', 200>>
>();
assertContract<Accepts<z.input<typeof widgetSchema>, ContractData<'getWidget', 200>>>();
assertContract<Accepts<z.input<typeof widgetSchema>, ContractData<'createWidget', 201>>>();
assertContract<Sends<CreateWidgetInput, ContractRequest<'createWidget'>>>();
assertContract<Accepts<z.input<typeof widgetSchema>, ContractData<'updateWidget', 200>>>();
assertContract<Sends<UpdateWidgetInput, ContractRequest<'updateWidget'>>>();

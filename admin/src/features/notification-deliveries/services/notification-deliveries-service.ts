import type { z } from 'zod';
import { assertContract, type Accepts, type ContractResponse } from '@/http/contract';
import { http } from '@/http/client';
import {
  notificationDeliveryPageSchema,
  type NotificationDeliveryPage,
  type NotificationDeliverySearch,
} from '@/features/notification-deliveries/types';

export const notificationDeliveriesService = {
  list(
    search: NotificationDeliverySearch,
    signal?: AbortSignal,
    perPage = 50,
  ): Promise<NotificationDeliveryPage> {
    const params = new URLSearchParams({
      page: String(search.page ?? 1),
      per_page: String(perPage),
    });
    if (search.status) {
      params.set('status', search.status);
    }
    if (search.channel) {
      params.set('channel', search.channel);
    }
    if (search.user_id) {
      params.set('user_id', String(search.user_id));
    }
    return http.get(`/v1/operator/notification-deliveries?${params.toString()}`, {
      responseMode: 'json',
      schema: notificationDeliveryPageSchema,
      ...(signal ? { signal } : {}),
    });
  },
  /** Reads only the total of a filtered ledger: one row is the smallest page the API serves. */
  async count(search: NotificationDeliverySearch, signal?: AbortSignal): Promise<number> {
    const page = await notificationDeliveriesService.list({ ...search, page: 1 }, signal, 1);
    return page.meta.total;
  },
};

// Fails type-check when contracts/openapi.yaml allows a body these schemas would reject.
assertContract<Accepts<z.input<typeof notificationDeliveryPageSchema>, ContractResponse<'listOperatorNotificationDeliveries', 200>>>();

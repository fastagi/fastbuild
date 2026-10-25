import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import { notificationDeliveriesService } from '@/features/notification-deliveries/services/notification-deliveries-service';
import {
  type NotificationDeliverySearch,
  type NotificationDeliveryStatus,
  notificationDeliveryStatuses,
} from '@/features/notification-deliveries/types';

const deliveriesQueryKey = ['operator', 'notification-deliveries'] as const;

/** How often the ledger refreshes while the operator keeps auto-refresh on. */
export const deliveryRefreshIntervalMs = 30_000;

export function useNotificationDeliveries(search: NotificationDeliverySearch, autoRefresh = false) {
  return useQuery({
    queryKey: [...deliveriesQueryKey, search],
    queryFn: ({ signal }) => notificationDeliveriesService.list(search, signal),
    placeholderData: keepPreviousData,
    refetchInterval: autoRefresh ? deliveryRefreshIntervalMs : false,
  });
}

/** Number of deliveries that exhausted their attempts, for the overview's attention list. */
export function useFailedDeliveryCount(enabled = true) {
  return useQuery({
    queryKey: [...deliveriesQueryKey, 'count', { status: 'failed' }],
    queryFn: ({ signal }) => notificationDeliveriesService.count({ status: 'failed' }, signal),
    enabled,
  });
}

/** Totals per status for the current channel and recipient filters, one small request each. */
export function useNotificationDeliveryCounts(
  search: Pick<NotificationDeliverySearch, 'channel' | 'user_id'>,
  autoRefresh = false,
) {
  const filters = { channel: search.channel, user_id: search.user_id };
  return useQueries({
    queries: notificationDeliveryStatuses.map((status) => ({
      queryKey: [...deliveriesQueryKey, 'count', { ...filters, status }],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        notificationDeliveriesService.count({ ...filters, status }, signal),
      refetchInterval: autoRefresh ? deliveryRefreshIntervalMs : (false as const),
    })),
    combine: (results) =>
      Object.fromEntries(
        notificationDeliveryStatuses.map((status, index) => [status, results[index]?.data]),
      ) as Record<NotificationDeliveryStatus, number | undefined>,
  });
}

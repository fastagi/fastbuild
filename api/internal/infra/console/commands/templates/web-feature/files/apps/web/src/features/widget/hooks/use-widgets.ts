'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { LOCAL_ERROR_HANDLING_META } from '@/config/query-meta';
import { widgetService } from '@/features/widget/services/widget-service';
import type { CreateWidgetInput, UpdateWidgetInput } from '@/features/widget/types';

export const WIDGET_PAGE_SIZE = 15;

export const widgetKeys = {
  all: ['widget'] as const,
  organization: (organizationId: number) => [...widgetKeys.all, organizationId] as const,
  pages: (organizationId: number) => [...widgetKeys.organization(organizationId), 'page'] as const,
  page: (organizationId: number, page: number) =>
    [...widgetKeys.pages(organizationId), page] as const,
};

/** One page of the active organization's widgets, newest first. */
export function useWidgets(organizationId: number, page: number) {
  return useQuery({
    queryKey: widgetKeys.page(organizationId, page),
    queryFn: () => widgetService.list(organizationId, { page, perPage: WIDGET_PAGE_SIZE }),
    enabled: validId(organizationId) && validId(page),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    // The workspace renders these errors inline, so the global error toast stays quiet.
    meta: LOCAL_ERROR_HANDLING_META,
  });
}

export function useCreateWidget(organizationId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWidgetInput) => widgetService.create(organizationId, input),
    meta: LOCAL_ERROR_HANDLING_META,
    onSettled: () => invalidatePages(queryClient, organizationId),
  });
}

export function useUpdateWidget(organizationId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ widgetId, input }: { widgetId: number; input: UpdateWidgetInput }) =>
      widgetService.update(organizationId, widgetId, input),
    meta: LOCAL_ERROR_HANDLING_META,
    onSettled: () => invalidatePages(queryClient, organizationId),
  });
}

export function useDeleteWidget(organizationId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (widgetId: number) => widgetService.remove(organizationId, widgetId),
    meta: LOCAL_ERROR_HANDLING_META,
    onSettled: () => invalidatePages(queryClient, organizationId),
  });
}

function invalidatePages(queryClient: ReturnType<typeof useQueryClient>, organizationId: number) {
  return queryClient.invalidateQueries({ queryKey: widgetKeys.pages(organizationId) });
}

function validId(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

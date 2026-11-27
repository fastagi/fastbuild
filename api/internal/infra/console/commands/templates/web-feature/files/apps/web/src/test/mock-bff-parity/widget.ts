import { expect } from 'vitest';

import type { ServiceParityContext } from '../plugin-web-features';

/**
 * Runs every widget service method against the mock BFF, so a mock response that drifts from the
 * service's schema fails as an invalid response. Loaded by `mock-bff-service-parity.test.ts`.
 */
export async function runServiceParity({ organizationId }: ServiceParityContext): Promise<void> {
  const { widgetService } = await import('@/features/widget/services/widget-service');

  const created = await widgetService.create(organizationId, { name: 'Parity widget' });
  const second = await widgetService.create(organizationId, { name: 'Second widget' });
  const firstPage = await widgetService.list(organizationId, { page: 1, perPage: 1 });
  expect(firstPage.items.map(item => item.id)).toEqual([second.id]);
  expect(firstPage.meta).toMatchObject({ current_page: 1, last_page: 2, total: 2 });
  const nextPage = await widgetService.list(organizationId, { page: 2, perPage: 1 });
  expect(nextPage.items.map(item => item.id)).toEqual([created.id]);

  const read = await widgetService.get(organizationId, created.id);
  expect(read.name).toBe('Parity widget');
  const updated = await widgetService.update(organizationId, created.id, { name: 'Renamed' });
  expect(updated.name).toBe('Renamed');

  await widgetService.remove(organizationId, created.id);
  await widgetService.remove(organizationId, second.id);
}

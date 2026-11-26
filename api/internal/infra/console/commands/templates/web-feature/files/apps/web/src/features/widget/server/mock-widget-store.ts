import 'server-only';

import type { Widget, WidgetPage } from '@/features/widget/types';

/**
 * Development-only widgets, isolated per organization. It mirrors the browser-facing behavior of
 * the Go widget starter: newest first, offset pages, and records another organization cannot see.
 */
const maxMockOrganizations = 1_000;
const maxMockWidgetsPerOrganization = 1_000;

interface OrganizationState {
  nextId: number;
  widgets: Map<number, Widget>;
}

export type MockWidgetWriteResult =
  { ok: true; widget: Widget } | { ok: false; error: 'not_found' | 'capacity' };

const organizations = new Map<number, OrganizationState>();

export const mockWidgetStore = {
  list(organizationId: number, page: number, perPage: number): WidgetPage {
    const ordered = [...stateFor(organizationId).widgets.values()].sort(
      (left, right) => right.id - left.id
    );
    const total = ordered.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const currentPage = Math.min(page, lastPage);
    const start = (currentPage - 1) * perPage;
    const items = ordered.slice(start, start + perPage);
    const href = (target: number) => `/api/widgets?page=${target}&per_page=${perPage}`;
    return {
      items,
      meta: {
        current_page: currentPage,
        per_page: perPage,
        total,
        last_page: lastPage,
        from: items.length ? start + 1 : 0,
        to: items.length ? start + items.length : 0,
      },
      links: {
        first: href(1),
        last: href(lastPage),
        prev: currentPage > 1 ? href(currentPage - 1) : null,
        next: currentPage < lastPage ? href(currentPage + 1) : null,
      },
    };
  },

  get(organizationId: number, widgetId: number): Widget | null {
    return stateFor(organizationId).widgets.get(widgetId) ?? null;
  },

  create(organizationId: number, input: { name: string }): MockWidgetWriteResult {
    const state = stateFor(organizationId);
    if (state.widgets.size >= maxMockWidgetsPerOrganization) {
      return { ok: false, error: 'capacity' };
    }
    const now = new Date().toISOString();
    const widget: Widget = { id: state.nextId, name: input.name, created_at: now, updated_at: now };
    state.nextId += 1;
    state.widgets.set(widget.id, widget);
    return { ok: true, widget };
  },

  update(
    organizationId: number,
    widgetId: number,
    changes: { name?: string }
  ): MockWidgetWriteResult {
    const state = stateFor(organizationId);
    const current = state.widgets.get(widgetId);
    if (!current) return { ok: false, error: 'not_found' };
    const widget: Widget = {
      ...current,
      ...(changes.name === undefined ? {} : { name: changes.name }),
      updated_at: new Date().toISOString(),
    };
    state.widgets.set(widgetId, widget);
    return { ok: true, widget };
  },

  delete(organizationId: number, widgetId: number): boolean {
    return stateFor(organizationId).widgets.delete(widgetId);
  },

  /** Test seam: forget every organization's widgets. */
  reset(): void {
    organizations.clear();
  },
};

function stateFor(organizationId: number): OrganizationState {
  const existing = organizations.get(organizationId);
  if (existing) return existing;
  if (organizations.size >= maxMockOrganizations) {
    const oldest = organizations.keys().next().value;
    if (oldest !== undefined) organizations.delete(oldest);
  }
  const created: OrganizationState = { nextId: 1, widgets: new Map() };
  organizations.set(organizationId, created);
  return created;
}

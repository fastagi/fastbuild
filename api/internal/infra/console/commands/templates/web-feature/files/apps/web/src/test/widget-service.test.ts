import { describe, expect, it } from 'vitest';

import {
  createWidgetSchema,
  updateWidgetSchema,
  widgetPageEnvelopeSchema,
} from '@/features/widget/schemas';
import { parseWidget } from '@/features/widget/services/widget-service';
import { resolveWidgetErrorKey } from '@/features/widget/utils/widget-error';
import { ApiErrorCode, ClientErrorCode } from '@/http/codes';
import { ApiError } from '@/http/request';

describe('widget service boundary', () => {
  it('accepts contract-shaped widgets and rejects drift', () => {
    expect(parseWidget(widget(), 7)).toMatchObject({ id: 7, name: 'Example' });
    expect(() => parseWidget(widget(), 8)).toThrow(ApiError);
    expect(() => parseWidget({ ...widget(), extra: true })).toThrow(ApiError);
    expect(() => parseWidget({ ...widget(), organization_id: 1 })).toThrow(ApiError);
    expect(() => parseWidget({ ...widget(), name: '' })).toThrow(ApiError);
    expect(() => parseWidget({ ...widget(), id: 0 })).toThrow(ApiError);
  });

  it('accepts offset pages and rejects unknown fields', () => {
    const page = {
      code: 0,
      message: 'success',
      data: [widget()],
      meta: { current_page: 1, per_page: 15, total: 1, last_page: 1, from: 1, to: 1 },
      links: { first: '/a', last: '/a', prev: null, next: null },
    };
    expect(widgetPageEnvelopeSchema.safeParse(page).success).toBe(true);
    expect(
      widgetPageEnvelopeSchema.safeParse({ ...page, meta: { ...page.meta, total: -1 } }).success
    ).toBe(false);
    expect(widgetPageEnvelopeSchema.safeParse({ ...page, extra: true }).success).toBe(false);
  });

  it('validates writes before they are sent', () => {
    expect(createWidgetSchema.safeParse({ name: 'Example' }).success).toBe(true);
    expect(createWidgetSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(createWidgetSchema.safeParse({ name: 'x'.repeat(256) }).success).toBe(false);
    expect(createWidgetSchema.safeParse({ name: 'Example', owner: 1 }).success).toBe(false);
    expect(updateWidgetSchema.safeParse({ name: 'Renamed' }).success).toBe(true);
    expect(updateWidgetSchema.safeParse({}).success).toBe(false);
  });

  it('maps failures to stable local copy', () => {
    const key = (errorCode: string) => resolveWidgetErrorKey(new ApiError('x', errorCode));
    expect(key(ApiErrorCode.PERMISSION_DENIED)).toBe('errors.forbidden');
    expect(key(ApiErrorCode.COMMON_NOT_FOUND)).toBe('errors.notFound');
    expect(key(ApiErrorCode.COMMON_VALIDATION_FAILED)).toBe('errors.invalid');
    expect(key(ApiErrorCode.ORGANIZATION_NOT_FOUND)).toBe('errors.organizationUnavailable');
    expect(key(ApiErrorCode.COMMON_SERVICE_UNAVAILABLE)).toBe('errors.unavailable');
    expect(key(ClientErrorCode.INVALID_RESPONSE)).toBe('errors.invalidResponse');
    expect(resolveWidgetErrorKey(new Error('x'))).toBe('errors.generic');
  });
});

function widget() {
  return {
    id: 7,
    name: 'Example',
    created_at: '2026-10-11T08:00:00Z',
    updated_at: '2026-10-11T08:00:00Z',
  };
}

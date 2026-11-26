import type { infer as Infer } from 'zod/mini';

import type {
  createWidgetSchema,
  updateWidgetSchema,
  widgetPageEnvelopeSchema,
  widgetSchema,
} from './schemas';

export type Widget = Infer<typeof widgetSchema>;
export type CreateWidgetInput = Infer<typeof createWidgetSchema>;
export type UpdateWidgetInput = Infer<typeof updateWidgetSchema>;

type WidgetPageEnvelope = Infer<typeof widgetPageEnvelopeSchema>;

export interface WidgetPage {
  items: Widget[];
  meta: WidgetPageEnvelope['meta'];
  links: WidgetPageEnvelope['links'];
}

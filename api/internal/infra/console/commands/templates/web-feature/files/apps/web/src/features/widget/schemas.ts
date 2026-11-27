import {
  array,
  int,
  iso,
  literal,
  maximum,
  nonnegative,
  nullable,
  number,
  optional,
  positive,
  refine,
  regex,
  strictObject,
  string,
} from 'zod/mini';

/** Limits from the widget routes in `packages/contracts/openapi.yaml`. */
export const WIDGET_NAME_MAX_LENGTH = 255;
export const WIDGET_PAGE_MAX_SIZE = 100;

const safeIdSchema = number().check(int(), positive(), maximum(Number.MAX_SAFE_INTEGER));
const timestampSchema = iso.datetime({ offset: true });
const positiveIntegerSchema = number().check(int(), positive());
const nonnegativeIntegerSchema = number().check(int(), nonnegative());

export const widgetSchema = strictObject({
  id: safeIdSchema,
  name: string().check(
    refine(value => value.length >= 1 && value.length <= WIDGET_NAME_MAX_LENGTH)
  ),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

const paginationMetaSchema = strictObject({
  current_page: positiveIntegerSchema,
  per_page: positiveIntegerSchema,
  total: nonnegativeIntegerSchema,
  last_page: positiveIntegerSchema,
  from: nonnegativeIntegerSchema,
  to: nonnegativeIntegerSchema,
});

const paginationLinksSchema = strictObject({
  first: string(),
  last: string(),
  prev: nullable(string()),
  next: nullable(string()),
});

export const widgetPageEnvelopeSchema = strictObject({
  code: literal(0),
  message: string(),
  data: array(widgetSchema),
  meta: paginationMetaSchema,
  links: paginationLinksSchema,
});

/** A name the API accepts: 1-255 characters that are not all whitespace. */
const inputNameSchema = string().check(
  refine(value => value.trim().length > 0 && value.length <= WIDGET_NAME_MAX_LENGTH)
);

export const createWidgetSchema = strictObject({
  name: inputNameSchema,
});

export const updateWidgetSchema = strictObject({
  name: optional(inputNameSchema),
}).check(refine(value => value.name !== undefined));

export const widgetRouteIdSchema = string().check(regex(/^[1-9]\d{0,15}$/u));

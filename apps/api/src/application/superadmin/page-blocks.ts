/**
 * Ready-made content blocks the backoffice can place on a page.
 *
 * This registry is the contract between the authoring surface and the app:
 * the backoffice builds its form from `fields`/`items`, so adding a block type
 * (or a field) needs no editor code, and the service normalizes whatever the
 * browser sends against the same schema before it lands in `content` jsonb.
 * The SPA keeps one renderer per `type`.
 */
export type PageBlockFieldInput =
  | 'text'
  | 'textarea'
  | 'url'
  | 'select'
  | 'image';

export interface PageBlockFieldOption {
  value: string;
  /** Translated by the client under `superadmin.modules.blocks.tones`. */
  labelKey: string;
}

export interface PageBlockFieldSchema {
  name: string;
  input: PageBlockFieldInput;
  maxLength?: number;
  options?: PageBlockFieldOption[];
}

/**
 * `type` is also the i18n key: the client reads
 * `superadmin.modules.blocks.types|hints.<type>`.
 */
export interface PageBlockTypeSchema {
  type: string;
  fields: PageBlockFieldSchema[];
  /** When present the block renders a list the operator can grow. */
  items?: { max: number; fields: PageBlockFieldSchema[] };
}

const TONES: PageBlockFieldOption[] = [
  { value: 'info', labelKey: 'info' },
  { value: 'success', labelKey: 'success' },
  { value: 'warning', labelKey: 'warning' },
  { value: 'critical', labelKey: 'critical' },
];

const text = (
  name: string,
  maxLength: number,
  input: PageBlockFieldInput = 'text',
): PageBlockFieldSchema => ({ name, input, maxLength });

export const PAGE_BLOCK_TYPES: PageBlockTypeSchema[] = [
  {
    type: 'callout',
    fields: [
      { name: 'tone', input: 'select', options: TONES },
      text('title', 120),
      text('body', 600, 'textarea'),
    ],
  },
  {
    type: 'stats',
    fields: [],
    items: {
      max: 4,
      fields: [text('label', 60), text('value', 24), text('hint', 100)],
    },
  },
  {
    type: 'steps',
    fields: [text('title', 120)],
    items: {
      max: 8,
      fields: [text('title', 100), text('body', 500, 'textarea')],
    },
  },
  {
    type: 'checklist',
    fields: [text('title', 120)],
    items: {
      max: 12,
      fields: [text('label', 140), text('hint', 200)],
    },
  },
  {
    type: 'links',
    fields: [text('title', 120)],
    items: {
      max: 8,
      fields: [
        text('label', 80),
        text('description', 160),
        text('href', 300, 'url'),
      ],
    },
  },
  {
    type: 'faq',
    fields: [text('title', 120)],
    items: {
      max: 12,
      fields: [text('question', 160), text('answer', 800, 'textarea')],
    },
  },
  {
    type: 'cta',
    fields: [
      text('title', 120),
      text('body', 400, 'textarea'),
      text('actionLabel', 40),
      text('actionHref', 300, 'url'),
    ],
  },
  {
    type: 'image',
    fields: [
      { name: 'src', input: 'image', maxLength: 500 },
      text('alt', 160),
      text('caption', 200),
    ],
  },
  {
    /**
     * Not copy: a live tool. The app fills the monthly expense from the
     * account's own transactions (last quarter) and lets the reader change it
     * to see the emergency fund they actually need. This is what makes an
     * authored page useful instead of decorative.
     */
    type: 'emergency-fund',
    fields: [text('title', 120), text('body', 400, 'textarea')],
  },
  {
    type: 'divider',
    fields: [],
  },
];

export const findPageBlockType = (
  type: string,
): PageBlockTypeSchema | undefined =>
  PAGE_BLOCK_TYPES.find((schema) => schema.type === type);

const cleanText = (value: unknown, field: PageBlockFieldSchema): string => {
  const raw = typeof value === 'string' ? value.trim() : '';
  return field.maxLength ? raw.slice(0, field.maxLength) : raw;
};

const cleanField = (field: PageBlockFieldSchema, value: unknown): string => {
  if (field.input === 'select') {
    const allowed = field.options?.map((option) => option.value) ?? [];
    const candidate = typeof value === 'string' ? value.trim() : '';
    return allowed.includes(candidate) ? candidate : allowed[0] ?? '';
  }
  return cleanText(value, field);
};

/**
 * Keeps only the fields the schema declares, trims them to their limits and
 * drops empty list rows. Anything else the browser sends is ignored instead
 * of being stored and later rendered as-is.
 */
export function normalizePageBlockProps(
  schema: PageBlockTypeSchema,
  rawProps: unknown,
): Record<string, unknown> {
  const raw =
    rawProps && typeof rawProps === 'object'
      ? (rawProps as Record<string, unknown>)
      : {};

  const props: Record<string, unknown> = {};
  for (const field of schema.fields) {
    props[field.name] = cleanField(field, raw[field.name]);
  }

  if (schema.items) {
    const incoming = Array.isArray(raw.items) ? raw.items : [];
    props.items = incoming
      .slice(0, schema.items.max)
      .map((item) => {
        const source =
          item && typeof item === 'object'
            ? (item as Record<string, unknown>)
            : {};
        const clean: Record<string, string> = {};
        for (const field of schema.items!.fields) {
          clean[field.name] = cleanField(field, source[field.name]);
        }
        return clean;
      })
      .filter((item) => Object.values(item).some(Boolean));
  }

  return props;
}

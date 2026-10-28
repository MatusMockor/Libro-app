import { z } from 'zod';
import { MARKED_PART_KINDS } from '../domain/reading-session.js';
import { pageSchema } from './page.schema.js';

export const markPartSchema = z
  .object({
    kind: z.enum(MARKED_PART_KINDS),
    fromPage: pageSchema,
    toPage: pageSchema.meta({ description: 'Last page of the part, at least fromPage' }),
  })
  .refine(({ fromPage, toPage }) => toPage >= fromPage, {
    error: 'Must not be less than fromPage',
    path: ['toPage'],
  })
  .meta({ id: 'MarkPart' });

export type MarkPartRequest = z.infer<typeof markPartSchema>;

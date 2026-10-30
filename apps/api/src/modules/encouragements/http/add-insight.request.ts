import { z } from 'zod';
import { INSIGHT_TEXT_MAX_LENGTH } from '../domain/insight.js';
import { codePointTextSchema } from './encouragement-fields.schema.js';

export const addInsightSchema = z
  .object({
    text: codePointTextSchema(INSIGHT_TEXT_MAX_LENGTH)
      .min(1)
      .meta({
        description: `A short thought about the book, 1 to ${String(INSIGHT_TEXT_MAX_LENGTH)} characters (Unicode code points); surrounding spaces are dropped`,
        maxLength: INSIGHT_TEXT_MAX_LENGTH,
        example: 'Kapitola o mlyne ma dostala, počítaj s tým.',
      }),
  })
  .meta({ id: 'AddInsight' });

export type AddInsightRequest = z.infer<typeof addInsightSchema>;

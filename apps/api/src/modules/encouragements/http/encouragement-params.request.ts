import { z } from 'zod';
import { uuidSchema } from './encouragement-fields.schema.js';

export const readingParamsSchema = z.object({
  readingId: uuidSchema,
});

export const insightParamsSchema = z.object({
  insightId: uuidSchema,
});

export const congratulationParamsSchema = z.object({
  readingId: uuidSchema,
  authorId: uuidSchema,
});

export type ReadingParams = z.infer<typeof readingParamsSchema>;

export type InsightParams = z.infer<typeof insightParamsSchema>;

export type CongratulationParams = z.infer<typeof congratulationParamsSchema>;

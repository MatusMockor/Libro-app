import { z } from 'zod';

export const readingParamsSchema = z.object({
  readingId: z.uuid(),
});

export type ReadingParams = z.infer<typeof readingParamsSchema>;

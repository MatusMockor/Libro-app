import { z } from 'zod';

export const readingTreeParamsSchema = z.object({
  readingId: z.uuid(),
});

export type ReadingTreeParams = z.infer<typeof readingTreeParamsSchema>;

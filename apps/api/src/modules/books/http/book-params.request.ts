import { z } from 'zod';

export const bookParamsSchema = z.object({
  workId: z.uuid(),
});

export type BookParams = z.infer<typeof bookParamsSchema>;

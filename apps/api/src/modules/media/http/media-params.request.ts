import { z } from 'zod';

export const mediaParamsSchema = z.object({
  mediaId: z.uuid(),
});

export type MediaParams = z.infer<typeof mediaParamsSchema>;

import { z } from 'zod';

export const sessionParamsSchema = z.object({
  sessionId: z.uuid(),
});

export type SessionParams = z.infer<typeof sessionParamsSchema>;

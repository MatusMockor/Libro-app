import { z } from 'zod';

export const participantParamsSchema = z.object({
  hostSessionId: z.uuid(),
  participantSessionId: z.uuid(),
});

export type ParticipantParams = z.infer<typeof participantParamsSchema>;

import { z } from 'zod';
import { LIVE_SESSION_SHARINGS } from '../domain/live-session-sharing.js';

export const liveSessionsSharingSchema = z.enum(LIVE_SESSION_SHARINGS).meta({
  description:
    'Who sees your open reading session (book, place, progress) and can join it: followers or nobody',
});

export const readingPrivacyRequestSchema = z
  .object({ liveSessions: liveSessionsSharingSchema })
  .meta({ id: 'UpdateReadingPrivacy' });

export type ReadingPrivacyRequest = z.infer<typeof readingPrivacyRequestSchema>;

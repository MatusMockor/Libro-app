import { z } from 'zod';
import { LIVE_SESSION_SHARINGS } from '../domain/live-session-sharing.js';
import { READING_ACTIVITY_AUDIENCES } from '../domain/reading-privacy.js';

export const liveSessionsSharingSchema = z.enum(LIVE_SESSION_SHARINGS).meta({
  description:
    'Who sees your open reading session (book, place, progress) and can join it: followers or nobody',
});

export const readingActivitySharingSchema = z.enum(READING_ACTIVITY_AUDIENCES).meta({
  description:
    'Who sees in the feed that you started or finished a book (with your review): followers or nobody',
});

export const readingPrivacyRequestSchema = z
  .object({
    liveSessions: liveSessionsSharingSchema.optional(),
    readingActivity: readingActivitySharingSchema.optional(),
  })
  .refine(
    ({ liveSessions, readingActivity }) =>
      liveSessions !== undefined || readingActivity !== undefined,
    { error: 'Send liveSessions, readingActivity or both' },
  )
  .meta({
    id: 'UpdateReadingPrivacy',
    description: 'The settings to change; a setting left out keeps its current value',
  });

export type ReadingPrivacyRequest = z.infer<typeof readingPrivacyRequestSchema>;

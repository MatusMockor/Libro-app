import { z } from 'zod';
import type { ReadingPrivacy } from '../domain/reading-privacy.js';
import {
  liveSessionsSharingSchema,
  readingActivitySharingSchema,
} from './reading-privacy.request.js';

export const readingPrivacySchema = z
  .object({
    liveSessions: liveSessionsSharingSchema,
    readingActivity: readingActivitySharingSchema,
  })
  .meta({ id: 'ReadingPrivacy' });

export type ReadingPrivacyResponse = z.infer<typeof readingPrivacySchema>;

export function toReadingPrivacyResponse({
  liveSessions,
  readingActivity,
}: ReadingPrivacy): ReadingPrivacyResponse {
  return { liveSessions, readingActivity };
}

import { z } from 'zod';
import type { LiveSessionSharing } from '../domain/live-session-sharing.js';
import { liveSessionsSharingSchema } from './reading-privacy.request.js';

export const readingPrivacySchema = z
  .object({ liveSessions: liveSessionsSharingSchema })
  .meta({ id: 'ReadingPrivacy' });

export type ReadingPrivacyResponse = z.infer<typeof readingPrivacySchema>;

export function toReadingPrivacyResponse(liveSessions: LiveSessionSharing): ReadingPrivacyResponse {
  return { liveSessions };
}

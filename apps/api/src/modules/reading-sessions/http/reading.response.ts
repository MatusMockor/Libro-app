import { z } from 'zod';
import type { Reading } from '../domain/reading.js';

export const readingSchema = z
  .object({
    id: z.uuid(),
    workId: z.uuid(),
    startedAt: z.iso.datetime(),
    finishedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'Reading' });

export type ReadingResponse = z.infer<typeof readingSchema>;

export function toReadingResponse({ id, workId, startedAt, finishedAt }: Reading): ReadingResponse {
  return {
    id,
    workId,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt?.toISOString() ?? null,
  };
}

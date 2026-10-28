import { z } from 'zod';
import {
  MARKED_PART_KINDS,
  SESSION_STATUSES,
  type Checkpoint,
  type MarkedPart,
  type ReadingSession,
} from '../domain/reading-session.js';

export const checkpointSchema = z
  .object({
    id: z.uuid(),
    page: z.int(),
    recordedAt: z.iso.datetime(),
  })
  .meta({ id: 'Checkpoint' });

export const markedPartSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(MARKED_PART_KINDS),
    fromPage: z.int(),
    toPage: z.int(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'MarkedPart' });

export const readingSessionSchema = z
  .object({
    id: z.uuid(),
    readingId: z.uuid(),
    workId: z.uuid(),
    place: z.string().nullable(),
    status: z.enum(SESSION_STATUSES),
    startedAt: z.iso.datetime(),
    endedAt: z.iso.datetime().nullable(),
    activeSeconds: z.int().meta({ description: 'Seconds read so far, pauses excluded' }),
    checkpoints: z.array(checkpointSchema),
    markedParts: z.array(markedPartSchema),
  })
  .meta({ id: 'ReadingSession' });

export type CheckpointResponse = z.infer<typeof checkpointSchema>;
export type MarkedPartResponse = z.infer<typeof markedPartSchema>;
export type ReadingSessionResponse = z.infer<typeof readingSessionSchema>;

export function toCheckpointResponse({ id, page, recordedAt }: Checkpoint): CheckpointResponse {
  return { id, page, recordedAt: recordedAt.toISOString() };
}

export function toMarkedPartResponse({
  id,
  kind,
  fromPage,
  toPage,
  createdAt,
}: MarkedPart): MarkedPartResponse {
  return { id, kind, fromPage, toPage, createdAt: createdAt.toISOString() };
}

export function toReadingSessionResponse(session: ReadingSession): ReadingSessionResponse {
  return {
    id: session.id,
    readingId: session.readingId,
    workId: session.workId,
    place: session.place,
    status: session.status,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
    activeSeconds: session.activeSeconds,
    checkpoints: session.checkpoints.map(toCheckpointResponse),
    markedParts: session.markedParts.map(toMarkedPartResponse),
  };
}

import { z } from 'zod';
import type { WorkSummary } from '../../books/index.js';
import { profileSummarySchema, toProfileSummaryResponse } from '../../profiles/index.js';
import type {
  GroupMember,
  LivePage,
  LiveSession,
  ReadingGroup,
  SessionSnapshot,
} from '../domain/reading-group.js';
import { SESSION_STATUSES } from '../domain/reading-session.js';

const bookSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    authors: z.array(z.object({ id: z.uuid(), name: z.string() })),
  })
  .nullable()
  .meta({ description: 'The book read, null when it is no longer in the catalogue' });

const snapshotFields = {
  sessionId: z.uuid(),
  readingId: z.uuid().meta({
    description: 'The reading (read-through) of the session, for insights and congratulations',
  }),
  place: z.string().nullable(),
  status: z.enum(SESSION_STATUSES),
  startedAt: z.iso.datetime(),
  progressPage: z
    .int()
    .nullable()
    .meta({ description: 'Page of the latest checkpoint, null before the first one' }),
};

export const liveSessionSchema = z
  .object({
    ...snapshotFields,
    host: profileSummarySchema,
    book: bookSchema,
    participantCount: z.int().meta({
      description: 'Readers who joined the reading group of this session, its host not counted',
    }),
    joinedByMe: z
      .boolean()
      .meta({ description: 'Whether the signed-in user reads in the same reading group' }),
  })
  .meta({ id: 'LiveReadingSession' });

export const livePageSchema = z
  .object({
    items: z.array(liveSessionSchema),
    nextOffset: z
      .int()
      .nullable()
      .meta({ description: 'Offset of the next page, null on the last' }),
  })
  .meta({ id: 'LiveReadingSessionPage' });

const groupMemberSchema = z
  .object({
    ...snapshotFields,
    reader: profileSummarySchema,
    joinedAt: z.iso.datetime().nullable().meta({ description: 'null for the host' }),
  })
  .meta({ id: 'ReadingGroupMember' });

export const readingGroupSchema = z
  .object({
    book: bookSchema,
    host: groupMemberSchema
      .nullable()
      .meta({ description: 'The host session, null when you may not see it' }),
    participants: z.array(groupMemberSchema).meta({
      description: 'Current participants you may see, in the order they joined',
    }),
  })
  .meta({ id: 'ReadingGroup' });

export type LivePageResponse = z.infer<typeof livePageSchema>;

export type ReadingGroupResponse = z.infer<typeof readingGroupSchema>;

type LiveSessionResponse = z.infer<typeof liveSessionSchema>;

type GroupMemberResponse = z.infer<typeof groupMemberSchema>;

type BookResponse = z.infer<typeof bookSchema>;

type SnapshotResponse = Pick<
  LiveSessionResponse,
  'sessionId' | 'readingId' | 'place' | 'status' | 'startedAt' | 'progressPage'
>;

export function toLivePageResponse({ items, nextOffset }: LivePage): LivePageResponse {
  return { items: items.map(toLiveSessionResponse), nextOffset };
}

export function toReadingGroupResponse({
  book,
  host,
  participants,
}: ReadingGroup): ReadingGroupResponse {
  return {
    book: toBookResponse(book),
    host: host ? toGroupMemberResponse(host) : null,
    participants: participants.map(toGroupMemberResponse),
  };
}

function toLiveSessionResponse(session: LiveSession): LiveSessionResponse {
  return {
    ...toSnapshotResponse(session),
    host: toProfileSummaryResponse(session.host),
    book: toBookResponse(session.book),
    participantCount: session.participantCount,
    joinedByMe: session.joinedByMe,
  };
}

function toGroupMemberResponse(member: GroupMember): GroupMemberResponse {
  return {
    ...toSnapshotResponse(member),
    reader: toProfileSummaryResponse(member.reader),
    joinedAt: member.joinedAt?.toISOString() ?? null,
  };
}

function toSnapshotResponse({
  sessionId,
  readingId,
  place,
  status,
  startedAt,
  progressPage,
}: Omit<SessionSnapshot, 'userId'>): SnapshotResponse {
  return {
    sessionId,
    readingId,
    place,
    status,
    startedAt: startedAt.toISOString(),
    progressPage,
  };
}

function toBookResponse(book: WorkSummary | null): BookResponse {
  if (!book) {
    return null;
  }

  return {
    id: book.id,
    title: book.title,
    authors: book.authors.map(({ id, name }) => ({ id, name })),
  };
}

import { z } from 'zod';
import {
  profileSummarySchema,
  toProfileSummaryResponse,
  type ProfileSummary,
  type ProfileSummaryResponse,
} from '../../profiles/index.js';
import { ENCOURAGEMENT_KINDS, type Encouragement } from '../domain/encouragement.js';
import type { EncouragementPage } from '../domain/encouragement-page.js';
import type { Insight } from '../domain/insight.js';
import { encodeCursor } from './encouragement-cursor.js';

const decorationIdSchema = z.string().meta({
  description: 'Id of the decoration this adds to the tree of the reading',
  example: 'insight:0b7a4c9e-3f2d-4e61-9a8b-5c1d2e3f4a5b',
});

const authorSchema = profileSummarySchema.nullable().meta({
  description: 'The profile of the author; null when the author has no profile',
});

export const insightSchema = z
  .object({
    id: z.uuid(),
    readingId: z.uuid(),
    decorationId: decorationIdSchema,
    authorId: z.uuid(),
    author: authorSchema,
    text: z.string(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'Insight' });

export const encouragementSchema = z
  .object({
    decorationId: decorationIdSchema,
    kind: z.enum(ENCOURAGEMENT_KINDS),
    insightId: z.uuid().nullable().meta({ description: 'The insight, null for a congratulation' }),
    authorId: z.uuid(),
    author: authorSchema,
    text: z
      .string()
      .nullable()
      .meta({ description: 'The insight text, null for a congratulation' }),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'Encouragement' });

export const encouragementPageSchema = z
  .object({
    items: z.array(encouragementSchema),
    nextCursor: z
      .string()
      .nullable()
      .meta({ description: 'Opaque cursor of the next page, null on the last' }),
  })
  .meta({ id: 'EncouragementPage' });

export type InsightResponse = z.infer<typeof insightSchema>;

export type EncouragementResponse = z.infer<typeof encouragementSchema>;

export type EncouragementPageResponse = z.infer<typeof encouragementPageSchema>;

export function toInsightResponse(insight: Insight): InsightResponse {
  return {
    id: insight.id,
    readingId: insight.readingId,
    decorationId: insight.decorationId,
    authorId: insight.authorId,
    author: toAuthorResponse(insight.author),
    text: insight.text,
    createdAt: insight.createdAt.toISOString(),
  };
}

export function toEncouragementPageResponse({
  items,
  nextCursor,
}: EncouragementPage<Encouragement>): EncouragementPageResponse {
  return { items: items.map(toEncouragementResponse), nextCursor: encodeCursor(nextCursor) };
}

function toEncouragementResponse(encouragement: Encouragement): EncouragementResponse {
  return {
    decorationId: encouragement.decorationId,
    kind: encouragement.kind,
    insightId: encouragement.insightId,
    authorId: encouragement.authorId,
    author: toAuthorResponse(encouragement.author),
    text: encouragement.text,
    createdAt: encouragement.createdAt.toISOString(),
  };
}

function toAuthorResponse(author: ProfileSummary | null): ProfileSummaryResponse | null {
  return author && toProfileSummaryResponse(author);
}

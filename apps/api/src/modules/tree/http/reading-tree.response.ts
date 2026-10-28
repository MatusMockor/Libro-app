import { z } from 'zod';
import type { ReadingTree, ReadingTreePage } from '../domain/reading-tree.js';
import { toTreeV1Response, treeV1Schema } from './tree.response.js';

export const readingTreeSchema = z
  .object({
    readingId: z.uuid(),
    workId: z.uuid(),
    finished: z.boolean(),
    finishedAt: z.iso.datetime().nullable(),
    tree: treeV1Schema,
  })
  .meta({ id: 'ReadingTree' });

export const readingTreePageSchema = z
  .object({
    items: z.array(readingTreeSchema),
    nextOffset: z
      .int()
      .nullable()
      .meta({ description: 'Offset of the next page, null on the last' }),
  })
  .meta({ id: 'ReadingTreePage' });

export type ReadingTreeResponse = z.infer<typeof readingTreeSchema>;

export type ReadingTreePageResponse = z.infer<typeof readingTreePageSchema>;

export function toReadingTreeResponse({
  readingId,
  workId,
  finishedAt,
  tree,
}: ReadingTree): ReadingTreeResponse {
  return {
    readingId,
    workId,
    finished: finishedAt !== null,
    finishedAt: finishedAt?.toISOString() ?? null,
    tree: toTreeV1Response(tree),
  };
}

export function toReadingTreePageResponse({
  items,
  nextOffset,
}: ReadingTreePage): ReadingTreePageResponse {
  return { items: items.map(toReadingTreeResponse), nextOffset };
}

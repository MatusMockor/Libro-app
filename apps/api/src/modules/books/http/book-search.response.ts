import { z } from 'zod';
import type { BookSearchPage } from '../domain/book-search.js';

export const bookSearchSchema = z
  .object({
    items: z.array(
      z.object({
        id: z.uuid(),
        title: z.string(),
        authors: z.array(z.object({ id: z.uuid(), name: z.string() })),
      }),
    ),
    nextOffset: z
      .int()
      .nullable()
      .meta({ description: 'Offset of the next page, null on the last' }),
  })
  .meta({ id: 'BookSearch' });

export type BookSearchResponse = z.infer<typeof bookSearchSchema>;

export function toBookSearchResponse({ items, nextOffset }: BookSearchPage): BookSearchResponse {
  return {
    items: items.map(({ id, title, authors }) => ({
      id,
      title,
      authors: authors.map((author) => ({ id: author.id, name: author.name })),
    })),
    nextOffset,
  };
}

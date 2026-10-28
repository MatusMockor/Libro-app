import { z } from 'zod';
import type { Work } from '../domain/work.js';

export const bookSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    authors: z.array(z.object({ id: z.uuid(), name: z.string() })),
    editions: z.array(
      z.object({
        id: z.uuid(),
        isbn13: z.string().nullable(),
        language: z.string(),
        title: z.string().nullable(),
        publishedYear: z.int().nullable(),
      }),
    ),
  })
  .meta({ id: 'Book' });

export type BookResponse = z.infer<typeof bookSchema>;

export function toBookResponse({ id, title, authors, editions }: Work): BookResponse {
  return {
    id,
    title,
    authors: authors.map((author) => ({ id: author.id, name: author.name })),
    editions: editions.map((edition) => ({
      id: edition.id,
      isbn13: edition.isbn13,
      language: edition.language,
      title: edition.title,
      publishedYear: edition.publishedYear,
    })),
  };
}

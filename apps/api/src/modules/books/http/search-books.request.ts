import { z } from 'zod';
import { BOOK_SEARCH_MAX_OFFSET } from '../domain/book-search.js';

export const searchBooksQuerySchema = z.object({
  q: z.string().trim().min(2).max(100).meta({
    description:
      'Words found in the title, an edition title or an author name, case and diacritics ignored, or an ISBN',
    example: 'kafka proces',
  }),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(BOOK_SEARCH_MAX_OFFSET).default(0),
});

export type SearchBooksQuery = z.infer<typeof searchBooksQuerySchema>;

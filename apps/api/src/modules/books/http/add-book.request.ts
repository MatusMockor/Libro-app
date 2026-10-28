import { z } from 'zod';
import { ISBN13_PATTERN, isValidIsbn13 } from '../domain/isbn13.js';

const isbn13Schema = z
  .string()
  .regex(ISBN13_PATTERN, { error: 'Must be 13 digits without hyphens', abort: true })
  .refine(isValidIsbn13, { error: 'Invalid ISBN-13 check digit' })
  .meta({ description: 'ISBN-13, digits only', example: '9788055100548' });

const editionSchema = z.object({
  isbn13: isbn13Schema.nullable().default(null),
  language: z
    .string()
    .regex(/^[a-z]{2}$/, { error: 'Must be a lowercase ISO 639-1 code, e.g. sk' })
    .meta({ example: 'sk' }),
  title: z.string().trim().min(1).max(500).nullable().default(null).meta({
    description: 'Title of this edition when it differs from the work, e.g. a translation',
  }),
  publishedYear: z.int().min(1).max(9999).nullable().default(null),
});

export const addBookSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    authors: z
      .array(z.string().trim().min(1).max(200))
      .min(1)
      .max(20)
      .meta({ description: 'Author names in credit order' }),
    editions: z.array(editionSchema).min(1).max(20),
  })
  .meta({ id: 'AddBook' });

export type AddBookRequest = z.infer<typeof addBookSchema>;

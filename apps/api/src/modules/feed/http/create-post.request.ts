import { z } from 'zod';
import type { NewPost } from '../domain/post.js';
import { blankToNull, PLACE_MAX_LENGTH, POST_TEXT_MAX_LENGTH } from '../domain/post-text.js';
import { codePointTextSchema, uuidSchema } from './feed-fields.schema.js';

export const createPostSchema = z
  .object({
    text: codePointTextSchema(POST_TEXT_MAX_LENGTH)
      .min(1)
      .meta({
        description: `What the reader wants to share, 1 to ${String(POST_TEXT_MAX_LENGTH)} characters; surrounding spaces are dropped`,
        maxLength: POST_TEXT_MAX_LENGTH,
        example: 'Práve som dočítala Malého princa.',
      }),
    workId: uuidSchema
      .nullable()
      .default(null)
      .meta({ description: 'The book (work) the post is about' }),
    place: codePointTextSchema(PLACE_MAX_LENGTH)
      .nullable()
      .default(null)
      .meta({
        description: `Where the reader is, as free text of at most ${String(PLACE_MAX_LENGTH)} characters; blank means no place`,
        maxLength: PLACE_MAX_LENGTH,
        example: 'kaviareň',
      }),
  })
  .meta({ id: 'CreatePost' });

export type CreatePostRequest = z.infer<typeof createPostSchema>;

export function toNewPost(authorId: string, { text, workId, place }: CreatePostRequest): NewPost {
  return { authorId, text, workId, place: blankToNull(place) };
}

import { z } from 'zod';
import type { NewPost } from '../domain/post.js';
import { MAX_POST_PHOTOS } from '../domain/post-photo.js';
import { blankToNull, PLACE_MAX_LENGTH, POST_TEXT_MAX_LENGTH } from '../domain/post-text.js';
import { codePointTextSchema, distinct, uuidSchema } from './feed-fields.schema.js';

const TEXT_RULE_FIELDS: ReadonlySet<PropertyKey | undefined> = new Set(['text', 'photoIds']);

export const createPostSchema = z
  .object({
    text: codePointTextSchema(POST_TEXT_MAX_LENGTH)
      .nullable()
      .optional()
      .meta({
        description: `What the reader wants to share, at most ${String(POST_TEXT_MAX_LENGTH)} characters; surrounding spaces are dropped. Required unless the post has a photo; blank or null means no text`,
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
    photoIds: z
      .array(uuidSchema)
      .max(MAX_POST_PHOTOS)
      .refine(distinct, { error: 'Must not repeat a photo' })
      .default([])
      .meta({
        description: `At most ${String(MAX_POST_PHOTOS)} distinct ids of your own uploaded photos (POST /v1/media), in the order to show`,
      }),
  })
  .superRefine(
    ({ text, photoIds }, context) => {
      if (photoIds.length > 0 || blankToNull(text) !== null) {
        return;
      }

      context.addIssue(missingTextIssue(text));
    },
    { when: ({ issues }) => issues.every(({ path }) => !TEXT_RULE_FIELDS.has(path?.[0])) },
  )
  .meta({ id: 'CreatePost' });

export type CreatePostRequest = z.infer<typeof createPostSchema>;

type TextIssue = Parameters<z.core.$RefinementCtx['addIssue']>[0];

function missingTextIssue(text: string | null | undefined): TextIssue {
  if (text === '') {
    return {
      code: 'too_small',
      origin: 'string',
      minimum: 1,
      inclusive: true,
      path: ['text'],
      input: text,
      message: 'Too small: expected string to have >=1 characters',
    };
  }

  return {
    code: 'invalid_type',
    expected: 'string',
    path: ['text'],
    input: text,
    message: `Invalid input: expected string, received ${String(text)}`,
  };
}

export function toNewPost(
  authorId: string,
  { text, workId, place, photoIds }: CreatePostRequest,
): NewPost {
  return { authorId, text: blankToNull(text), workId, place: blankToNull(place), photoIds };
}

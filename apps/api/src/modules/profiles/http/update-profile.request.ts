import { z } from 'zod';
import { GENRES, MAX_FAVOURITE_GENRES } from '../domain/genres.js';
import { MAX_TOP_BOOKS } from '../domain/profile.js';
import { BIO_MAX_LENGTH, DISPLAY_NAME_MAX_LENGTH } from '../domain/profile-text.js';
import { distinct, handleSchema, profileTextSchema, uuidSchema } from './profile-fields.schema.js';

export const updateProfileSchema = z
  .object({
    handle: handleSchema.optional(),
    displayName: profileTextSchema(
      DISPLAY_NAME_MAX_LENGTH,
      `At most ${String(DISPLAY_NAME_MAX_LENGTH)} characters (Unicode code points) after trimming; blank or null removes it`,
    )
      .nullable()
      .optional(),
    bio: profileTextSchema(
      BIO_MAX_LENGTH,
      `At most ${String(BIO_MAX_LENGTH)} characters (Unicode code points) after trimming; blank or null removes it`,
    )
      .nullable()
      .optional(),
    favouriteGenres: z
      .array(z.enum(GENRES))
      .max(MAX_FAVOURITE_GENRES)
      .refine(distinct, { error: 'Must not repeat a genre' })
      .optional()
      .meta({
        description: `At most ${String(MAX_FAVOURITE_GENRES)} distinct genre keys from GET /v1/profiles/genres, in the order to show; replaces the current ones`,
      }),
    topBookIds: z
      .array(uuidSchema)
      .max(MAX_TOP_BOOKS)
      .refine(distinct, { error: 'Must not repeat a book' })
      .optional()
      .meta({
        description: `At most ${String(MAX_TOP_BOOKS)} distinct book (work) ids from the catalogue, best first; replaces the current ones`,
      }),
    avatarMediaId: uuidSchema.nullable().optional().meta({
      description: 'One of your own uploaded photos (POST /v1/media); null removes the avatar',
    }),
  })
  .meta({
    id: 'UpdateProfile',
    description: 'Only the fields present change; null clears a nullable field',
  });

export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;

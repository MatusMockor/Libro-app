import { z } from 'zod';
import {
  mediaVariantsSchema,
  toMediaVariantsResponse,
  urlsExpireAtSchema,
} from '../../media/index.js';
import type { Avatar, ProfileSummary } from '../../profiles/index.js';

const avatarSchema = z
  .object({
    variants: mediaVariantsSchema,
    urlsExpireAt: urlsExpireAtSchema('review'),
  })
  .meta({ id: 'ReviewReaderAvatar' });

export const reviewReaderSchema = z
  .object({
    userId: z.uuid(),
    handle: z.string().meta({ example: 'jana.novakova' }),
    displayName: z.string().nullable(),
    avatar: avatarSchema.nullable(),
    official: z
      .boolean()
      .meta({ description: 'Whether this is an official Libro account (the app shows a badge)' }),
    followedByMe: z
      .boolean()
      .meta({ description: 'Whether the signed-in user follows this profile' }),
  })
  .meta({ id: 'ReviewReader' });

export type ReviewReaderResponse = z.infer<typeof reviewReaderSchema>;

type AvatarResponse = z.infer<typeof avatarSchema>;

export function toReviewReaderResponse(
  summary: ProfileSummary | null,
): ReviewReaderResponse | null {
  if (!summary) {
    return null;
  }

  const { userId, handle, displayName, avatar, official, followedByMe } = summary;

  return { userId, handle, displayName, avatar: toAvatarResponse(avatar), official, followedByMe };
}

function toAvatarResponse(avatar: Avatar | null): AvatarResponse | null {
  if (!avatar) {
    return null;
  }

  const { variants, urlsExpireAt } = avatar;

  return { variants: toMediaVariantsResponse(variants), urlsExpireAt: urlsExpireAt.toISOString() };
}

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

  const { userId, handle, displayName, avatar, followedByMe } = summary;

  return { userId, handle, displayName, avatar: toAvatarResponse(avatar), followedByMe };
}

function toAvatarResponse(avatar: Avatar | null): AvatarResponse | null {
  if (!avatar) {
    return null;
  }

  const { variants, urlsExpireAt } = avatar;

  return { variants: toMediaVariantsResponse(variants), urlsExpireAt: urlsExpireAt.toISOString() };
}

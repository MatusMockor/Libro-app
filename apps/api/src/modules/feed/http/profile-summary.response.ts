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
    urlsExpireAt: urlsExpireAtSchema('list'),
  })
  .meta({ id: 'FeedProfileAvatar' });

export const feedProfileSchema = z
  .object({
    userId: z.uuid(),
    handle: z.string().meta({ example: 'jana.novakova' }),
    displayName: z.string().nullable(),
    avatar: avatarSchema.nullable(),
    followedByMe: z
      .boolean()
      .meta({ description: 'Whether the signed-in user follows this profile' }),
  })
  .meta({ id: 'FeedProfile' });

export type FeedProfileResponse = z.infer<typeof feedProfileSchema>;

type AvatarResponse = z.infer<typeof avatarSchema>;

export function toFeedProfileResponse(summary: ProfileSummary | null): FeedProfileResponse | null {
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

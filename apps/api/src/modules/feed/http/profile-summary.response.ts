import { z } from 'zod';
import type { MediaVariantUrl } from '../../media/index.js';
import type { Avatar, ProfileSummary } from '../../profiles/index.js';

const variantSchema = z.object({
  url: z.url().meta({ description: 'Signed URL of the WebP file, valid until urlsExpireAt' }),
  width: z.int(),
  height: z.int(),
});

const avatarSchema = z
  .object({
    variants: z.object({
      small: variantSchema.meta({ description: 'Longer side at most 256 px' }),
      medium: variantSchema.meta({ description: 'Longer side at most 1080 px' }),
      large: variantSchema.meta({ description: 'Longer side at most 2048 px' }),
    }),
    urlsExpireAt: z.iso.datetime().meta({
      description: 'When the variant URLs stop working; fetch the list again for fresh URLs',
    }),
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

  return {
    variants: {
      small: toVariantResponse(variants.small),
      medium: toVariantResponse(variants.medium),
      large: toVariantResponse(variants.large),
    },
    urlsExpireAt: urlsExpireAt.toISOString(),
  };
}

function toVariantResponse({ url, width, height }: MediaVariantUrl): MediaVariantUrl {
  return { url, width, height };
}

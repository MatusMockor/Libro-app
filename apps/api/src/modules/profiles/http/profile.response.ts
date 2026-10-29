import { z } from 'zod';
import type { MediaVariantUrl } from '../../media/index.js';
import { GENRES } from '../domain/genres.js';
import type { Avatar, Profile, ProfileSummary } from '../domain/profile.js';
import type { Page } from '../domain/profile-page.js';

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
      description: 'When the variant URLs stop working; fetch the profile again for fresh URLs',
    }),
  })
  .meta({ id: 'ProfileAvatar' });

const profileIdentity = {
  userId: z.uuid(),
  handle: z.string().meta({ example: 'jana.novakova' }),
  displayName: z.string().nullable(),
};

const followedByMeSchema = z
  .boolean()
  .meta({ description: 'Whether the signed-in user follows this profile' });

export const profileSummarySchema = z
  .object({ ...profileIdentity, avatar: avatarSchema.nullable(), followedByMe: followedByMeSchema })
  .meta({ id: 'ProfileSummary' });

export const profileSchema = z
  .object({
    ...profileIdentity,
    bio: z.string().nullable(),
    favouriteGenres: z.array(z.enum(GENRES)),
    topBooks: z
      .array(
        z.object({
          id: z.uuid(),
          title: z.string(),
          authors: z.array(z.object({ id: z.uuid(), name: z.string() })),
        }),
      )
      .meta({ description: 'At most 3 books, best first' }),
    avatar: avatarSchema.nullable(),
    followerCount: z.int(),
    followingCount: z.int(),
    followedByMe: followedByMeSchema,
  })
  .meta({ id: 'Profile' });

export const profileSummaryPageSchema = z
  .object({
    items: z.array(profileSummarySchema),
    nextOffset: z
      .int()
      .nullable()
      .meta({ description: 'Offset of the next page, null on the last' }),
  })
  .meta({ id: 'ProfileSummaryPage' });

export const genresSchema = z
  .object({
    genres: z.array(z.enum(GENRES)).meta({
      description: 'Stable genre keys for favouriteGenres; the app translates them',
    }),
  })
  .meta({ id: 'ProfileGenres' });

export type ProfileResponse = z.infer<typeof profileSchema>;

export type ProfileSummaryResponse = z.infer<typeof profileSummarySchema>;

export type ProfileSummaryPageResponse = z.infer<typeof profileSummaryPageSchema>;

export type GenresResponse = z.infer<typeof genresSchema>;

type AvatarResponse = z.infer<typeof avatarSchema>;

export function toProfileSummaryResponse({
  userId,
  handle,
  displayName,
  avatar,
  followedByMe,
}: ProfileSummary): ProfileSummaryResponse {
  return { userId, handle, displayName, avatar: toAvatarResponse(avatar), followedByMe };
}

export function toProfileResponse(profile: Profile): ProfileResponse {
  return {
    userId: profile.userId,
    handle: profile.handle,
    displayName: profile.displayName,
    bio: profile.bio,
    favouriteGenres: [...profile.favouriteGenres],
    topBooks: profile.topBooks.map(({ id, title, authors }) => ({
      id,
      title,
      authors: authors.map((author) => ({ id: author.id, name: author.name })),
    })),
    avatar: toAvatarResponse(profile.avatar),
    followerCount: profile.followerCount,
    followingCount: profile.followingCount,
    followedByMe: profile.followedByMe,
  };
}

export function toProfileSummaryPageResponse({
  items,
  nextOffset,
}: Page<ProfileSummary>): ProfileSummaryPageResponse {
  return { items: items.map(toProfileSummaryResponse), nextOffset };
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

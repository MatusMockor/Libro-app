import { z } from 'zod';
import {
  mediaVariantsSchema,
  toMediaVariantsResponse,
  urlsExpireAtSchema,
} from '../../media/index.js';
import { GENRES } from '../domain/genres.js';
import type { Avatar, Profile, ProfileSummary } from '../domain/profile.js';
import type { Page } from '../domain/profile-page.js';

const avatarSchema = z
  .object({
    variants: mediaVariantsSchema,
    urlsExpireAt: urlsExpireAtSchema('profile'),
  })
  .meta({ id: 'ProfileAvatar' });

const profileIdentity = {
  userId: z.uuid(),
  handle: z.string().meta({ example: 'jana.novakova' }),
  displayName: z.string().nullable(),
};

const officialSchema = z
  .boolean()
  .meta({ description: 'Whether this is an official Libro account (the app shows a badge)' });

const followedByMeSchema = z
  .boolean()
  .meta({ description: 'Whether the signed-in user follows this profile' });

export const profileSummarySchema = z
  .object({
    ...profileIdentity,
    avatar: avatarSchema.nullable(),
    official: officialSchema,
    followedByMe: followedByMeSchema,
  })
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
    official: officialSchema,
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
  official,
  followedByMe,
}: ProfileSummary): ProfileSummaryResponse {
  return { userId, handle, displayName, avatar: toAvatarResponse(avatar), official, followedByMe };
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
    official: profile.official,
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

  return { variants: toMediaVariantsResponse(variants), urlsExpireAt: urlsExpireAt.toISOString() };
}

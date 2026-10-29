import { Inject, Injectable } from '@nestjs/common';
import { BOOK_CATALOGUE, type BookCatalogue, type WorkSummary } from '../../books/index.js';
import { MEDIA_LIBRARY, type MediaLibrary, type MediaWithUrls } from '../../media/index.js';
import { isGenre } from '../domain/genres.js';
import type {
  Profile,
  ProfileSummary,
  StoredProfile,
  StoredProfileSummary,
} from '../domain/profile.js';

type Avatars = ReadonlyMap<string, MediaWithUrls>;

@Injectable()
export class ProfileAssemblerService {
  constructor(
    @Inject(BOOK_CATALOGUE) private readonly books: BookCatalogue,
    @Inject(MEDIA_LIBRARY) private readonly media: MediaLibrary,
  ) {}

  async profile(stored: StoredProfile): Promise<Profile> {
    const [works, avatars] = await Promise.all([
      this.books.findWorkSummaries(stored.topBookIds),
      this.avatarsOf([stored]),
    ]);

    return {
      ...summaryOf(stored, avatars),
      bio: stored.bio,
      favouriteGenres: stored.favouriteGenres.filter(isGenre),
      topBooks: stored.topBookIds
        .map((workId) => works.get(workId))
        .filter((work): work is WorkSummary => work !== undefined),
      followerCount: stored.followerCount,
      followingCount: stored.followingCount,
    };
  }

  async summaries(stored: readonly StoredProfileSummary[]): Promise<ProfileSummary[]> {
    const avatars = await this.avatarsOf(stored);

    return stored.map((profile) => summaryOf(profile, avatars));
  }

  private avatarsOf(profiles: readonly StoredProfileSummary[]): Promise<Avatars> {
    const mediaIds = profiles
      .map(({ avatarMediaId }) => avatarMediaId)
      .filter((mediaId): mediaId is string => mediaId !== null);

    return this.media.findMany([...new Set(mediaIds)]);
  }
}

function summaryOf(
  { userId, handle, displayName, avatarMediaId, followedByMe }: StoredProfileSummary,
  avatars: Avatars,
): ProfileSummary {
  const media = avatarMediaId === null ? undefined : avatars.get(avatarMediaId);

  return {
    userId,
    handle,
    displayName,
    avatar: media ? { variants: media.variants, urlsExpireAt: media.urlsExpireAt } : null,
    followedByMe,
  };
}

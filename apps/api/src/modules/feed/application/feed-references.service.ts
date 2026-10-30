import { Inject, Injectable } from '@nestjs/common';
import { BOOK_CATALOGUE, type BookCatalogue, type WorkSummary } from '../../books/index.js';
import type { MediaWithUrls } from '../../media/index.js';
import {
  PROFILE_DIRECTORY,
  type ProfileDirectory,
  type ProfileSummary,
} from '../../profiles/index.js';
import { PostPhotosService } from './post-photos.service.js';

export interface ReferenceIds {
  readonly profileIds: readonly string[];
  readonly workIds: readonly string[];
  readonly mediaIds: readonly string[];
}

export interface FeedReferences {
  readonly profiles: ReadonlyMap<string, ProfileSummary>;
  readonly works: ReadonlyMap<string, WorkSummary>;
  readonly photos: ReadonlyMap<string, MediaWithUrls>;
}

export const NO_REFERENCE_IDS: ReferenceIds = { profileIds: [], workIds: [], mediaIds: [] };

export function mergeReferenceIds(all: readonly ReferenceIds[]): ReferenceIds {
  return {
    profileIds: all.flatMap(({ profileIds }) => profileIds),
    workIds: all.flatMap(({ workIds }) => workIds),
    mediaIds: all.flatMap(({ mediaIds }) => mediaIds),
  };
}

@Injectable()
export class FeedReferencesService {
  constructor(
    @Inject(PROFILE_DIRECTORY) private readonly profiles: ProfileDirectory,
    @Inject(BOOK_CATALOGUE) private readonly books: BookCatalogue,
    private readonly photos: PostPhotosService,
  ) {}

  async resolve(
    viewerId: string,
    { profileIds, workIds, mediaIds }: ReferenceIds,
  ): Promise<FeedReferences> {
    const [profiles, works, photos] = await Promise.all([
      this.profiles.findSummaries(viewerId, profileIds),
      this.books.findWorkSummaries(workIds),
      this.photos.findAll(mediaIds),
    ]);

    return { profiles, works, photos };
  }
}

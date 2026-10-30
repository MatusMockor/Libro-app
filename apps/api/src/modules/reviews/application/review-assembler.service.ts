import { Inject, Injectable } from '@nestjs/common';
import { BOOK_CATALOGUE, type BookCatalogue, type WorkSummary } from '../../books/index.js';
import { MEDIA_LIBRARY, type MediaLibrary, type MediaWithUrls } from '../../media/index.js';
import {
  PROFILE_DIRECTORY,
  type ProfileDirectory,
  type ProfileSummary,
} from '../../profiles/index.js';
import type { Review, ReviewPhoto, StoredReview } from '../domain/review.js';

interface ReviewReferences {
  readonly readers: ReadonlyMap<string, ProfileSummary>;
  readonly works: ReadonlyMap<string, WorkSummary>;
  readonly photos: ReadonlyMap<string, MediaWithUrls>;
}

@Injectable()
export class ReviewAssemblerService {
  constructor(
    @Inject(PROFILE_DIRECTORY) private readonly profiles: ProfileDirectory,
    @Inject(BOOK_CATALOGUE) private readonly books: BookCatalogue,
    @Inject(MEDIA_LIBRARY) private readonly media: MediaLibrary,
  ) {}

  async review(viewerId: string, stored: StoredReview): Promise<Review> {
    return assemble(stored, await this.referencesOf(viewerId, [stored]));
  }

  async reviews(viewerId: string, stored: readonly StoredReview[]): Promise<Review[]> {
    const references = await this.referencesOf(viewerId, stored);

    return stored.map((review) => assemble(review, references));
  }

  private async referencesOf(
    viewerId: string,
    stored: readonly StoredReview[],
  ): Promise<ReviewReferences> {
    const photoIds = stored
      .map(({ photoMediaId }) => photoMediaId)
      .filter((mediaId): mediaId is string => mediaId !== null);
    const [readers, works, photos] = await Promise.all([
      this.profiles.findSummaries(
        viewerId,
        stored.map(({ userId }) => userId),
      ),
      this.books.findWorkSummaries(stored.map(({ workId }) => workId)),
      this.media.findMany(photoIds),
    ]);

    return { readers, works, photos };
  }
}

function assemble(stored: StoredReview, { readers, works, photos }: ReviewReferences): Review {
  return {
    readingId: stored.readingId,
    userId: stored.userId,
    workId: stored.workId,
    rating: stored.rating,
    text: stored.text,
    finishedAt: stored.finishedAt,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    reader: readers.get(stored.userId) ?? null,
    book: works.get(stored.workId) ?? null,
    photo: photoOf(stored.photoMediaId, photos),
  };
}

function photoOf(
  mediaId: string | null,
  photos: ReadonlyMap<string, MediaWithUrls>,
): ReviewPhoto | null {
  const media = mediaId === null ? undefined : photos.get(mediaId);
  if (!media) {
    return null;
  }

  const { id, width, height, variants, urlsExpireAt } = media;

  return { id, width, height, variants, urlsExpireAt };
}

import { Inject, Injectable } from '@nestjs/common';
import { BOOK_CATALOGUE, type BookCatalogue, type WorkSummary } from '../../books/index.js';
import {
  PROFILE_DIRECTORY,
  type ProfileDirectory,
  type ProfileSummary,
} from '../../profiles/index.js';
import type { Review, StoredReview } from '../domain/review.js';

interface ReviewReferences {
  readonly readers: ReadonlyMap<string, ProfileSummary>;
  readonly works: ReadonlyMap<string, WorkSummary>;
}

@Injectable()
export class ReviewAssemblerService {
  constructor(
    @Inject(PROFILE_DIRECTORY) private readonly profiles: ProfileDirectory,
    @Inject(BOOK_CATALOGUE) private readonly books: BookCatalogue,
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
    const [readers, works] = await Promise.all([
      this.profiles.findSummaries(
        viewerId,
        stored.map(({ userId }) => userId),
      ),
      this.books.findWorkSummaries(stored.map(({ workId }) => workId)),
    ]);

    return { readers, works };
  }
}

function assemble(stored: StoredReview, { readers, works }: ReviewReferences): Review {
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
  };
}

import { Inject, Injectable } from '@nestjs/common';
import { BOOK_CATALOGUE, BookNotFoundException, type BookCatalogue } from '../../books/index.js';
import { MEDIA_LIBRARY, MediaNotFoundException, type MediaLibrary } from '../../media/index.js';
import type { ProfileChanges } from '../domain/profile.js';

@Injectable()
export class ProfileReferencesService {
  constructor(
    @Inject(BOOK_CATALOGUE) private readonly books: BookCatalogue,
    @Inject(MEDIA_LIBRARY) private readonly media: MediaLibrary,
  ) {}

  async verify(userId: string, { topBookIds, avatarMediaId }: ProfileChanges): Promise<void> {
    await this.verifyTopBooks(topBookIds ?? []);
    await this.verifyAvatar(userId, avatarMediaId ?? null);
  }

  private async verifyTopBooks(workIds: readonly string[]): Promise<void> {
    if (workIds.length === 0) {
      return;
    }

    const found = await this.books.findWorkSummaries(workIds);
    const missing = workIds.find((workId) => !found.has(workId));
    if (missing !== undefined) {
      throw new BookNotFoundException(missing);
    }
  }

  private async verifyAvatar(userId: string, mediaId: string | null): Promise<void> {
    if (mediaId === null) {
      return;
    }

    if (!(await this.media.findOwned(userId, mediaId))) {
      throw new MediaNotFoundException(mediaId);
    }
  }
}

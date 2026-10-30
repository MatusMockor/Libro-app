import { Inject, Injectable } from '@nestjs/common';
import { BOOK_CATALOGUE, type BookCatalogue, type WorkSummary } from '../../books/index.js';
import type { MediaWithUrls } from '../../media/index.js';
import {
  PROFILE_DIRECTORY,
  type ProfileDirectory,
  type ProfileSummary,
} from '../../profiles/index.js';
import type { Post, StoredPost } from '../domain/post.js';
import type { PostPhoto } from '../domain/post-photo.js';
import { inReactionOrder } from '../domain/reactions.js';
import { PostPhotosService } from './post-photos.service.js';

interface PostReferences {
  readonly authors: ReadonlyMap<string, ProfileSummary>;
  readonly works: ReadonlyMap<string, WorkSummary>;
  readonly photos: ReadonlyMap<string, MediaWithUrls>;
}

@Injectable()
export class PostAssemblerService {
  constructor(
    @Inject(PROFILE_DIRECTORY) private readonly profiles: ProfileDirectory,
    @Inject(BOOK_CATALOGUE) private readonly books: BookCatalogue,
    private readonly photos: PostPhotosService,
  ) {}

  async post(viewerId: string, stored: StoredPost): Promise<Post> {
    return assemble(stored, await this.referencesOf(viewerId, [stored]));
  }

  async posts(viewerId: string, stored: readonly StoredPost[]): Promise<Post[]> {
    const references = await this.referencesOf(viewerId, stored);

    return stored.map((post) => assemble(post, references));
  }

  private async referencesOf(
    viewerId: string,
    stored: readonly StoredPost[],
  ): Promise<PostReferences> {
    const workIds = stored
      .map(({ workId }) => workId)
      .filter((workId): workId is string => workId !== null);
    const [authors, works, photos] = await Promise.all([
      this.profiles.findSummaries(
        viewerId,
        stored.map(({ authorId }) => authorId),
      ),
      this.books.findWorkSummaries(workIds),
      this.photos.findAll(stored.flatMap(({ photoIds }) => photoIds)),
    ]);

    return { authors, works, photos };
  }
}

function assemble(
  { workId, photoIds, reactions, ...post }: StoredPost,
  references: PostReferences,
): Post {
  return {
    ...post,
    reactions: inReactionOrder(reactions),
    author: references.authors.get(post.authorId) ?? null,
    book: workId === null ? null : (references.works.get(workId) ?? null),
    photos: photoIds
      .map((mediaId) => references.photos.get(mediaId))
      .filter((media): media is MediaWithUrls => media !== undefined)
      .map(toPostPhoto),
  };
}

function toPostPhoto({ id, width, height, variants, urlsExpireAt }: MediaWithUrls): PostPhoto {
  return { id, width, height, variants, urlsExpireAt };
}

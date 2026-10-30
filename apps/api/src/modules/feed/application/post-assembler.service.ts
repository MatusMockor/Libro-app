import { Injectable } from '@nestjs/common';
import type { Post, StoredPost } from '../domain/post.js';
import { FeedReferencesService } from './feed-references.service.js';
import { assemblePost, postReferenceIds } from './post-assembly.js';

@Injectable()
export class PostAssemblerService {
  constructor(private readonly references: FeedReferencesService) {}

  async post(viewerId: string, stored: StoredPost): Promise<Post> {
    return assemblePost(
      stored,
      await this.references.resolve(viewerId, postReferenceIds([stored])),
    );
  }

  async posts(viewerId: string, stored: readonly StoredPost[]): Promise<Post[]> {
    const references = await this.references.resolve(viewerId, postReferenceIds(stored));

    return stored.map((post) => assemblePost(post, references));
  }
}

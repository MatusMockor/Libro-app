import { Inject, Injectable } from '@nestjs/common';
import { LIKE_REPOSITORY, type LikeRepository } from './like-repository.js';
import { ensurePostExists } from './ensure-post-exists.js';

@Injectable()
export class LikeService {
  constructor(@Inject(LIKE_REPOSITORY) private readonly likes: LikeRepository) {}

  async like(userId: string, postId: string): Promise<void> {
    ensurePostExists(await this.likes.like(postId, userId));
  }

  async unlike(userId: string, postId: string): Promise<void> {
    ensurePostExists(await this.likes.unlike(postId, userId));
  }
}

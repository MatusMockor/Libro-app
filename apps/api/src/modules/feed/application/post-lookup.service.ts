import { Inject, Injectable } from '@nestjs/common';
import type { Post } from '../domain/post.js';
import { PostAssemblerService } from './post-assembler.service.js';
import { PostNotFoundException } from './post-not-found.exception.js';
import { POST_REPOSITORY, type PostRepository } from './post-repository.js';

@Injectable()
export class PostLookupService {
  constructor(
    @Inject(POST_REPOSITORY) private readonly posts: PostRepository,
    private readonly assembler: PostAssemblerService,
  ) {}

  async get(viewerId: string, postId: string): Promise<Post> {
    const stored = await this.posts.find(viewerId, postId);
    if (!stored) {
      throw new PostNotFoundException();
    }

    return this.assembler.post(viewerId, stored);
  }
}

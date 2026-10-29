import { Inject, Injectable } from '@nestjs/common';
import { PostNotFoundException } from './post-not-found.exception.js';
import { POST_REPOSITORY, type PostRepository } from './post-repository.js';

@Injectable()
export class DeletePostService {
  constructor(@Inject(POST_REPOSITORY) private readonly posts: PostRepository) {}

  async delete(authorId: string, postId: string): Promise<void> {
    if (!(await this.posts.deleteOwned(authorId, postId))) {
      throw new PostNotFoundException();
    }
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { BOOK_CATALOGUE, BookNotFoundException, type BookCatalogue } from '../../books/index.js';
import { EVENT_BUS, type EventBus } from '../../../events/event-bus.js';
import type { NewPost, Post } from '../domain/post.js';
import { POST_LIMIT } from '../domain/post-limit.js';
import { PostCreated } from '../events/post-created.event.js';
import { PostLimitReachedException } from './post-limit-reached.exception.js';
import { PostLookupService } from './post-lookup.service.js';
import { POST_REPOSITORY, type PostRepository } from './post-repository.js';

@Injectable()
export class CreatePostService {
  constructor(
    @Inject(POST_REPOSITORY) private readonly posts: PostRepository,
    @Inject(BOOK_CATALOGUE) private readonly books: BookCatalogue,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    private readonly lookup: PostLookupService,
  ) {}

  async create(post: NewPost): Promise<Post> {
    await this.ensureBookExists(post.workId);

    const outcome = await this.posts.create(post, POST_LIMIT);
    if (outcome.kind === 'limit_reached') {
      throw new PostLimitReachedException(POST_LIMIT, outcome.retryAfterSeconds);
    }

    await this.events.publish(
      PostCreated.create({ postId: outcome.postId, authorId: post.authorId }),
    );

    return this.lookup.get(post.authorId, outcome.postId);
  }

  private async ensureBookExists(workId: string | null): Promise<void> {
    if (workId === null || (await this.books.workExists(workId))) {
      return;
    }

    throw new BookNotFoundException(workId);
  }
}

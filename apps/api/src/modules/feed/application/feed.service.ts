import { Inject, Injectable } from '@nestjs/common';
import { SOCIAL_GRAPH, type SocialGraph } from '../../profiles/index.js';
import { lookahead, pageOf, type FeedPage, type FeedPageQuery } from '../domain/feed-page.js';
import type { Post, StoredPost } from '../domain/post.js';
import { PostAssemblerService } from './post-assembler.service.js';
import { POST_REPOSITORY, type PostRepository } from './post-repository.js';

@Injectable()
export class FeedService {
  constructor(
    @Inject(POST_REPOSITORY) private readonly posts: PostRepository,
    @Inject(SOCIAL_GRAPH) private readonly graph: SocialGraph,
    private readonly assembler: PostAssemblerService,
  ) {}

  async following(viewerId: string, page: FeedPageQuery): Promise<FeedPage<Post>> {
    const authorIds = [viewerId, ...(await this.graph.followeeIdsOf(viewerId))];

    return this.byAuthorIds(viewerId, authorIds, page);
  }

  async community(viewerId: string, page: FeedPageQuery): Promise<FeedPage<Post>> {
    return this.page(viewerId, await this.posts.listAll(viewerId, lookahead(page)), page);
  }

  byAuthor(viewerId: string, authorId: string, page: FeedPageQuery): Promise<FeedPage<Post>> {
    return this.byAuthorIds(viewerId, [authorId], page);
  }

  private async byAuthorIds(
    viewerId: string,
    authorIds: readonly string[],
    page: FeedPageQuery,
  ): Promise<FeedPage<Post>> {
    const found = await this.posts.listByAuthors(viewerId, authorIds, lookahead(page));

    return this.page(viewerId, found, page);
  }

  private async page(
    viewerId: string,
    found: readonly StoredPost[],
    query: FeedPageQuery,
  ): Promise<FeedPage<Post>> {
    const { items, nextCursor } = pageOf(found, query);

    return { items: await this.assembler.posts(viewerId, items), nextCursor };
  }
}

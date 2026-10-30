import type { FeedPageQuery } from '../domain/feed-page.js';
import type { NewPost, StoredPost } from '../domain/post.js';
import type { PostLimit } from '../domain/post-limit.js';

export const POST_REPOSITORY = Symbol('POST_REPOSITORY');

export type CreatePostOutcome =
  | { readonly kind: 'created'; readonly postId: string }
  | { readonly kind: 'limit_reached'; readonly retryAfterSeconds: number };

export interface PostRepository {
  create(post: NewPost, limit: PostLimit): Promise<CreatePostOutcome>;
  find(viewerId: string, postId: string): Promise<StoredPost | undefined>;
  findMany(viewerId: string, postIds: readonly string[]): Promise<StoredPost[]>;
  deleteOwned(authorId: string, postId: string): Promise<boolean>;
  listAll(viewerId: string, page: FeedPageQuery): Promise<StoredPost[]>;
  listByAuthors(
    viewerId: string,
    authorIds: readonly string[],
    page: FeedPageQuery,
  ): Promise<StoredPost[]>;
}

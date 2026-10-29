export const FEED_ERASURE_REPOSITORY = Symbol('FEED_ERASURE_REPOSITORY');

export interface FeedErasureRepository {
  eraseUser(userId: string): Promise<void>;
}

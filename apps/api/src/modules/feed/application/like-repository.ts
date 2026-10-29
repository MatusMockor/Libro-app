export const LIKE_REPOSITORY = Symbol('LIKE_REPOSITORY');

export interface LikeRepository {
  like(postId: string, userId: string): Promise<boolean>;
  unlike(postId: string, userId: string): Promise<boolean>;
}

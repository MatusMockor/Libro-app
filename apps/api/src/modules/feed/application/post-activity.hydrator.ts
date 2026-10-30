import { Inject, Injectable } from '@nestjs/common';
import type { StoredActivity } from '../domain/activity.js';
import type { ActivityHydrator, HydrationPlan } from './activity-hydrator.js';
import { assemblePost, postReferenceIds } from './post-assembly.js';
import { POST_REPOSITORY, type PostRepository } from './post-repository.js';

@Injectable()
export class PostActivityHydrator implements ActivityHydrator {
  constructor(@Inject(POST_REPOSITORY) private readonly posts: PostRepository) {}

  async plan(viewerId: string, activities: readonly StoredActivity[]): Promise<HydrationPlan> {
    const postIds = activities
      .map(({ postId }) => postId)
      .filter((postId): postId is string => postId !== null);
    const found = await this.posts.findMany(viewerId, postIds);
    const posts = new Map(found.map((post) => [post.id, post]));

    return {
      references: postReferenceIds(found),
      detailsOf: ({ postId }, references) => {
        const stored = postId === null ? undefined : posts.get(postId);

        return stored && { post: assemblePost(stored, references), reading: null };
      },
    };
  }
}

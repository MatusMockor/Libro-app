import { Inject, Injectable } from '@nestjs/common';
import { PROFILE_DIRECTORY, type ProfileDirectory } from '../../profiles/index.js';
import { lookahead, pageOf, type FeedPage, type FeedPageQuery } from '../domain/feed-page.js';
import type { Reaction, ReactionTarget } from '../domain/reaction.js';
import { ensurePostExists } from './ensure-post-exists.js';
import { PostNotFoundException } from './post-not-found.exception.js';
import { REACTION_REPOSITORY, type ReactionRepository } from './reaction-repository.js';

@Injectable()
export class ReactionService {
  constructor(
    @Inject(REACTION_REPOSITORY) private readonly reactions: ReactionRepository,
    @Inject(PROFILE_DIRECTORY) private readonly profiles: ProfileDirectory,
  ) {}

  async add(target: ReactionTarget): Promise<void> {
    ensurePostExists(await this.reactions.add(target));
  }

  async remove(target: ReactionTarget): Promise<void> {
    ensurePostExists(await this.reactions.remove(target));
  }

  async list(viewerId: string, postId: string, query: FeedPageQuery): Promise<FeedPage<Reaction>> {
    const found = await this.reactions.listOf(postId, lookahead(query));
    if (!found) {
      throw new PostNotFoundException();
    }

    const { items, nextCursor } = pageOf(found, query);
    const users = await this.profiles.findSummaries(
      viewerId,
      items.map(({ userId }) => userId),
    );

    return {
      items: items.map((reaction) => ({ ...reaction, user: users.get(reaction.userId) ?? null })),
      nextCursor,
    };
  }
}

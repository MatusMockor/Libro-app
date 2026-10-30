import { Inject, Injectable } from '@nestjs/common';
import { SOCIAL_GRAPH, type SocialGraph } from '../../profiles/index.js';

@Injectable()
export class ReviewAudienceService {
  constructor(@Inject(SOCIAL_GRAPH) private readonly graph: SocialGraph) {}

  async canSee(viewerId: string, readerId: string): Promise<boolean> {
    if (viewerId === readerId) {
      return true;
    }

    return this.graph.isFollowing(viewerId, readerId);
  }

  async readersVisibleTo(viewerId: string): Promise<string[]> {
    return [viewerId, ...(await this.graph.followeeIdsOf(viewerId))];
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { SOCIAL_GRAPH, type SocialGraph } from '../../profiles/index.js';
import type { SessionViewer } from '../domain/reading-group.js';

@Injectable()
export class SessionViewersService {
  constructor(@Inject(SOCIAL_GRAPH) private readonly socialGraph: SocialGraph) {}

  async of(userId: string): Promise<SessionViewer> {
    return { userId, followeeIds: await this.socialGraph.followeeIdsOf(userId) };
  }
}

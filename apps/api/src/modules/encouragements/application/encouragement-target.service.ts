import { Inject, Injectable } from '@nestjs/common';
import { SOCIAL_GRAPH, type SocialGraph } from '../../profiles/index.js';
import {
  READING_HISTORY,
  ReadingNotFoundException,
  type ReadingHistory,
  type ReadingSummary,
} from '../../reading-sessions/index.js';
import { CannotEncourageOwnReadingException } from './cannot-encourage-own-reading.exception.js';

@Injectable()
export class EncouragementTargetService {
  constructor(
    @Inject(READING_HISTORY) private readonly history: ReadingHistory,
    @Inject(SOCIAL_GRAPH) private readonly graph: SocialGraph,
  ) {}

  async visibleReading(viewerId: string, readingId: string): Promise<ReadingSummary> {
    const ownerIds = [viewerId, ...(await this.graph.followeeIdsOf(viewerId))];

    return this.readingAmong(readingId, ownerIds);
  }

  async foreignReading(authorId: string, readingId: string): Promise<ReadingSummary> {
    const reading = await this.visibleReading(authorId, readingId);
    if (reading.userId === authorId) {
      throw new CannotEncourageOwnReadingException();
    }

    return reading;
  }

  ownReading(userId: string, readingId: string): Promise<ReadingSummary> {
    return this.readingAmong(readingId, [userId]);
  }

  private async readingAmong(
    readingId: string,
    ownerIds: readonly string[],
  ): Promise<ReadingSummary> {
    const reading = await this.history.findReadingSummary(readingId, ownerIds);
    if (!reading) {
      throw new ReadingNotFoundException();
    }

    return reading;
  }
}

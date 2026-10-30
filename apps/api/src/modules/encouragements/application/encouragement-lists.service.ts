import { Inject, Injectable } from '@nestjs/common';
import type { Encouragement, StoredEncouragement } from '../domain/encouragement.js';
import {
  lookahead,
  pageOf,
  type EncouragementPage,
  type EncouragementPageQuery,
} from '../domain/encouragement-page.js';
import { EncouragementAuthorsService } from './encouragement-authors.service.js';
import {
  ENCOURAGEMENT_REPOSITORY,
  type EncouragementRepository,
} from './encouragement-repository.js';
import { EncouragementTargetService } from './encouragement-target.service.js';

@Injectable()
export class EncouragementListsService {
  constructor(
    @Inject(ENCOURAGEMENT_REPOSITORY) private readonly encouragements: EncouragementRepository,
    private readonly targets: EncouragementTargetService,
    private readonly authors: EncouragementAuthorsService,
  ) {}

  async ofReading(
    viewerId: string,
    readingId: string,
    page: EncouragementPageQuery,
  ): Promise<EncouragementPage<Encouragement>> {
    const reading = await this.targets.visibleReading(viewerId, readingId);
    const found = await this.encouragements.list({
      ...lookahead(page),
      readingId,
      authorId: reading.userId === viewerId ? null : viewerId,
    });
    const { items, nextCursor } = pageOf(found, page);

    return { items: await this.authors.withAuthors(viewerId, items.map(toEntry)), nextCursor };
  }
}

function toEntry(stored: StoredEncouragement): Omit<StoredEncouragement, 'cursorAt'> {
  return {
    decorationId: stored.decorationId,
    kind: stored.kind,
    insightId: stored.insightId,
    authorId: stored.authorId,
    text: stored.text,
    createdAt: stored.createdAt,
  };
}

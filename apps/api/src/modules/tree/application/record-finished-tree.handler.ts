import { Injectable } from '@nestjs/common';
import { OnDomainEvent } from '../../../events/on-domain-event.decorator.js';
import { BookFinished } from '../../reading-sessions/index.js';
import { FinishedTreeVersionsService } from './finished-tree-versions.service.js';

@Injectable()
export class RecordFinishedTreeHandler {
  constructor(private readonly versions: FinishedTreeVersionsService) {}

  @OnDomainEvent(BookFinished)
  async onBookFinished({ payload }: BookFinished): Promise<void> {
    await this.versions.record(payload.userId, payload.readingId);
  }
}

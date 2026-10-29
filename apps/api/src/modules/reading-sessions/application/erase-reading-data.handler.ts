import { Inject, Injectable } from '@nestjs/common';
import { OnDomainEvent } from '../../../events/on-domain-event.decorator.js';
import { UserDeleted } from '../../auth/index.js';
import { READING_REPOSITORY, type ReadingRepository } from './reading-repository.js';

@Injectable()
export class EraseReadingDataHandler {
  constructor(@Inject(READING_REPOSITORY) private readonly readings: ReadingRepository) {}

  @OnDomainEvent(UserDeleted)
  async onUserDeleted({ payload }: UserDeleted): Promise<void> {
    await this.readings.deleteAllOf(payload.userId);
  }
}

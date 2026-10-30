import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../events/event-bus.js';
import { CongratulationAdded } from '../events/congratulation-added.event.js';
import {
  CONGRATULATION_REPOSITORY,
  type CongratulationRepository,
} from './congratulation-repository.js';
import { EncouragementTargetService } from './encouragement-target.service.js';
import { ReadingNotFinishedException } from './reading-not-finished.exception.js';

@Injectable()
export class CongratulationsService {
  constructor(
    @Inject(CONGRATULATION_REPOSITORY) private readonly congratulations: CongratulationRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    private readonly targets: EncouragementTargetService,
  ) {}

  async congratulate(authorId: string, readingId: string): Promise<void> {
    const reading = await this.targets.foreignReading(authorId, readingId);
    if (reading.finishedAt === null) {
      throw new ReadingNotFinishedException();
    }

    const congratulation = { readingId, readerId: reading.userId, authorId };
    if (await this.congratulations.add(congratulation)) {
      await this.events.publish(CongratulationAdded.create(congratulation));
    }
  }

  withdraw(authorId: string, readingId: string): Promise<void> {
    return this.congratulations.delete({ readingId, authorId });
  }

  async remove(readerId: string, readingId: string, authorId: string): Promise<void> {
    await this.targets.ownReading(readerId, readingId);
    await this.congratulations.delete({ readingId, authorId });
  }
}

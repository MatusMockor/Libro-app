import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../events/event-bus.js';
import type { NewWork, Work } from '../domain/work.js';
import { BookAddedToCatalogue } from '../events/book-added-to-catalogue.event.js';
import { WORK_REPOSITORY, type WorkRepository } from './work-repository.js';

@Injectable()
export class AddBookService {
  constructor(
    @Inject(WORK_REPOSITORY) private readonly works: WorkRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  async add(book: NewWork): Promise<Work> {
    const work = await this.works.add(book);

    await this.events.publish(
      BookAddedToCatalogue.create({
        workId: work.id,
        editionIds: work.editions.map((edition) => edition.id),
      }),
    );

    return work;
  }
}

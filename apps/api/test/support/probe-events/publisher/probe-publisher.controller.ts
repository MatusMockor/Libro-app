import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { z } from 'zod';
import { EVENT_BUS, type EventBus } from '../../../../src/events/event-bus.js';
import { Public } from '../../../../src/http/authentication/public.decorator.js';
import { ProbeBookFinished, ProbeBookFinishedV2 } from '../probe-book-finished.event.js';

const finishedBookSchema = z.object({
  bookId: z.uuid(),
  readerId: z.uuid(),
  occurredAt: z.iso.datetime(),
});

const finishedBookV2Schema = finishedBookSchema.extend({
  pages: z.number().int().positive(),
});

type FinishedBook = z.infer<typeof finishedBookSchema>;
type FinishedBookV2 = z.infer<typeof finishedBookV2Schema>;

@Public()
@Controller('probe-events')
export class ProbePublisherController {
  constructor(@Inject(EVENT_BUS) private readonly events: EventBus) {}

  @Post('finished-books')
  @HttpCode(HttpStatus.NO_CONTENT)
  async finish(@Body({ schema: finishedBookSchema }) body: FinishedBook): Promise<void> {
    await this.events.publish(
      ProbeBookFinished.create(
        { bookId: body.bookId, readerId: body.readerId },
        new Date(body.occurredAt),
      ),
    );
  }

  @Post('finished-books-v2')
  @HttpCode(HttpStatus.NO_CONTENT)
  async finishV2(@Body({ schema: finishedBookV2Schema }) body: FinishedBookV2): Promise<void> {
    await this.events.publish(
      ProbeBookFinishedV2.create(
        { bookId: body.bookId, readerId: body.readerId, pages: body.pages },
        new Date(body.occurredAt),
      ),
    );
  }
}

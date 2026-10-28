import { Injectable } from '@nestjs/common';
import { OnDomainEvent } from '../../../../src/events/on-domain-event.decorator.js';
import { BookAddedToCatalogue } from '../../../../src/modules/books/index.js';
import { ProbeEventRecorder } from '../subscriber/probe-event-recorder.js';

@Injectable()
export class ProbeBookAddedHandler {
  constructor(private readonly recorder: ProbeEventRecorder) {}

  @OnDomainEvent(BookAddedToCatalogue)
  onBookAdded(event: BookAddedToCatalogue): void {
    this.recorder.record('books.v1', event);
  }
}

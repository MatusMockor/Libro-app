import { Injectable } from '@nestjs/common';
import { assert } from 'vitest';
import { OnDomainEvent } from '../../../../src/events/on-domain-event.decorator.js';
import { ProbeBookFinished } from '../probe-book-finished.event.js';

@Injectable()
export class ProbeFailingHandler {
  @OnDomainEvent(ProbeBookFinished)
  throwing(): void {
    assert.fail('shelf index is corrupted');
  }

  @OnDomainEvent(ProbeBookFinished)
  rejecting(): Promise<void> {
    return Promise.reject(new Error('stats store is unavailable'));
  }
}

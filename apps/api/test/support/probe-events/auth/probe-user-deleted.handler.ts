import { Injectable } from '@nestjs/common';
import { OnDomainEvent } from '../../../../src/events/on-domain-event.decorator.js';
import { UserDeleted } from '../../../../src/modules/auth/index.js';
import { ProbeEventRecorder } from '../subscriber/probe-event-recorder.js';

@Injectable()
export class ProbeUserDeletedHandler {
  constructor(private readonly recorder: ProbeEventRecorder) {}

  @OnDomainEvent(UserDeleted)
  onUserDeleted(event: UserDeleted): void {
    this.recorder.record('auth.deleted.v1', event);
  }
}

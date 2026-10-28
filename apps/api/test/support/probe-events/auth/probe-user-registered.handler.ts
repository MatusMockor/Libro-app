import { Injectable } from '@nestjs/common';
import { OnDomainEvent } from '../../../../src/events/on-domain-event.decorator.js';
import { UserRegistered } from '../../../../src/modules/auth/index.js';
import { ProbeEventRecorder } from '../subscriber/probe-event-recorder.js';

@Injectable()
export class ProbeUserRegisteredHandler {
  constructor(private readonly recorder: ProbeEventRecorder) {}

  @OnDomainEvent(UserRegistered)
  onUserRegistered(event: UserRegistered): void {
    this.recorder.record('auth.v1', event);
  }
}

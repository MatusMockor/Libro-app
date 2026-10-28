import { Injectable, Scope } from '@nestjs/common';
import { OnDomainEvent } from '../../../../src/events/on-domain-event.decorator.js';
import { ProbeBookFinished } from '../probe-book-finished.event.js';

@Injectable({ scope: Scope.REQUEST })
export class ProbeRequestScopedHandler {
  @OnDomainEvent(ProbeBookFinished)
  onBookFinished(): void {}
}

@Injectable({ scope: Scope.TRANSIENT })
export class ProbeTransientHandler {
  @OnDomainEvent(ProbeBookFinished)
  onBookFinished(): void {}
}

@Injectable({ scope: Scope.REQUEST })
export class ProbeRequestContext {}

@Injectable()
export class ProbeInheritedScopeHandler {
  constructor(readonly context: ProbeRequestContext) {}

  @OnDomainEvent(ProbeBookFinished)
  onBookFinished(): void {}
}

import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../events/event-bus.js';
import { DELETION_REPLAY_DELAYS_MS } from '../domain/account-deletion.js';
import { UserDeleted } from '../events/user-deleted.event.js';
import { TASK_SCHEDULER, type TaskScheduler } from './task-scheduler.js';

@Injectable()
export class DeletionReplayService {
  constructor(
    @Inject(TASK_SCHEDULER) private readonly scheduler: TaskScheduler,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  scheduleFor(userId: string): void {
    for (const delayMs of DELETION_REPLAY_DELAYS_MS) {
      this.scheduler.schedule(delayMs, () => this.events.publish(UserDeleted.create({ userId })));
    }
  }
}

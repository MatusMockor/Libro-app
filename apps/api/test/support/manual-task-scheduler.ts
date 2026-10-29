import type {
  ScheduledTask,
  TaskScheduler,
} from '../../src/modules/auth/application/task-scheduler.js';

interface Scheduled {
  readonly delayMs: number;
  readonly task: ScheduledTask;
}

export class ManualTaskScheduler implements TaskScheduler {
  private scheduled: Scheduled[] = [];

  schedule(delayMs: number, task: ScheduledTask): void {
    this.scheduled.push({ delayMs, task });
  }

  delays(): number[] {
    return this.scheduled.map(({ delayMs }) => delayMs);
  }

  async runNext(): Promise<void> {
    const [next, ...rest] = this.scheduled;
    this.scheduled = rest;
    await next?.task();
  }

  clear(): void {
    this.scheduled = [];
  }
}

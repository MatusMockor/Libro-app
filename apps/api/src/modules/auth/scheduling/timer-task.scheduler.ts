import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import type { ScheduledTask, TaskScheduler } from '../application/task-scheduler.js';

@Injectable()
export class TimerTaskScheduler implements TaskScheduler, OnApplicationShutdown {
  private readonly logger = new Logger(TimerTaskScheduler.name);

  private readonly timers = new Set<NodeJS.Timeout>();

  schedule(delayMs: number, task: ScheduledTask): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      void this.run(task);
    }, delayMs);
    timer.unref();
    this.timers.add(timer);
  }

  onApplicationShutdown(): void {
    this.timers.forEach((timer) => {
      clearTimeout(timer);
    });
    this.timers.clear();
  }

  private async run(task: ScheduledTask): Promise<void> {
    try {
      await task();
    } catch (error) {
      this.logger.error(
        `Scheduled task failed: ${String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}

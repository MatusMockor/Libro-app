export const TASK_SCHEDULER = Symbol('TASK_SCHEDULER');

export type ScheduledTask = () => Promise<void>;

export interface TaskScheduler {
  schedule(delayMs: number, task: ScheduledTask): void;
}

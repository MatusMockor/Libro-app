import { afterEach, describe, expect, test, vi } from 'vitest';
import { TimerTaskScheduler } from '../../../src/modules/auth/scheduling/timer-task.scheduler.js';

describe('TimerTaskScheduler', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('runs a task once its delay has passed', async () => {
    vi.useFakeTimers();
    const scheduler = new TimerTaskScheduler();
    const task = vi.fn(() => Promise.resolve());

    scheduler.schedule(120_000, task);
    await vi.advanceTimersByTimeAsync(119_999);
    const beforeDelay = task.mock.calls.length;
    await vi.advanceTimersByTimeAsync(1);

    expect(beforeDelay).toBe(0);
    expect(task).toHaveBeenCalledTimes(1);
  });

  test('clears every pending timer on application shutdown', async () => {
    vi.useFakeTimers();
    const scheduler = new TimerTaskScheduler();
    const task = vi.fn(() => Promise.resolve());
    scheduler.schedule(120_000, task);
    scheduler.schedule(600_000, task);

    scheduler.onApplicationShutdown();
    await vi.advanceTimersByTimeAsync(600_000);

    expect(task).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  test('does not keep the process alive for a pending timer', () => {
    const timeouts = vi.spyOn(globalThis, 'setTimeout');
    const scheduler = new TimerTaskScheduler();

    scheduler.schedule(600_000, () => Promise.resolve());
    const timer = timeouts.mock.results[0]?.value as NodeJS.Timeout | undefined;
    scheduler.onApplicationShutdown();

    expect(timer?.hasRef()).toBe(false);
  });

  test('keeps running when a task fails', async () => {
    vi.useFakeTimers();
    const scheduler = new TimerTaskScheduler();
    const after = vi.fn(() => Promise.resolve());
    scheduler.schedule(1_000, () => Promise.reject(new Error('replay failed')));
    scheduler.schedule(2_000, after);

    await vi.advanceTimersByTimeAsync(2_000);

    expect(after).toHaveBeenCalledTimes(1);
  });
});

import { ConsoleLogger, type LoggerService } from '@nestjs/common';
import { describe, expect, onTestFinished } from 'vitest';
import { integrationTest } from './support/integration-test.js';
import { ProbeFailingModule } from './support/probe-events/failing/probe-failing.module.js';
import { ProbePublisherModule } from './support/probe-events/publisher/probe-publisher.module.js';
import { ProbeEventRecorder } from './support/probe-events/subscriber/probe-event-recorder.js';
import { ProbeSubscriberModule } from './support/probe-events/subscriber/probe-subscriber.module.js';

const test = integrationTest({
  imports: [ProbePublisherModule, ProbeFailingModule, ProbeSubscriberModule],
});

const FINISHED_BOOK = {
  bookId: '0b9f6c1e-3d4a-4c55-9a51-7f1b2c3d4e5f',
  readerId: '5a7e2d10-8c3b-4f6e-a1d2-3b4c5d6e7f80',
  occurredAt: '2026-10-28T09:15:00.000Z',
};

interface LoggedError {
  message: string;
  stack: unknown;
  context: unknown;
}

class CapturingLogger implements LoggerService {
  readonly errors: LoggedError[] = [];

  log(): void {}

  warn(): void {}

  error(message: unknown, stack?: unknown, context?: unknown): void {
    this.errors.push({ message: String(message), stack, context });
  }
}

describe('domain events with failing handlers', () => {
  test('logs each failing handler and still runs the others and answers 2xx', async ({
    app,
    http,
  }) => {
    const logger = new CapturingLogger();
    app.useLogger(logger);
    onTestFinished(() => {
      app.useLogger(new ConsoleLogger());
    });
    const recorder = app.get(ProbeEventRecorder);
    recorder.clear();

    const response = await http.post('/v1/probe-events/finished-books').send(FINISHED_BOOK);

    expect(response.status).toBe(204);
    expect(recorder.all().map(({ handler }) => handler)).toEqual(
      expect.arrayContaining(['shelf.v1', 'stats.v1']),
    );
    expect(logger.errors.map(({ message, context }) => ({ message, context }))).toEqual([
      {
        message:
          'Handler ProbeFailingHandler.throwing failed for ProbeBookFinished v1: AssertionError: shelf index is corrupted',
        context: 'DomainEvents',
      },
      {
        message:
          'Handler ProbeFailingHandler.rejecting failed for ProbeBookFinished v1: Error: stats store is unavailable',
        context: 'DomainEvents',
      },
    ]);
    expect(logger.errors.map(({ stack }) => stack)).toEqual([
      expect.stringMatching(/^AssertionError: shelf index is corrupted\n\s+at /),
      expect.stringMatching(/^Error: stats store is unavailable\n\s+at /),
    ]);
  });
});

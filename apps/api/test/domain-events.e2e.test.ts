import { describe, expect, onTestFinished } from 'vitest';
import { integrationTest } from './support/integration-test.js';
import { ProbePublisherModule } from './support/probe-events/publisher/probe-publisher.module.js';
import { ProbeEventRecorder } from './support/probe-events/subscriber/probe-event-recorder.js';
import { ProbeGate } from './support/probe-events/subscriber/probe-gate.js';
import { ProbeSubscriberModule } from './support/probe-events/subscriber/probe-subscriber.module.js';

const test = integrationTest({
  imports: [ProbePublisherModule, ProbeSubscriberModule],
}).extend('recorder', ({ app }) => {
  const recorder = app.get(ProbeEventRecorder);
  recorder.clear();

  return recorder;
});

const V1_ROUTE = '/v1/probe-events/finished-books';
const V2_ROUTE = '/v1/probe-events/finished-books-v2';

const FINISHED_BOOK = {
  bookId: '0b9f6c1e-3d4a-4c55-9a51-7f1b2c3d4e5f',
  readerId: '5a7e2d10-8c3b-4f6e-a1d2-3b4c5d6e7f80',
  occurredAt: '2026-10-28T09:15:00.000Z',
};

const PROBE_BOOK_FINISHED_V1 = {
  name: 'ProbeBookFinished',
  version: 1,
  occurredAt: new Date(FINISHED_BOOK.occurredAt),
  payload: { bookId: FINISHED_BOOK.bookId, readerId: FINISHED_BOOK.readerId },
};

describe('domain events', () => {
  test('delivers an event published by one module to the handlers of another', async ({
    http,
    recorder,
  }) => {
    const response = await http.post(V1_ROUTE).send(FINISHED_BOOK);

    expect(response.status).toBe(204);
    expect(recorder.all()).toEqual([
      { handler: 'stats.v1', event: PROBE_BOOK_FINISHED_V1 },
      { handler: 'shelf.v1', event: PROBE_BOOK_FINISHED_V1 },
    ]);
  });

  test('answers only after every handler has finished', async ({ app, http, recorder }) => {
    const gate = app.get(ProbeGate);
    gate.close();
    onTestFinished(() => {
      gate.open();
    });
    let answered = false;

    const pending = http
      .post(V1_ROUTE)
      .send(FINISHED_BOOK)
      .then((response) => {
        answered = true;
        return response;
      });
    await gate.arrival();
    await http.post(V2_ROUTE).send({ ...FINISHED_BOOK, pages: 320 });

    expect(answered).toBe(false);

    gate.open();
    const response = await pending;

    expect(response.status).toBe(204);
    expect(recorder.all().map(({ handler }) => handler)).toEqual([
      'stats.v1',
      'shelf.v2',
      'shelf.v1',
    ]);
  });

  test('keeps versions apart: a v2 event reaches only v2 handlers', async ({ http, recorder }) => {
    const response = await http.post(V2_ROUTE).send({ ...FINISHED_BOOK, pages: 320 });

    expect(response.status).toBe(204);
    expect(recorder.all()).toEqual([
      {
        handler: 'shelf.v2',
        event: {
          name: 'ProbeBookFinished',
          version: 2,
          occurredAt: new Date(FINISHED_BOOK.occurredAt),
          payload: { bookId: FINISHED_BOOK.bookId, readerId: FINISHED_BOOK.readerId, pages: 320 },
        },
      },
    ]);
  });
});

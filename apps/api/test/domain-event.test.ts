import { describe, expect, test } from 'vitest';
import { defineDomainEvent, domainEventKey } from '../src/events/domain-event.js';

const BookFinished = defineDomainEvent<{ bookId: string }>('BookFinished', 1);

describe('defineDomainEvent', () => {
  test('creates an immutable event with its name, version and payload', () => {
    const occurredAt = new Date('2026-10-28T09:15:00.000Z');

    const event = BookFinished.create({ bookId: 'book-1' }, occurredAt);

    expect(event).toStrictEqual({
      name: 'BookFinished',
      version: 1,
      occurredAt,
      payload: { bookId: 'book-1' },
    });
    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.payload)).toBe(true);
  });

  test('freezes a deep copy of the payload, detached from the input', () => {
    const ShelfChanged = defineDomainEvent<{ shelf: { bookIds: string[] } }>('ShelfChanged', 1);
    const payload = { shelf: { bookIds: ['book-1'] } };

    const event = ShelfChanged.create(payload);
    payload.shelf.bookIds.push('book-2');

    expect(event.payload).toStrictEqual({ shelf: { bookIds: ['book-1'] } });
    expect(Object.isFrozen(event.payload.shelf)).toBe(true);
    expect(Object.isFrozen(event.payload.shelf.bookIds)).toBe(true);
  });

  test('copies occurredAt, so changing the given date later does not change the event', () => {
    const occurredAt = new Date('2026-10-28T09:15:00.000Z');

    const event = BookFinished.create({ bookId: 'book-1' }, occurredAt);
    occurredAt.setUTCFullYear(2000);

    expect(event.occurredAt).toStrictEqual(new Date('2026-10-28T09:15:00.000Z'));
  });

  test('stamps occurredAt with the current time by default', () => {
    const before = Date.now();

    const event = BookFinished.create({ bookId: 'book-1' });

    expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(event.occurredAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  test('keys subscriptions by name and version', () => {
    expect(domainEventKey(BookFinished)).toBe('BookFinished.v1');
    expect(domainEventKey(defineDomainEvent('BookFinished', 2))).toBe('BookFinished.v2');
  });

  test.for(['bookFinished', 'Book.Finished', 'Book*', ''])('rejects the name "%s"', (name) => {
    expect(() => defineDomainEvent(name, 1)).toThrow('must be PascalCase');
  });

  test.for([0, -1, 1.5, Number.NaN])('rejects the version %s', (version) => {
    expect(() => defineDomainEvent('BookFinished', version)).toThrow('positive integer');
  });
});

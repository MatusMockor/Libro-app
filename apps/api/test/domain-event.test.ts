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

  test('returns a fresh occurredAt on every read, so changing it does not change the event', () => {
    const event = BookFinished.create({ bookId: 'book-1' }, new Date('2026-10-28T09:15:00.000Z'));

    event.occurredAt.setUTCFullYear(2000);

    expect(event.occurredAt).toStrictEqual(new Date('2026-10-28T09:15:00.000Z'));
  });

  test.for([
    { name: 'a Date', payload: { at: new Date() } },
    { name: 'a Map', payload: { shelves: new Map([['read', 1]]) } },
    { name: 'a Set', payload: { bookIds: new Set(['book-1']) } },
    { name: 'a typed array', payload: { bytes: new Uint8Array([1, 2]) } },
  ])('rejects a payload with $name', ({ payload }) => {
    const Anything = defineDomainEvent<object>('AnythingHappened', 1);

    expect(() => Anything.create(payload)).toThrow(
      'Domain event payloads may contain only plain objects, arrays and primitives.',
    );
  });

  test('rejects a class instance before copying it, without freezing the input', () => {
    class Shelf {
      constructor(readonly bookIds: string[]) {}
    }
    const Anything = defineDomainEvent<object>('AnythingHappened', 1);
    const shelf = new Shelf(['book-1']);

    expect(() => Anything.create({ shelf })).toThrow(
      'Domain event payloads may contain only plain objects, arrays and primitives.',
    );
    expect(Object.isFrozen(shelf.bookIds)).toBe(false);
  });

  test('rejects fields the copy would drop', () => {
    const Anything = defineDomainEvent<object>('AnythingHappened', 1);
    const hidden = Object.defineProperty({}, 'bookId', { value: 'book-1', enumerable: false });

    expect(() => Anything.create(hidden)).toThrow(
      'Domain event payloads must contain only enumerable data fields (no getters or hidden fields).',
    );
    expect(() => Anything.create({ [Symbol('bookId')]: 'book-1' })).toThrow(
      'Domain event payloads must not contain symbol fields.',
    );
  });

  test('visits a shared subtree once', () => {
    const Anything = defineDomainEvent<object>('AnythingHappened', 1);
    let node: Record<string, unknown> = { bookId: 'book-1' };
    for (let level = 0; level < 40; level += 1) {
      node = { left: node, right: node };
    }

    const event = Anything.create(node);

    expect(Object.isFrozen(event.payload)).toBe(true);
  });

  test('rejects a getter instead of reading it', () => {
    const Anything = defineDomainEvent<object>('AnythingHappened', 1);
    let reads = 0;
    const payload = {
      get bookId(): string {
        reads += 1;
        return 'book-1';
      },
    };

    expect(() => Anything.create(payload)).toThrow(
      'Domain event payloads must contain only enumerable data fields (no getters or hidden fields).',
    );
    expect(reads).toBe(0);
  });

  test('rejects an Array subclass', () => {
    class Shelf extends Array<string> {}
    const Anything = defineDomainEvent<object>('AnythingHappened', 1);

    expect(() => Anything.create({ bookIds: Shelf.from(['book-1']) })).toThrow(
      'Domain event payloads may contain only plain objects, arrays and primitives.',
    );
  });

  test('rejects a function in the payload', () => {
    const Anything = defineDomainEvent<object>('AnythingHappened', 1);

    expect(() => Anything.create({ onFinish: () => undefined })).toThrow(
      'Domain event payloads may contain only plain objects, arrays and primitives.',
    );
  });

  test('rejects a cyclic payload', () => {
    const Anything = defineDomainEvent<object>('AnythingHappened', 1);
    const payload: Record<string, unknown> = { bookId: 'book-1' };
    payload.self = payload;

    expect(() => Anything.create(payload)).toThrow(
      'Domain event payloads must not contain cycles.',
    );
  });

  test('accepts the same plain object referenced twice', () => {
    const Anything = defineDomainEvent<object>('AnythingHappened', 1);
    const book = { bookId: 'book-1' };

    const event = Anything.create({ first: book, last: book });

    expect(event.payload).toStrictEqual({
      first: { bookId: 'book-1' },
      last: { bookId: 'book-1' },
    });
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

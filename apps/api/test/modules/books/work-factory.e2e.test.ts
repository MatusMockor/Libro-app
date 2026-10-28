import { describe, expect } from 'vitest';
import { WorkEntity } from '../../../src/modules/books/persistence/work.entity.js';
import { test } from '../../support/integration-test.js';

describe('work factory', () => {
  test.for(['first', 'second'])(
    'starts the %s test from the same default ISBN-13 and keeps them unique',
    async (_, { factories }) => {
      const works = factories.get(WorkEntity);

      const [first, second] = [await works.save(), await works.save()];

      expect(first.editions.map(({ isbn13 }) => isbn13)).toEqual(['9790010000015']);
      expect(second.editions.map(({ isbn13 }) => isbn13)).toEqual(['9790010000022']);
    },
  );
});

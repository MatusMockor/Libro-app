import { randomUUID } from 'node:crypto';
import { describe, expect } from 'vitest';
import { WorkEntity } from '../../../src/modules/books/persistence/work.entity.js';
import { BOOK_CATALOGUE, type BookCatalogue } from '../../../src/modules/books/index.js';
import { test as base } from '../../support/integration-test.js';

const test = base.extend('catalogue', { scope: 'file' }, ({ app }) =>
  app.get<BookCatalogue>(BOOK_CATALOGUE),
);

describe('BOOK_CATALOGUE public interface', () => {
  test('knows a work that is in the catalogue', async ({ catalogue, factories }) => {
    const work = await factories.get(WorkEntity).save();

    expect(await catalogue.workExists(work.id)).toBe(true);
  });

  test('does not know a work that is not in the catalogue', async ({ catalogue, factories }) => {
    await factories.get(WorkEntity).save();

    expect(await catalogue.workExists(randomUUID())).toBe(false);
  });
});

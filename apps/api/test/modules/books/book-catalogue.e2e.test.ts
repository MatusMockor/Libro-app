import { randomUUID } from 'node:crypto';
import { describe, expect } from 'vitest';
import type { WorkFactoryMeta } from '../../../src/modules/books/factories/work.factory.js';
import { WorkEntity } from '../../../src/modules/books/persistence/work.entity.js';
import {
  BOOK_CATALOGUE,
  MAX_WORK_SUMMARIES_PER_CALL,
  type BookCatalogue,
} from '../../../src/modules/books/index.js';
import { test as base } from '../../support/integration-test.js';
import { ANY_UUID } from '../../support/matchers.js';

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

describe('BOOK_CATALOGUE work summaries', () => {
  test('answers the summaries of known works with their authors in credit order', async ({
    catalogue,
    factories,
  }) => {
    const omens = await factories
      .get<WorkEntity, WorkFactoryMeta>(WorkEntity)
      .setMeta({ title: 'Dobré znamenia', authors: ['Terry Pratchett', 'Neil Gaiman'] })
      .save();
    const other = await factories.get(WorkEntity).save();

    const summaries = await catalogue.findWorkSummaries([omens.id, randomUUID()]);

    expect([...summaries.keys()]).toEqual([omens.id]);
    expect(summaries.get(omens.id)).toStrictEqual({
      id: omens.id,
      title: 'Dobré znamenia',
      authors: [
        { id: ANY_UUID, name: 'Terry Pratchett' },
        { id: ANY_UUID, name: 'Neil Gaiman' },
      ],
    });
    expect(summaries.has(other.id)).toBe(false);
  });

  test('answers an empty map for no ids', async ({ catalogue }) => {
    expect((await catalogue.findWorkSummaries([])).size).toBe(0);
  });
});

describe('BOOK_CATALOGUE batch limit', () => {
  test('answers each repeated work once', async ({ catalogue, factories }) => {
    const work = await factories.get(WorkEntity).save();

    const summaries = await catalogue.findWorkSummaries([work.id, work.id, work.id]);

    expect([...summaries.keys()]).toEqual([work.id]);
  });

  test('accepts 100 distinct ids, counting repeats once', async ({ catalogue }) => {
    const ids = Array.from({ length: MAX_WORK_SUMMARIES_PER_CALL }, () => randomUUID());

    expect((await catalogue.findWorkSummaries([...ids, ids[0] ?? ''])).size).toBe(0);
  });

  test('throws a RangeError for more than 100 distinct ids', async ({ catalogue }) => {
    const ids = Array.from({ length: MAX_WORK_SUMMARIES_PER_CALL + 1 }, () => randomUUID());

    await expect(catalogue.findWorkSummaries(ids)).rejects.toThrow(
      new RangeError('At most 100 distinct ids per call are allowed, got 101.'),
    );
  });
});

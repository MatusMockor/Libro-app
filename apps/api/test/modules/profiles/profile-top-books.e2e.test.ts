import { randomUUID } from 'node:crypto';
import type { SeederFactoryManager } from 'typeorm-extension';
import { describe, expect } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import type { WorkFactoryMeta } from '../../../src/modules/books/factories/work.factory.js';
import { WorkEntity } from '../../../src/modules/books/persistence/work.entity.js';
import type { ProfileResponse } from '../../../src/modules/profiles/http/profile.response.js';
import { ANY_UUID } from '../../support/matchers.js';
import { ME_PROFILE_ROUTE, profileRoute, test } from './profiles.fixture.js';

function arrangeWork(factories: SeederFactoryManager, meta: WorkFactoryMeta): Promise<WorkEntity> {
  return factories.get<WorkEntity, WorkFactoryMeta>(WorkEntity).setMeta(meta).save();
}

async function arrangeWorks(factories: SeederFactoryManager, count: number): Promise<string[]> {
  const works = await factories.get(WorkEntity).saveMany(count);

  return works.map(({ id }) => id);
}

describe('top books', () => {
  test('answers the books in the given order with their titles and authors', async ({
    member,
    factories,
  }) => {
    const proces = await arrangeWork(factories, { title: 'Proces', authors: ['Franz Kafka'] });
    const omens = await arrangeWork(factories, {
      title: 'Dobré znamenia',
      authors: ['Terry Pratchett', 'Neil Gaiman'],
    });
    const dune = await arrangeWork(factories, { title: 'Duna', authors: ['Frank Herbert'] });

    const response = await member.updateProfile({ topBookIds: [omens.id, dune.id, proces.id] });

    expect(response.status).toBe(200);
    expect((response.body as ProfileResponse).topBooks).toStrictEqual([
      {
        id: omens.id,
        title: 'Dobré znamenia',
        authors: [
          { id: ANY_UUID, name: 'Terry Pratchett' },
          { id: ANY_UUID, name: 'Neil Gaiman' },
        ],
      },
      { id: dune.id, title: 'Duna', authors: [{ id: ANY_UUID, name: 'Frank Herbert' }] },
      { id: proces.id, title: 'Proces', authors: [{ id: ANY_UUID, name: 'Franz Kafka' }] },
    ]);
    expect((await member.profile()).topBooks).toStrictEqual(
      (response.body as ProfileResponse).topBooks,
    );
  });

  test('replaces the books and clears them with an empty list', async ({ member, factories }) => {
    const [first, second, third] = await arrangeWorks(factories, 3);
    await member.updateProfile({ topBookIds: [first, second] });

    const replaced = await member.updateProfile({ topBookIds: [third, first] });
    const cleared = await member.updateProfile({ topBookIds: [] });

    expect((replaced.body as ProfileResponse).topBooks.map(({ id }) => id)).toEqual([third, first]);
    expect((cleared.body as ProfileResponse).topBooks).toEqual([]);
  });

  test('keeps the books when the body has no topBookIds', async ({ member, factories }) => {
    const ids = await arrangeWorks(factories, 2);
    await member.updateProfile({ topBookIds: ids });

    const response = await member.updateProfile({ displayName: 'Jana' });

    expect((response.body as ProfileResponse).topBooks.map(({ id }) => id)).toEqual(ids);
  });

  test('shows the books to other users', async ({ member, newMember, factories }) => {
    const ids = await arrangeWorks(factories, 3);
    await member.updateProfile({ topBookIds: ids });
    const other = await newMember();

    const response = await other.get(profileRoute(member.id));

    expect((response.body as ProfileResponse).topBooks.map(({ id }) => id)).toEqual(ids);
  });

  test('answers 404 book_not_found for a book that is not in the catalogue', async ({
    member,
    factories,
  }) => {
    const [known] = await arrangeWorks(factories, 1);
    const unknown = randomUUID();
    const before = await member.profile();

    const response = await member.updateProfile({
      topBookIds: [known, unknown],
      displayName: 'Jana',
    });

    expect(response.status).toBe(404);
    expect(response.body).toStrictEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: `No book with id ${unknown} is in the catalogue.`,
      instance: ME_PROFILE_ROUTE,
      code: 'book_not_found',
    });
    expect(await member.profile()).toStrictEqual(before);
  });

  test.for([
    { problem: 'more than 3 books', count: 4, repeat: false, upper: false, code: 'too_big' },
    { problem: 'a repeated book', count: 2, repeat: true, upper: false, code: 'custom' },
    {
      problem: 'a book repeated in upper case',
      count: 2,
      repeat: true,
      upper: true,
      code: 'custom',
    },
  ])(
    'rejects $problem with 400 validation_failed',
    async ({ count, repeat, upper, code }, { member, factories }) => {
      const ids = await arrangeWorks(factories, count);
      const first = ids[0] ?? '';
      const topBookIds = repeat
        ? [first, ...ids.slice(1), upper ? first.toUpperCase() : first]
        : ids;

      const response = await member.updateProfile({ topBookIds });
      const problem = response.body as ProblemDetails;

      expect(response.status).toBe(400);
      expect(problem.code).toBe('validation_failed');
      expect(problem.errors).toEqual([expect.objectContaining({ path: 'topBookIds', code })]);
    },
  );

  test('rejects a book id that is not a UUID', async ({ member }) => {
    const response = await member.updateProfile({ topBookIds: ['dune'] });

    expect(response.status).toBe(400);
    expect((response.body as ProblemDetails).errors).toEqual([
      expect.objectContaining({ path: 'topBookIds.0', code: 'invalid_format' }),
    ]);
  });

  test('accepts a book id in upper case', async ({ member, factories }) => {
    const [id = ''] = await arrangeWorks(factories, 1);

    const response = await member.updateProfile({ topBookIds: [id.toUpperCase()] });

    expect(response.status).toBe(200);
    expect((response.body as ProfileResponse).topBooks.map((book) => book.id)).toEqual([id]);
  });
});

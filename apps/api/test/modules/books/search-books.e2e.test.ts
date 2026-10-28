import { describe, expect } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import type { WorkFactoryMeta } from '../../../src/modules/books/factories/work.factory.js';
import type { BookSearchResponse } from '../../../src/modules/books/http/book-search.response.js';
import { WorkEntity } from '../../../src/modules/books/persistence/work.entity.js';
import { test as base } from '../../support/integration-test.js';
import { ANY_UUID } from '../../support/matchers.js';

type SearchQuery = Record<string, string>;

const test = base
  .extend('works', ({ factories }) => factories.get<WorkEntity, WorkFactoryMeta>(WorkEntity))
  .extend(
    'addWork',
    ({ works }) =>
      (meta: WorkFactoryMeta) =>
        works.setMeta(meta).save(),
  )
  .extend('search', ({ http, signIn }) => async (query: SearchQuery) => {
    const { authorization } = await signIn();

    return http.get('/v1/books').query(query).set('Authorization', authorization);
  })
  .extend('searchTitles', ({ search }) => async (query: SearchQuery) => {
    const response = await search(query);
    expect(response.status).toBe(200);

    return (response.body as BookSearchResponse).items.map(({ title }) => title);
  });

function edition(title: string | null, isbn13: string | null = null) {
  return { isbn13, language: 'sk', title, publishedYear: null };
}

describe('GET /v1/books', () => {
  test('answers 200 with the works of an author found by name', async ({ addWork, search }) => {
    const trial = await addWork({ title: 'Proces', authors: ['Franz Kafka'] });
    await addWork({ title: 'Krvavé sonety', authors: ['Pavol Országh Hviezdoslav'] });

    const response = await search({ q: 'kafka' });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      items: [{ id: trial.id, title: 'Proces', authors: [{ id: ANY_UUID, name: 'Franz Kafka' }] }],
      nextOffset: null,
    });
  });

  test('lists the authors of a found work in credit order', async ({ addWork, search }) => {
    await addWork({ title: 'Good Omens', authors: ['Terry Pratchett', 'Neil Gaiman'] });

    const response = await search({ q: 'omens' });

    expect((response.body as BookSearchResponse).items[0]?.authors).toEqual([
      { id: ANY_UUID, name: 'Terry Pratchett' },
      { id: ANY_UUID, name: 'Neil Gaiman' },
    ]);
  });

  test.for(['stastie', 'ŠŤASTIE', 'Šťastie', 'šťas'])(
    'finds a title with diacritics by %s',
    async (q, { addWork, searchTitles }) => {
      await addWork({ title: 'Malé šťastie', authors: ['Jana Nováková'] });
      await addWork({ title: 'Ťapákovci', authors: ['Božena Slančíková-Timrava'] });

      expect(await searchTitles({ q })).toEqual(['Malé šťastie']);
    },
  );

  test.for(['Kafka', 'KAFKA', 'káfka'])(
    'finds an author regardless of case and diacritics in %s',
    async (q, { addWork, searchTitles }) => {
      await addWork({ title: 'Zámok', authors: ['Franz Kafka'] });

      expect(await searchTitles({ q })).toEqual(['Zámok']);
    },
  );

  test('finds a work only when every word matches its title or authors', async ({
    addWork,
    searchTitles,
  }) => {
    await addWork({ title: 'Proces', authors: ['Franz Kafka'] });
    await addWork({ title: 'Zámok', authors: ['Franz Kafka'] });
    await addWork({ title: 'Proces s Máriou', authors: ['Milo Urban'] });

    expect(await searchTitles({ q: 'kafka proces' })).toEqual(['Proces']);
    expect(await searchTitles({ q: '  franz   KAFKA  zámok ' })).toEqual(['Zámok']);
    expect(await searchTitles({ q: 'kafka kafka zamok' })).toEqual(['Zámok']);
  });

  test('counts repeated words once towards the five word limit', async ({
    addWork,
    searchTitles,
  }) => {
    await addWork({ title: 'Proces', authors: ['Franz Kafka'] });
    await addWork({ title: 'Zámok', authors: ['Franz Kafka'] });

    expect(await searchTitles({ q: 'kafka kafka kafka kafka kafka proces' })).toEqual(['Proces']);
  });

  test('excludes a work when one word matches nothing', async ({ addWork, search }) => {
    await addWork({ title: 'Proces', authors: ['Franz Kafka'] });

    const response = await search({ q: 'kafka hviezdoslav' });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ items: [], nextOffset: null });
  });

  test('finds a work by the title of one of its editions', async ({ addWork, searchTitles }) => {
    await addWork({
      title: 'Der Prozess',
      authors: ['Franz Kafka'],
      editions: [edition(null, '9783150091708'), edition('Proces')],
    });
    await addWork({ title: 'Der Prozess', authors: ['Franz Kafka'] });

    expect(await searchTitles({ q: 'proces' })).toEqual(['Der Prozess']);
    expect(await searchTitles({ q: 'kafka proces' })).toEqual(['Der Prozess']);
  });

  test.for([
    ['9780552137034', 'ISBN-13'],
    ['978-0-552-13703-4', 'hyphenated ISBN-13'],
    ['978 0 552 13703 4', 'spaced ISBN-13'],
    ['0-552-13703-0', 'ISBN-10'],
  ] as const)('finds an edition by its exact %s (%s)', async ([q], { addWork, searchTitles }) => {
    await addWork({ title: 'Good Omens', editions: [edition(null, '9780552137034')] });
    await addWork({ title: 'Another book', editions: [edition(null, '9780552137041')] });

    expect(await searchTitles({ q })).toEqual(['Good Omens']);
  });

  test('finds an edition by an ISBN-10 ending in X', async ({ addWork, searchTitles }) => {
    await addWork({ title: 'Dune', editions: [edition(null, '9780804429573')] });

    expect(await searchTitles({ q: '080442957x' })).toEqual(['Dune']);
  });

  test('ignores an ISBN-10 with a wrong check digit', async ({ addWork, searchTitles }) => {
    await addWork({ title: 'Good Omens', editions: [edition(null, '9780552137034')] });

    expect(await searchTitles({ q: '0552137031' })).toEqual([]);
  });

  test('treats LIKE wildcard characters in the query literally', async ({
    addWork,
    searchTitles,
  }) => {
    await addWork({ title: 'Na 100% isto', authors: ['Ema Malá'] });
    await addWork({ title: 'Na 1000 spôsobov', authors: ['Ema Malá'] });
    await addWork({ title: 'snake_case', authors: ['Ema Malá'] });
    await addWork({ title: 'snakeXcase', authors: ['Ema Malá'] });
    await addWork({ title: 'back\\slash', authors: ['Ema Malá'] });

    expect(await searchTitles({ q: '%%' })).toEqual([]);
    expect(await searchTitles({ q: '__' })).toEqual([]);
    expect(await searchTitles({ q: '0%' })).toEqual(['Na 100% isto']);
    expect(await searchTitles({ q: 'e_c' })).toEqual(['snake_case']);
    expect(await searchTitles({ q: 'k\\s' })).toEqual(['back\\slash']);
  });

  test('puts the closer match first', async ({ addWork, searchTitles }) => {
    await addWork({ title: 'Hrad a zámoky', authors: ['Ema Malá'] });
    await addWork({ title: 'Zámok', authors: ['Franz Kafka'] });

    expect(await searchTitles({ q: 'zamok' })).toEqual(['Zámok', 'Hrad a zámoky']);
  });

  test('pages through equally good matches in a stable order', async ({ addWork, search }) => {
    const titles = ['Saga C', 'Saga A', 'Saga B', 'Saga A', 'Saga D'];
    const added = [];
    for (const title of titles) {
      added.push(await addWork({ title }));
    }
    const expectedIds = added
      .toSorted(
        (left, right) => left.title.localeCompare(right.title) || (left.id < right.id ? -1 : 1),
      )
      .map(({ id }) => id);
    const page = async (query: SearchQuery) =>
      (await search({ q: 'saga', ...query })).body as BookSearchResponse;

    const first = await page({ limit: '2' });
    const second = await page({ limit: '2', offset: '2' });
    const last = await page({ limit: '2', offset: '4' });

    expect([first.nextOffset, second.nextOffset, last.nextOffset]).toEqual([2, 4, null]);
    expect([...first.items, ...second.items, ...last.items].map(({ id }) => id)).toEqual(
      expectedIds,
    );
    expect((await page({ limit: '2' })).items).toEqual(first.items);
    expect((await page({})).items.map(({ id }) => id)).toEqual(expectedIds);
    expect((await page({ offset: '5' })).items).toEqual([]);
  });

  test('answers an empty page when nothing matches', async ({ addWork, search }) => {
    await addWork({ title: 'Proces', authors: ['Franz Kafka'] });

    const response = await search({ q: 'hviezdoslav' });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ items: [], nextOffset: null });
  });

  test.for([
    [{}, 'q', 'invalid_type'],
    [{ q: 'a' }, 'q', 'too_small'],
    [{ q: '  a  ' }, 'q', 'too_small'],
    [{ q: 'a'.repeat(101) }, 'q', 'too_big'],
    [{ q: 'kafka', limit: '0' }, 'limit', 'too_small'],
    [{ q: 'kafka', limit: '51' }, 'limit', 'too_big'],
    [{ q: 'kafka', limit: '2.5' }, 'limit', 'invalid_type'],
    [{ q: 'kafka', offset: '-1' }, 'offset', 'too_small'],
    [{ q: 'kafka', offset: '1001' }, 'offset', 'too_big'],
  ] as const)('answers 400 validation_failed for %j', async ([query, path, code], { search }) => {
    const response = await search(query);
    const problem = response.body as ProblemDetails;

    expect(response.status).toBe(400);
    expect(problem.code).toBe('validation_failed');
    expect(problem.errors?.map((error) => ({ path: error.path, code: error.code }))).toEqual([
      { path, code },
    ]);
  });

  test('answers 401 authentication_required without an access token', async ({ http }) => {
    const response = await http.get('/v1/books').query({ q: 'kafka' });

    expect(response.status).toBe(401);
    expect((response.body as ProblemDetails).code).toBe('authentication_required');
  });
});

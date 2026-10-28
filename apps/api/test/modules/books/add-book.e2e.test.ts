import type { DataSource } from 'typeorm';
import { describe, expect } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import type { WorkFactoryMeta } from '../../../src/modules/books/factories/work.factory.js';
import type { BookResponse } from '../../../src/modules/books/http/book.response.js';
import { WorkEntity } from '../../../src/modules/books/persistence/work.entity.js';
import { integrationTest } from '../../support/integration-test.js';
import { ANY_UUID } from '../../support/matchers.js';
import { ProbeBooksSubscriberModule } from '../../support/probe-events/books/probe-books-subscriber.module.js';
import { ProbeEventRecorder } from '../../support/probe-events/subscriber/probe-event-recorder.js';

const test = integrationTest({ imports: [ProbeBooksSubscriberModule] }).extend(
  'recorder',
  ({ app }) => {
    const recorder = app.get(ProbeEventRecorder);
    recorder.clear();

    return recorder;
  },
);

const ROUTE = '/v1/books';

const ENGLISH_ISBN = '9780552137034';
const SLOVAK_ISBN = '9788055100548';

const GOOD_OMENS = {
  title: 'Good Omens',
  authors: ['Terry Pratchett', 'Neil Gaiman'],
  editions: [
    { isbn13: SLOVAK_ISBN, language: 'sk', title: 'Dobré znamenia' },
    { isbn13: ENGLISH_ISBN, language: 'en', publishedYear: 1990 },
  ],
};

interface CatalogueSize {
  works: number;
  authors: number;
  editions: number;
}

async function catalogueSize(dataSource: DataSource): Promise<CatalogueSize | undefined> {
  const [size] = await dataSource.query<CatalogueSize[]>(
    `SELECT
       (SELECT count(*)::int FROM books.works) AS "works",
       (SELECT count(*)::int FROM books.authors) AS "authors",
       (SELECT count(*)::int FROM books.editions) AS "editions"`,
  );

  return size;
}

describe('POST /v1/books', () => {
  test('answers 201 with the added book', async ({ http }) => {
    const response = await http.post(ROUTE).send(GOOD_OMENS);

    expect(response.status).toBe(201);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body).toStrictEqual({
      id: ANY_UUID,
      title: 'Good Omens',
      authors: [
        { id: ANY_UUID, name: 'Terry Pratchett' },
        { id: ANY_UUID, name: 'Neil Gaiman' },
      ],
      editions: [
        { id: ANY_UUID, isbn13: ENGLISH_ISBN, language: 'en', title: null, publishedYear: 1990 },
        {
          id: ANY_UUID,
          isbn13: SLOVAK_ISBN,
          language: 'sk',
          title: 'Dobré znamenia',
          publishedYear: null,
        },
      ],
    });
  });

  test('stores the work, its authors in credit order and its editions', async ({
    http,
    dataSource,
  }) => {
    const book = (await http.post(ROUTE).send(GOOD_OMENS)).body as BookResponse;

    const authors = await dataSource.query<{ name: string; position: number }[]>(
      `SELECT author.name, credit.position
       FROM books.work_authors credit
       JOIN books.authors author ON author.id = credit.author_id
       WHERE credit.work_id = $1
       ORDER BY credit.position`,
      [book.id],
    );
    const editions = await dataSource.query<{ isbn13: string; language: string }[]>(
      'SELECT isbn13, language FROM books.editions WHERE work_id = $1 ORDER BY language',
      [book.id],
    );

    expect(authors).toEqual([
      { name: 'Terry Pratchett', position: 1 },
      { name: 'Neil Gaiman', position: 2 },
    ]);
    expect(editions).toEqual([
      { isbn13: ENGLISH_ISBN, language: 'en' },
      { isbn13: SLOVAK_ISBN, language: 'sk' },
    ]);
    expect(await catalogueSize(dataSource)).toEqual({ works: 1, authors: 2, editions: 2 });
  });

  test('publishes BookAddedToCatalogue once with the ids of the stored book', async ({
    http,
    recorder,
  }) => {
    const book = (await http.post(ROUTE).send(GOOD_OMENS)).body as BookResponse;

    expect(recorder.all()).toEqual([
      {
        handler: 'books.v1',
        event: {
          name: 'BookAddedToCatalogue',
          version: 1,
          occurredAt: expect.any(Date) as Date,
          payload: { workId: book.id, editionIds: book.editions.map(({ id }) => id) },
        },
      },
    ]);
  });

  test('strips fields the schema does not declare', async ({ http }) => {
    const response = await http.post(ROUTE).send({
      ...GOOD_OMENS,
      rating: 5,
      editions: [{ isbn13: ENGLISH_ISBN, language: 'en', price: 12 }],
    });
    const book = response.body as BookResponse;

    expect(response.status).toBe(201);
    expect(Object.keys(book)).toEqual(['id', 'title', 'authors', 'editions']);
    expect(book.editions.map((edition) => Object.keys(edition))).toEqual([
      ['id', 'isbn13', 'language', 'title', 'publishedYear'],
    ]);
  });

  test.for([
    {
      problem: 'a missing title',
      body: { ...GOOD_OMENS, title: undefined },
      errors: [{ path: 'title', code: 'invalid_type' }],
    },
    {
      problem: 'no authors',
      body: { ...GOOD_OMENS, authors: [] },
      errors: [{ path: 'authors', code: 'too_small' }],
    },
    {
      problem: 'no editions',
      body: { ...GOOD_OMENS, editions: [] },
      errors: [{ path: 'editions', code: 'too_small' }],
    },
    {
      problem: 'a wrong ISBN-13 check digit',
      body: { ...GOOD_OMENS, editions: [{ isbn13: '9780552137035', language: 'en' }] },
      errors: [{ path: 'editions.0.isbn13', code: 'custom' }],
    },
    {
      problem: 'an ISBN-13 with hyphens',
      body: { ...GOOD_OMENS, editions: [{ isbn13: '978-0-552-13703-4', language: 'en' }] },
      errors: [{ path: 'editions.0.isbn13', code: 'invalid_format' }],
    },
    {
      problem: 'a language that is not an ISO 639-1 code',
      body: { ...GOOD_OMENS, editions: [{ isbn13: ENGLISH_ISBN, language: 'English' }] },
      errors: [{ path: 'editions.0.language', code: 'invalid_format' }],
    },
  ])('rejects $problem with 400', async ({ body, errors }, { http, dataSource }) => {
    const response = await http.post(ROUTE).send(body);
    const problem = response.body as ProblemDetails;

    expect(response.status).toBe(400);
    expect(problem.code).toBe('validation_failed');
    expect(problem.errors?.map(({ path, code }) => ({ path, code }))).toEqual(errors);
    expect(await catalogueSize(dataSource)).toEqual({ works: 0, authors: 0, editions: 0 });
  });

  test('answers 409 and stores nothing when two editions of the request share an ISBN-13', async ({
    http,
    dataSource,
    recorder,
  }) => {
    const response = await http.post(ROUTE).send({
      ...GOOD_OMENS,
      editions: [
        { isbn13: ENGLISH_ISBN, language: 'en' },
        { isbn13: ENGLISH_ISBN, language: 'sk' },
      ],
    });

    expect(response.status).toBe(409);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toStrictEqual({
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      detail: 'An edition with this ISBN-13 is already in the catalogue.',
      instance: ROUTE,
      code: 'isbn_already_exists',
    });
    expect(await catalogueSize(dataSource)).toEqual({ works: 0, authors: 0, editions: 0 });
    expect(recorder.all()).toEqual([]);
  });

  test('answers 409 and stores nothing when an ISBN-13 is already in the catalogue', async ({
    http,
    dataSource,
    factories,
    recorder,
  }) => {
    await factories
      .get<WorkEntity, WorkFactoryMeta>(WorkEntity)
      .setMeta({
        editions: [{ isbn13: ENGLISH_ISBN, language: 'en', title: null, publishedYear: null }],
      })
      .save();

    const response = await http.post(ROUTE).send(GOOD_OMENS);

    expect(response.status).toBe(409);
    expect((response.body as ProblemDetails).code).toBe('isbn_already_exists');
    expect(await catalogueSize(dataSource)).toEqual({ works: 1, authors: 1, editions: 1 });
    expect(recorder.all()).toEqual([]);
  });

  test('answers 409 to the loser of two concurrent requests with the same ISBN-13', async ({
    http,
    dataSource,
    recorder,
  }) => {
    const responses = await Promise.all([
      http.post(ROUTE).send(GOOD_OMENS),
      http.post(ROUTE).send(GOOD_OMENS),
    ]);

    expect(responses.map(({ status }) => status).toSorted()).toEqual([201, 409]);
    expect(await catalogueSize(dataSource)).toEqual({ works: 1, authors: 2, editions: 2 });
    expect(recorder.all()).toHaveLength(1);
  });
});

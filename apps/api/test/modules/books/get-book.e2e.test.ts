import { randomUUID } from 'node:crypto';
import { describe, expect } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import type { WorkFactoryMeta } from '../../../src/modules/books/factories/work.factory.js';
import { WorkEntity } from '../../../src/modules/books/persistence/work.entity.js';
import { test as base } from '../../support/integration-test.js';
import { ANY_UUID } from '../../support/matchers.js';

const test = base.extend('works', ({ factories }) =>
  factories.get<WorkEntity, WorkFactoryMeta>(WorkEntity),
);

describe('GET /v1/books/:workId', () => {
  test('answers 200 with the work, its authors in credit order and editions by year', async ({
    http,
    works,
  }) => {
    const work = await works
      .setMeta({
        title: 'Good Omens',
        authors: ['Terry Pratchett', 'Neil Gaiman'],
        editions: [
          { isbn13: null, language: 'sk', title: 'Dobré znamenia', publishedYear: null },
          { isbn13: '9780552137034', language: 'en', title: null, publishedYear: 1990 },
        ],
      })
      .save();

    const response = await http.get(`/v1/books/${work.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      id: work.id,
      title: 'Good Omens',
      authors: [
        { id: ANY_UUID, name: 'Terry Pratchett' },
        { id: ANY_UUID, name: 'Neil Gaiman' },
      ],
      editions: [
        { id: ANY_UUID, isbn13: '9780552137034', language: 'en', title: null, publishedYear: 1990 },
        {
          id: ANY_UUID,
          isbn13: null,
          language: 'sk',
          title: 'Dobré znamenia',
          publishedYear: null,
        },
      ],
    });
  });

  test('answers 404 book_not_found for an unknown id', async ({ http, works }) => {
    await works.save();
    const unknownId = randomUUID();

    const response = await http.get(`/v1/books/${unknownId}`);

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toStrictEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: `No book with id ${unknownId} is in the catalogue.`,
      instance: `/v1/books/${unknownId}`,
      code: 'book_not_found',
    });
  });

  test('answers 400 for an id that is not a ANY_UUID', async ({ http }) => {
    const response = await http.get('/v1/books/not-a-uuid');
    const problem = response.body as ProblemDetails;

    expect(response.status).toBe(400);
    expect(problem.code).toBe('validation_failed');
    expect(problem.errors?.map(({ path, code }) => ({ path, code }))).toEqual([
      { path: 'workId', code: 'invalid_format' },
    ]);
  });
});

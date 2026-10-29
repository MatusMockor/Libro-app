import { describe, expect } from 'vitest';
import type { ProblemDetails } from '../src/http/problem-details/problem-details.schema.js';
import { WorkEntity } from '../src/modules/books/persistence/work.entity.js';
import { test } from './support/integration-test.js';

const NUL = '\u0000';

const NUL_ERROR = {
  message: 'Must not contain NUL characters (U+0000)',
  code: 'invalid_format',
};

function expectNulRejected(response: { status: number; body: unknown }, paths: string[]): void {
  const problem = response.body as ProblemDetails;

  expect(response.status).toBe(400);
  expect(problem.code).toBe('validation_failed');
  expect(problem.errors).toEqual(paths.map((path) => ({ path, ...NUL_ERROR })));
}

describe('NUL characters in text input', () => {
  test.for([
    { field: 'displayName', value: `Ja${NUL}na` },
    { field: 'bio', value: NUL },
    { field: 'bio', value: `Čítam${NUL} po nociach.` },
  ])(
    'answers 400 validation_failed for a profile $field with NUL',
    async ({ field, value }, { http, signIn, dataSource }) => {
      const { authorization } = await signIn();

      const response = await http
        .patch('/v1/me/profile')
        .set('Authorization', authorization)
        .send({ [field]: value });

      expectNulRejected(response, [field]);
      expect(await dataSource.query('SELECT 1 FROM profiles.profiles')).toEqual([]);
    },
  );

  test.for(['/v1/profiles', '/v1/books'])(
    'answers 400 validation_failed for a NUL in the search query of %s',
    async (route, { http, signIn }) => {
      const { authorization } = await signIn();

      const response = await http.get(`${route}?q=ja%00na`).set('Authorization', authorization);

      expectNulRejected(response, ['q']);
    },
  );

  test('answers 400 validation_failed for NUL in nested book fields', async ({
    http,
    signIn,
    dataSource,
  }) => {
    const { authorization } = await signIn();

    const response = await http
      .post('/v1/books')
      .set('Authorization', authorization)
      .send({
        title: 'Proces',
        authors: ['Franz Kafka', `Max${NUL}Brod`],
        editions: [{ language: 'sk', title: `Proces${NUL}` }],
      });

    expectNulRejected(response, ['authors.1', 'editions.0.title']);
    expect(await dataSource.query('SELECT 1 FROM books.works')).toEqual([]);
  });

  test('answers 400 validation_failed for a reading place with NUL', async ({
    http,
    signIn,
    factories,
    dataSource,
  }) => {
    const { authorization } = await signIn();
    const work = await factories.get(WorkEntity).save();

    const response = await http
      .post('/v1/reading-sessions')
      .set('Authorization', authorization)
      .send({ workId: work.id, place: `kaviareň${NUL}` });

    expectNulRejected(response, ['place']);
    expect(await dataSource.query('SELECT 1 FROM reading.sessions')).toEqual([]);
  });

  test('still accepts text without NUL characters', async ({ http, signIn }) => {
    const { authorization } = await signIn();

    const response = await http
      .patch('/v1/me/profile')
      .set('Authorization', authorization)
      .send({ displayName: 'Jana \\u0000 Nováková' });

    expect(response.status).toBe(200);
    expect((response.body as { displayName: string }).displayName).toBe('Jana \\u0000 Nováková');
  });
});

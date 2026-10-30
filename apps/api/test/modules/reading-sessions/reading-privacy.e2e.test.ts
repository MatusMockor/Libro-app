import type { DataSource } from 'typeorm';
import { describe, expect } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import { PRIVACY_ROUTE, test } from './reading-groups.fixture.js';

interface StoredSetting {
  readonly userId: string;
  readonly liveSessions: string;
}

function storedSettings(dataSource: DataSource): Promise<StoredSetting[]> {
  return dataSource.query<StoredSetting[]>(
    'SELECT user_id AS "userId", live_sessions AS "liveSessions" FROM reading.sharing_settings',
  );
}

describe('GET /v1/me/reading-privacy', () => {
  test('answers 401 authentication_required without an access token', async ({ http }) => {
    const response = await http.get(PRIVACY_ROUTE);

    expect(response.status).toBe(401);
    expect((response.body as ProblemDetails).code).toBe('authentication_required');
  });

  test('shares live sessions with followers until the user changes it', async ({
    dataSource,
    newGroupReader,
  }) => {
    const ann = await newGroupReader();

    const response = await ann.get(PRIVACY_ROUTE);

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ liveSessions: 'followers' });
    expect(await storedSettings(dataSource)).toEqual([]);
  });
});

describe('PUT /v1/me/reading-privacy', () => {
  test('answers 401 authentication_required without an access token', async ({ http }) => {
    const response = await http.put(PRIVACY_ROUTE).send({ liveSessions: 'nobody' });

    expect(response.status).toBe(401);
  });

  test('stores the setting of the signed-in user only', async ({ dataSource, newGroupReader }) => {
    const ann = await newGroupReader();
    const ben = await newGroupReader();

    const saved = await ann.put(PRIVACY_ROUTE, { liveSessions: 'nobody' });
    const annAfter = await ann.get(PRIVACY_ROUTE);
    const benAfter = await ben.get(PRIVACY_ROUTE);

    expect(saved.status).toBe(200);
    expect(saved.body).toStrictEqual({ liveSessions: 'nobody' });
    expect(annAfter.body).toStrictEqual({ liveSessions: 'nobody' });
    expect(benAfter.body).toStrictEqual({ liveSessions: 'followers' });
    expect(await storedSettings(dataSource)).toEqual([{ userId: ann.id, liveSessions: 'nobody' }]);
  });

  test('changes the setting back', async ({ newGroupReader }) => {
    const ann = await newGroupReader();
    await ann.shareLiveSessions('nobody');

    const saved = await ann.put(PRIVACY_ROUTE, { liveSessions: 'followers' });
    const after = await ann.get(PRIVACY_ROUTE);

    expect(saved.body).toStrictEqual({ liveSessions: 'followers' });
    expect(after.body).toStrictEqual({ liveSessions: 'followers' });
  });

  test.for([
    { problem: 'a missing setting', body: {}, code: 'invalid_value' },
    { problem: 'an unknown setting', body: { liveSessions: 'everyone' }, code: 'invalid_value' },
  ])('answers 400 validation_failed for $problem', async ({ body, code }, { newGroupReader }) => {
    const ann = await newGroupReader();

    const response = await ann.put(PRIVACY_ROUTE, body);
    const problem = response.body as ProblemDetails;

    expect(response.status).toBe(400);
    expect(problem.code).toBe('validation_failed');
    expect(problem.errors).toEqual([expect.objectContaining({ path: 'liveSessions', code })]);
  });
});

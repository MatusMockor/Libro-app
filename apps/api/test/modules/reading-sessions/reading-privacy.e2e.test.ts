import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { describe, expect } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import {
  MAX_READING_ACTIVITY_SHARING_CHECKS_PER_CALL,
  READING_ACTIVITY_SHARING,
  type ReadingActivitySharing,
} from '../../../src/modules/reading-sessions/index.js';
import { PRIVACY_ROUTE, test } from './reading-groups.fixture.js';

interface StoredSetting {
  readonly userId: string;
  readonly liveSessions: string;
  readonly readingActivity: string;
}

const DEFAULT_PRIVACY = { liveSessions: 'followers', readingActivity: 'followers' };

function storedSettings(dataSource: DataSource): Promise<StoredSetting[]> {
  return dataSource.query<StoredSetting[]>(
    `SELECT user_id AS "userId", live_sessions AS "liveSessions", reading_activity AS "readingActivity"
     FROM reading.sharing_settings`,
  );
}

describe('GET /v1/me/reading-privacy', () => {
  test('answers 401 authentication_required without an access token', async ({ http }) => {
    const response = await http.get(PRIVACY_ROUTE);

    expect(response.status).toBe(401);
    expect((response.body as ProblemDetails).code).toBe('authentication_required');
  });

  test('shares live sessions and reading activity with followers until the user changes it', async ({
    dataSource,
    newGroupReader,
  }) => {
    const ann = await newGroupReader();

    const response = await ann.get(PRIVACY_ROUTE);

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual(DEFAULT_PRIVACY);
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
    expect(saved.body).toStrictEqual({ liveSessions: 'nobody', readingActivity: 'followers' });
    expect(annAfter.body).toStrictEqual({ liveSessions: 'nobody', readingActivity: 'followers' });
    expect(benAfter.body).toStrictEqual(DEFAULT_PRIVACY);
    expect(await storedSettings(dataSource)).toEqual([
      { userId: ann.id, liveSessions: 'nobody', readingActivity: 'followers' },
    ]);
  });

  test('changes the setting back', async ({ newGroupReader }) => {
    const ann = await newGroupReader();
    await ann.shareLiveSessions('nobody');

    const saved = await ann.put(PRIVACY_ROUTE, { liveSessions: 'followers' });
    const after = await ann.get(PRIVACY_ROUTE);

    expect(saved.body).toStrictEqual(DEFAULT_PRIVACY);
    expect(after.body).toStrictEqual(DEFAULT_PRIVACY);
  });

  test('changes only the reading activity when only it is sent', async ({ newGroupReader }) => {
    const ann = await newGroupReader();
    await ann.shareLiveSessions('nobody');

    const saved = await ann.put(PRIVACY_ROUTE, { readingActivity: 'nobody' });
    const after = await ann.get(PRIVACY_ROUTE);

    expect(saved.status).toBe(200);
    expect(saved.body).toStrictEqual({ liveSessions: 'nobody', readingActivity: 'nobody' });
    expect(after.body).toStrictEqual({ liveSessions: 'nobody', readingActivity: 'nobody' });
  });

  test('keeps the reading activity when an old app sends only the live sessions', async ({
    newGroupReader,
  }) => {
    const ann = await newGroupReader();
    await ann.put(PRIVACY_ROUTE, { readingActivity: 'nobody' });

    const saved = await ann.put(PRIVACY_ROUTE, { liveSessions: 'nobody' });

    expect(saved.body).toStrictEqual({ liveSessions: 'nobody', readingActivity: 'nobody' });
  });

  test('stores the default live sessions when only the reading activity is sent first', async ({
    dataSource,
    newGroupReader,
  }) => {
    const ann = await newGroupReader();

    const saved = await ann.put(PRIVACY_ROUTE, { readingActivity: 'nobody' });

    expect(saved.body).toStrictEqual({ liveSessions: 'followers', readingActivity: 'nobody' });
    expect(await storedSettings(dataSource)).toEqual([
      { userId: ann.id, liveSessions: 'followers', readingActivity: 'nobody' },
    ]);
  });

  test('changes both settings at once', async ({ newGroupReader }) => {
    const ann = await newGroupReader();

    const saved = await ann.put(PRIVACY_ROUTE, {
      liveSessions: 'nobody',
      readingActivity: 'nobody',
    });

    expect(saved.body).toStrictEqual({ liveSessions: 'nobody', readingActivity: 'nobody' });
  });

  test('answers 400 validation_failed when no setting is sent', async ({ newGroupReader }) => {
    const ann = await newGroupReader();

    const response = await ann.put(PRIVACY_ROUTE, {});
    const problem = response.body as ProblemDetails;

    expect(response.status).toBe(400);
    expect(problem.code).toBe('validation_failed');
    expect(problem.errors).toEqual([expect.objectContaining({ path: '', code: 'custom' })]);
  });

  test.for([
    { field: 'liveSessions', body: { liveSessions: 'everyone' } },
    { field: 'readingActivity', body: { readingActivity: 'everyone' } },
  ])(
    'answers 400 validation_failed for an unknown $field',
    async ({ field, body }, { newGroupReader }) => {
      const ann = await newGroupReader();

      const response = await ann.put(PRIVACY_ROUTE, body);
      const problem = response.body as ProblemDetails;

      expect(response.status).toBe(400);
      expect(problem.code).toBe('validation_failed');
      expect(problem.errors).toEqual([
        expect.objectContaining({ path: field, code: 'invalid_value' }),
      ]);
    },
  );
});

describe('READING_ACTIVITY_SHARING public interface', () => {
  test('answers the users who share their reading activity with followers', async ({
    app,
    newGroupReader,
  }) => {
    const sharing = app.get<ReadingActivitySharing>(READING_ACTIVITY_SHARING);
    const quiet = await newGroupReader();
    const open = await newGroupReader();
    const reopened = await newGroupReader();
    const untouched = randomUUID();
    await quiet.put(PRIVACY_ROUTE, { readingActivity: 'nobody' });
    await open.put(PRIVACY_ROUTE, { liveSessions: 'nobody' });
    await reopened.put(PRIVACY_ROUTE, { readingActivity: 'nobody' });
    await reopened.put(PRIVACY_ROUTE, { readingActivity: 'followers' });

    const shared = await sharing.sharingWithFollowers([quiet.id, open.id, reopened.id, untouched]);

    expect([...shared].toSorted()).toEqual([open.id, reopened.id, untouched].toSorted());
    expect((await sharing.sharingWithFollowers([])).size).toBe(0);
  });

  test(`checks up to ${String(MAX_READING_ACTIVITY_SHARING_CHECKS_PER_CALL)} distinct users in one call`, async ({
    app,
  }) => {
    const sharing = app.get<ReadingActivitySharing>(READING_ACTIVITY_SHARING);
    const userIds = Array.from({ length: MAX_READING_ACTIVITY_SHARING_CHECKS_PER_CALL }, () =>
      randomUUID(),
    );

    expect((await sharing.sharingWithFollowers(userIds)).size).toBe(userIds.length);
    await expect(sharing.sharingWithFollowers([...userIds, randomUUID()])).rejects.toThrow(
      RangeError,
    );
  });
});

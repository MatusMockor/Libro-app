import { describe, expect } from 'vitest';
import { FACTORY_USER_PASSWORD } from '../../../src/modules/auth/factories/user.factory.js';
import type { ReadingTreeResponse } from '../../../src/modules/tree/http/reading-tree.response.js';
import {
  PRIVACY_ROUTE,
  sessionRoute,
  storedParticipations,
  test,
  type GroupReader,
} from './reading-groups.fixture.js';

async function deleteAccountOf(reader: GroupReader): Promise<void> {
  const response = await reader.post('/v1/me/deletion', { password: FACTORY_USER_PASSWORD });
  expect(response.status).toBe(204);
}

describe('account deletion of a group member', () => {
  test('deleting the host removes the group and the participants read on alone', async ({
    dataSource,
    newGroupReader,
    newWork,
  }) => {
    const host = await newGroupReader();
    const first = await newGroupReader();
    const second = await newGroupReader();
    await first.follows(host);
    await second.follows(host);
    const hostSession = await host.startReading(await newWork());
    const firstSession = await first.joined(hostSession.id);
    const secondSession = await second.joined(hostSession.id);
    await host.shareLiveSessions('nobody');

    await deleteAccountOf(host);
    const firstAfter = await first.session(firstSession.id);
    const checkpoint = await second.post(`${sessionRoute(secondSession.id)}/checkpoints`, {
      page: 5,
    });

    expect(await storedParticipations(dataSource)).toEqual([]);
    expect(
      await dataSource.query('SELECT user_id FROM reading.sharing_settings WHERE user_id = $1', [
        host.id,
      ]),
    ).toEqual([]);
    expect(firstAfter).toMatchObject({ status: 'active', groupHostSessionId: null });
    expect(checkpoint.status).toBe(201);
  });

  test('deleting a participant keeps the group of the host and its other participants', async ({
    dataSource,
    newGroupReader,
    newWork,
  }) => {
    const host = await newGroupReader();
    const leaving = await newGroupReader();
    const staying = await newGroupReader();
    await leaving.follows(host);
    await staying.follows(host);
    const hostSession = await host.startReading(await newWork());
    await leaving.joined(hostSession.id);
    const stayingSession = await staying.joined(hostSession.id);

    await deleteAccountOf(leaving);

    expect(await storedParticipations(dataSource)).toEqual([
      expect.objectContaining({
        hostSessionId: hostSession.id,
        participantSessionId: stayingSession.id,
      }),
    ]);
    expect((await host.session(hostSession.id)).groupHostSessionId).toBe(hostSession.id);
    expect((await staying.session(stayingSession.id)).groupHostSessionId).toBe(hostSession.id);
  });

  test('a finished tree of a participant loses only the group decoration of a deleted host', async ({
    newGroupReader,
    newWork,
  }) => {
    const host = await newGroupReader();
    const participant = await newGroupReader();
    await participant.follows(host);
    const hostSession = await host.startReading(await newWork());
    const joined = await participant.joined(hostSession.id);
    await participant.post(`${sessionRoute(joined.id)}/checkpoints`, { page: 12 });
    await participant.ended(joined.id);
    const finished = await participant.post(`/v1/readings/${joined.readingId}/finish`);
    expect(finished.status).toBe(200);
    const treeRoute = `/v1/readings/${joined.readingId}/tree`;
    const before = (await participant.get(treeRoute)).body as ReadingTreeResponse;

    await deleteAccountOf(host);
    const after = (await participant.get(treeRoute)).body as ReadingTreeResponse;

    expect(before.tree.decorations).toEqual([
      expect.objectContaining({ id: `group:${hostSession.id}`, kind: 'group_reading' }),
    ]);
    expect(after.tree.decorations).toEqual([]);
    expect({ ...after.tree, decorations: before.tree.decorations }).toStrictEqual(before.tree);
  });

  test('keeps the reading privacy of other users', async ({ newGroupReader }) => {
    const ann = await newGroupReader();
    const ben = await newGroupReader();
    await ann.shareLiveSessions('nobody');
    await ben.shareLiveSessions('nobody');

    await deleteAccountOf(ann);

    expect((await ben.get(PRIVACY_ROUTE)).body).toStrictEqual({
      liveSessions: 'nobody',
      readingActivity: 'followers',
    });
  });
});

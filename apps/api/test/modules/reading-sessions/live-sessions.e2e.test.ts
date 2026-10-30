import { describe, expect, vi } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import { WorkEntity } from '../../../src/modules/books/persistence/work.entity.js';
import type { LivePageResponse } from '../../../src/modules/reading-sessions/http/live-session.response.js';
import { ANY_ISO_DATE, ANY_UUID } from '../../support/matchers.js';
import { LIVE_ROUTE, sessionRoute, test, type GroupReader } from './reading-groups.fixture.js';

async function liveOf(reader: GroupReader, query = ''): Promise<LivePageResponse> {
  const response = await reader.get(`${LIVE_ROUTE}${query}`);
  expect(response.status).toBe(200);

  return response.body as LivePageResponse;
}

const sessionIds = ({ items }: LivePageResponse): string[] =>
  items.map(({ sessionId }) => sessionId);

describe('GET /v1/reading-sessions/live', () => {
  test('answers 401 authentication_required without an access token', async ({ http }) => {
    const response = await http.get(LIVE_ROUTE);

    expect(response.status).toBe(401);
    expect((response.body as ProblemDetails).code).toBe('authentication_required');
  });

  test('answers an empty page without followed readers', async ({ newGroupReader }) => {
    const viewer = await newGroupReader();

    expect(await liveOf(viewer)).toStrictEqual({ items: [], nextOffset: null });
  });

  test('shows the open session of a followed reader with book, place and progress', async ({
    factories,
    newGroupReader,
  }) => {
    const viewer = await newGroupReader();
    const host = await newGroupReader({ handle: 'jana.cita', displayName: 'Jana' });
    await viewer.follows(host);
    const work = await factories.get(WorkEntity).save();
    const session = await host.startReading(work.id, { place: 'kaviaren' });
    await host.post(`${sessionRoute(session.id)}/checkpoints`, { page: 12 });
    await host.post(`${sessionRoute(session.id)}/checkpoints`, { page: 30 });

    const page = await liveOf(viewer);

    expect(page).toStrictEqual({
      items: [
        {
          sessionId: session.id,
          readingId: session.readingId,
          host: {
            userId: host.id,
            handle: 'jana.cita',
            displayName: 'Jana',
            avatar: null,
            official: false,
            followedByMe: true,
          },
          book: {
            id: work.id,
            title: work.title,
            authors: [{ id: ANY_UUID, name: expect.any(String) as string }],
          },
          place: 'kaviaren',
          status: 'active',
          startedAt: ANY_ISO_DATE,
          progressPage: 30,
          participantCount: 0,
          joinedByMe: false,
        },
      ],
      nextOffset: null,
    });
  });

  test('shows a paused session with no checkpoint yet', async ({ newGroupReader, newWork }) => {
    const viewer = await newGroupReader();
    const host = await newGroupReader();
    await viewer.follows(host);
    const session = await host.startReading(await newWork());
    await host.post(`${sessionRoute(session.id)}/pause`);

    const [item] = (await liveOf(viewer)).items;

    expect(item).toMatchObject({ status: 'paused', progressPage: null });
  });

  test('leaves out readers not followed, ended sessions and the own session', async ({
    newGroupReader,
    newWork,
  }) => {
    const viewer = await newGroupReader();
    const followed = await newGroupReader();
    const stranger = await newGroupReader();
    const finished = await newGroupReader();
    await viewer.follows(followed, finished);
    await stranger.follows(viewer);
    await viewer.startReading(await newWork());
    const visible = await followed.startReading(await newWork());
    await stranger.startReading(await newWork());
    await finished.ended((await finished.startReading(await newWork())).id);

    expect(sessionIds(await liveOf(viewer))).toEqual([visible.id]);
  });

  test('leaves out a followed reader who shares live sessions with nobody', async ({
    newGroupReader,
    newWork,
  }) => {
    const viewer = await newGroupReader();
    const open = await newGroupReader();
    const hidden = await newGroupReader();
    await viewer.follows(open, hidden);
    await hidden.shareLiveSessions('nobody');
    const visible = await open.startReading(await newWork());
    await hidden.startReading(await newWork());

    expect(sessionIds(await liveOf(viewer))).toEqual([visible.id]);

    await hidden.shareLiveSessions('followers');

    expect(await liveOf(viewer)).toMatchObject({ items: { length: 2 } });
  });

  test('shows a followed reader who shares with nobody to a member of the same group', async ({
    newGroupReader,
    newWork,
  }) => {
    const viewer = await newGroupReader();
    const host = await newGroupReader();
    const quiet = await newGroupReader();
    await viewer.follows(host, quiet);
    await quiet.follows(host);
    const hostSession = await host.startReading(await newWork());
    const quietSession = await quiet.joined(hostSession.id);
    await quiet.shareLiveSessions('nobody');

    expect(sessionIds(await liveOf(viewer))).toEqual([hostSession.id]);

    await viewer.joined(hostSession.id);
    const page = await liveOf(viewer);

    expect(sessionIds(page)).toEqual([quietSession.id, hostSession.id]);
    expect(page.items.map(({ joinedByMe }) => joinedByMe)).toEqual([true, true]);
  });

  test('counts only the current participants an outsider may see', async ({
    newGroupReader,
    newWork,
    arrangeParticipants,
  }) => {
    const viewer = await newGroupReader();
    const host = await newGroupReader();
    const member = await newGroupReader();
    const quiet = await newGroupReader();
    await viewer.follows(host, member, quiet);
    await member.follows(host);
    await quiet.follows(host);
    const hostSession = await host.startReading(await newWork());
    await arrangeParticipants(hostSession.id, 2);
    await arrangeParticipants(hostSession.id, 1, {
      joinedAt: new Date(Date.now() - 60_000),
      leftAt: new Date(),
    });
    const memberSession = await member.joined(hostSession.id);
    await quiet.joined(hostSession.id);
    await quiet.shareLiveSessions('nobody');

    const page = await liveOf(viewer);

    expect(
      page.items.map(({ sessionId, participantCount, joinedByMe }) => ({
        sessionId,
        participantCount,
        joinedByMe,
      })),
    ).toEqual([
      { sessionId: memberSession.id, participantCount: 1, joinedByMe: false },
      { sessionId: hostSession.id, participantCount: 1, joinedByMe: false },
    ]);
  });

  test('counts every current participant for a member of the group', async ({
    newGroupReader,
    newWork,
    arrangeParticipants,
  }) => {
    const viewer = await newGroupReader();
    const host = await newGroupReader();
    const quiet = await newGroupReader();
    await viewer.follows(host);
    await quiet.follows(host);
    const hostSession = await host.startReading(await newWork());
    await arrangeParticipants(hostSession.id, 2);
    await quiet.joined(hostSession.id);
    await quiet.shareLiveSessions('nobody');
    const outsiderCount = (await liveOf(viewer)).items[0]?.participantCount;

    await viewer.joined(hostSession.id);
    const [hostItem] = (await liveOf(viewer)).items;

    expect(outsiderCount).toBe(0);
    expect(hostItem).toMatchObject({
      sessionId: hostSession.id,
      participantCount: 4,
      joinedByMe: true,
    });
  });

  test('pages the sessions, most recently started first', async ({ newGroupReader, newWork }) => {
    const viewer = await newGroupReader();
    const started: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      const host = await newGroupReader();
      await viewer.follows(host);
      started.unshift((await host.startReading(await newWork())).id);
    }

    const first = await liveOf(viewer, '?limit=2');
    const second = await liveOf(viewer, '?limit=2&offset=2');

    expect(first).toMatchObject({ nextOffset: 2 });
    expect(second).toMatchObject({ nextOffset: null });
    expect([...sessionIds(first), ...sessionIds(second)]).toEqual(started);
  });

  test('computes a page with the same number of queries for one session or twenty', async ({
    dataSource,
    newGroupReader,
    newWork,
  }) => {
    const viewer = await newGroupReader();
    for (let index = 0; index < 20; index += 1) {
      const host = await newGroupReader();
      await viewer.follows(host);
      await host.startReading(await newWork());
    }
    const queries = vi.spyOn(dataSource.logger, 'logQuery');
    const countQueries = async (query: string): Promise<number> => {
      queries.mockClear();
      await liveOf(viewer, query);
      return queries.mock.calls.length;
    };

    const oneSession = await countQueries('?limit=1');
    const twentySessions = await countQueries('?limit=20');
    queries.mockRestore();

    expect({ oneSession, twentySessions }).toEqual({ oneSession: 5, twentySessions: 5 });
  });

  test.for([
    ['limit=0', 'limit', 'too_small'],
    ['limit=51', 'limit', 'too_big'],
    ['offset=-1', 'offset', 'too_small'],
    ['offset=1001', 'offset', 'too_big'],
  ] as const)(
    'answers 400 validation_failed for %s',
    async ([query, path, code], { newGroupReader }) => {
      const viewer = await newGroupReader();

      const response = await viewer.get(`${LIVE_ROUTE}?${query}`);

      expect(response.status).toBe(400);
      expect((response.body as ProblemDetails).errors).toEqual([
        expect.objectContaining({ path, code }),
      ]);
    },
  );
});

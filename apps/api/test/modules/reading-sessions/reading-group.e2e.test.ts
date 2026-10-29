import { randomUUID } from 'node:crypto';
import { describe, expect } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import type { ReadingGroupResponse } from '../../../src/modules/reading-sessions/http/live-session.response.js';
import { ANY_ISO_DATE, ANY_UUID } from '../../support/matchers.js';
import {
  groupRoute,
  leaveRoute,
  sessionRoute,
  test,
  type GroupReader,
} from './reading-groups.fixture.js';

async function groupSeenBy(reader: GroupReader, sessionId: string): Promise<ReadingGroupResponse> {
  const response = await reader.get(groupRoute(sessionId));
  expect(response.status).toBe(200);

  return response.body as ReadingGroupResponse;
}

interface SeenGroup {
  readonly host: string | null;
  readonly participants: readonly string[];
}

const seen = ({ host, participants }: ReadingGroupResponse): SeenGroup => ({
  host: host?.reader.userId ?? null,
  participants: participants.map(({ reader }) => reader.userId),
});

describe('GET /v1/reading-sessions/:sessionId/group', () => {
  test('answers 401 authentication_required without an access token', async ({ http }) => {
    const response = await http.get(groupRoute(randomUUID()));

    expect(response.status).toBe(401);
  });

  test('answers the book, the host and the participants in the order they joined', async ({
    newGroupReader,
    newWork,
  }) => {
    const host = await newGroupReader({ handle: 'host.reader' });
    const first = await newGroupReader();
    const second = await newGroupReader();
    await first.follows(host);
    await second.follows(host);
    const hostSession = await host.startReading(await newWork(), { place: 'park' });
    await host.post(`${sessionRoute(hostSession.id)}/checkpoints`, { page: 8 });
    const firstSession = await first.joined(hostSession.id);
    const secondSession = await second.joined(hostSession.id);

    const group = await groupSeenBy(first, hostSession.id);

    expect(group).toStrictEqual({
      book: {
        id: hostSession.workId,
        title: expect.any(String) as string,
        authors: [{ id: ANY_UUID, name: expect.any(String) as string }],
      },
      host: {
        sessionId: hostSession.id,
        reader: expect.objectContaining({ userId: host.id, handle: 'host.reader' }) as object,
        place: 'park',
        status: 'active',
        startedAt: hostSession.startedAt,
        progressPage: 8,
        joinedAt: null,
      },
      participants: [
        expect.objectContaining({ sessionId: firstSession.id, joinedAt: ANY_ISO_DATE }),
        expect.objectContaining({ sessionId: secondSession.id, joinedAt: ANY_ISO_DATE }),
      ],
    });
    expect(await groupSeenBy(first, secondSession.id)).toEqual(group);
  });

  test('answers a solo session as a host without participants', async ({
    newGroupReader,
    newWork,
  }) => {
    const host = await newGroupReader();
    const session = await host.startReading(await newWork());

    expect(seen(await groupSeenBy(host, session.id))).toEqual({ host: host.id, participants: [] });
  });

  test('shows a viewer outside the group only the members they may see', async ({
    newGroupReader,
    newWork,
  }) => {
    const host = await newGroupReader();
    const followed = await newGroupReader();
    const quiet = await newGroupReader();
    const stranger = await newGroupReader();
    const viewer = await newGroupReader();
    await viewer.follows(host, followed, quiet);
    for (const member of [followed, quiet, stranger]) {
      await member.follows(host);
    }
    const hostSession = await host.startReading(await newWork());
    const followedSession = await followed.joined(hostSession.id);
    await quiet.joined(hostSession.id);
    await stranger.joined(hostSession.id);
    await quiet.shareLiveSessions('nobody');

    expect(seen(await groupSeenBy(viewer, hostSession.id))).toEqual({
      host: host.id,
      participants: [followed.id],
    });

    await host.shareLiveSessions('nobody');

    expect(seen(await groupSeenBy(viewer, followedSession.id))).toEqual({
      host: null,
      participants: [followed.id],
    });
  });

  test('shows the members of one group to each other whatever they share', async ({
    newGroupReader,
    newWork,
  }) => {
    const host = await newGroupReader();
    const first = await newGroupReader();
    const second = await newGroupReader();
    await first.follows(host);
    await second.follows(host);
    const hostSession = await host.startReading(await newWork());
    await first.joined(hostSession.id);
    await second.joined(hostSession.id);
    for (const member of [host, first, second]) {
      await member.shareLiveSessions('nobody');
    }

    expect(seen(await groupSeenBy(second, hostSession.id))).toEqual({
      host: host.id,
      participants: [first.id, second.id],
    });
    expect(seen(await groupSeenBy(host, hostSession.id))).toEqual({
      host: host.id,
      participants: [first.id, second.id],
    });
  });

  test('leaves out participants who left or ended', async ({ newGroupReader, newWork }) => {
    const host = await newGroupReader();
    const leaving = await newGroupReader();
    const ending = await newGroupReader();
    const staying = await newGroupReader();
    for (const member of [leaving, ending, staying]) {
      await member.follows(host);
    }
    const hostSession = await host.startReading(await newWork());
    const left = await leaving.joined(hostSession.id);
    const ended = await ending.joined(hostSession.id);
    await staying.joined(hostSession.id);
    await leaving.post(leaveRoute(left.id));
    await ending.ended(ended.id);

    expect(seen(await groupSeenBy(host, hostSession.id))).toEqual({
      host: host.id,
      participants: [staying.id],
    });
  });

  test('lists no participants for an ended host session, even open former ones', async ({
    newGroupReader,
    newWork,
  }) => {
    const host = await newGroupReader();
    const member = await newGroupReader();
    await member.follows(host);
    const hostSession = await host.startReading(await newWork());
    const memberSession = await member.joined(hostSession.id);
    await host.ended(hostSession.id);

    const group = await groupSeenBy(host, hostSession.id);

    expect(seen(group)).toEqual({ host: host.id, participants: [] });
    expect(group.host?.status).toBe('ended');
    expect((await member.session(memberSession.id)).status).toBe('active');
  });

  test.for([
    { name: 'a session of a reader not followed', follow: false, sharing: 'followers' },
    { name: 'a session shared with nobody', follow: true, sharing: 'nobody' },
  ] as const)(
    'answers 404 reading_session_not_found for $name',
    async ({ follow, sharing }, { newGroupReader, newWork }) => {
      const host = await newGroupReader();
      const viewer = await newGroupReader();
      if (follow) {
        await viewer.follows(host);
      }
      await host.shareLiveSessions(sharing);
      const session = await host.startReading(await newWork());

      const response = await viewer.get(groupRoute(session.id));

      expect(response.status).toBe(404);
      expect((response.body as ProblemDetails).code).toBe('reading_session_not_found');
    },
  );

  test('answers 404 reading_session_not_found for an ended session of another reader', async ({
    newGroupReader,
    newWork,
  }) => {
    const host = await newGroupReader();
    const viewer = await newGroupReader();
    await viewer.follows(host);
    const session = await host.startReading(await newWork());
    await host.ended(session.id);

    const response = await viewer.get(groupRoute(session.id));

    expect(response.status).toBe(404);
  });
});

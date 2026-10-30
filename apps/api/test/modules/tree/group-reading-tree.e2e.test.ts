import { computeTree } from '@libro/tree-engine';
import type { SeederFactoryManager } from 'typeorm-extension';
import { describe, expect } from 'vitest';
import type { SessionParticipantFactoryMeta } from '../../../src/modules/reading-sessions/factories/session-participant.factory.js';
import { SessionParticipantEntity } from '../../../src/modules/reading-sessions/persistence/session-participant.entity.js';
import type { ReadingTreeResponse } from '../../../src/modules/tree/http/reading-tree.response.js';
import { engineSession, test, treeRoute, type TreeReader } from './tree.fixture.js';

const COUNTED = { activeSeconds: 1800, checkpoints: [30] } as const;

const JOINED_AT = new Date(Date.UTC(2026, 9, 1, 12));

async function treeOf(reader: TreeReader, readingId: string): Promise<ReadingTreeResponse> {
  const response = await reader.get(treeRoute(readingId));
  expect(response.status).toBe(200);

  return response.body as ReadingTreeResponse;
}

async function readTogether(
  factories: SeederFactoryManager,
  hostSessionId: string,
  participantSessionId: string,
  meta: Omit<SessionParticipantFactoryMeta, 'hostSessionId' | 'participantSessionId'> = {},
): Promise<void> {
  await factories
    .get<SessionParticipantEntity, SessionParticipantFactoryMeta>(SessionParticipantEntity)
    .setMeta({ joinedAt: JOINED_AT, ...meta, hostSessionId, participantSessionId })
    .save();
}

const decorationsOf = ({ tree }: ReadingTreeResponse) =>
  tree.decorations.map(({ id, kind }) => ({ id, kind }));

describe('group reading on the tree', () => {
  test('decorates the trees of the host and of the participant with their group', async ({
    factories,
    reader,
    newReader,
  }) => {
    const participant = await newReader();
    const hostReading = await reader.newReading();
    const participantReading = await participant.newReading();
    const hostSession = await reader.read(hostReading, COUNTED);
    const participantSession = await participant.read(participantReading, COUNTED);
    await readTogether(factories, hostSession.id, participantSession.id);

    const hostTree = await treeOf(reader, hostReading.id);
    const participantTree = await treeOf(participant, participantReading.id);

    const decoration = { id: `group:${hostSession.id}`, kind: 'group_reading' };
    expect(decorationsOf(hostTree)).toEqual([decoration]);
    expect(decorationsOf(participantTree)).toEqual([decoration]);
  });

  test('has no decoration for a reading read alone', async ({ reader }) => {
    const reading = await reader.newReading();
    await reader.read(reading, COUNTED);

    expect(decorationsOf(await treeOf(reader, reading.id))).toEqual([]);
  });

  test('keeps the group of a participant who left or was removed', async ({
    factories,
    reader,
    newReader,
  }) => {
    const leaving = await newReader();
    const removed = await newReader();
    const hostSession = await reader.read(await reader.newReading(), COUNTED);
    const leavingReading = await leaving.newReading();
    const removedReading = await removed.newReading();
    await readTogether(
      factories,
      hostSession.id,
      (await leaving.read(leavingReading, COUNTED)).id,
      { leftAt: new Date() },
    );
    await readTogether(
      factories,
      hostSession.id,
      (await removed.read(removedReading, COUNTED)).id,
      { removedAt: new Date() },
    );

    expect(decorationsOf(await treeOf(leaving, leavingReading.id))).toHaveLength(1);
    expect(decorationsOf(await treeOf(removed, removedReading.id))).toHaveLength(1);
  });

  test('adds one decoration per distinct group, in the order of the sessions', async ({
    factories,
    reader,
    newReader,
  }) => {
    const firstHost = await newReader();
    const secondHost = await newReader();
    const firstGroup = await firstHost.read(await firstHost.newReading(), COUNTED);
    const secondGroup = await secondHost.read(await secondHost.newReading(), COUNTED);
    const again = await firstHost.read(await firstHost.newReading(), COUNTED);
    const reading = await reader.newReading();
    for (const hostSessionId of [firstGroup.id, secondGroup.id, firstGroup.id, again.id]) {
      await readTogether(factories, hostSessionId, (await reader.read(reading, COUNTED)).id);
    }

    expect(decorationsOf(await treeOf(reader, reading.id)).map(({ id }) => id)).toEqual([
      `group:${firstGroup.id}`,
      `group:${secondGroup.id}`,
      `group:${again.id}`,
    ]);
  });

  test('does not decorate while the session is still open', async ({
    factories,
    reader,
    newReader,
  }) => {
    const participant = await newReader();
    const hostSession = await reader.read(await reader.newReading(), {
      ...COUNTED,
      open: true,
    });
    const participantReading = await participant.newReading();
    const participantSession = await participant.read(participantReading, {
      ...COUNTED,
      open: true,
    });
    await readTogether(factories, hostSession.id, participantSession.id);

    expect(decorationsOf(await treeOf(participant, participantReading.id))).toEqual([]);
  });

  test('changes nothing but the decorations of a finished tree', async ({
    factories,
    reader,
    newReader,
  }) => {
    const host = await newReader();
    const hostSession = await host.read(await host.newReading(), COUNTED);
    const reading = await reader.newReading();
    const together = await reader.read(reading, {
      activeSeconds: 3600,
      checkpoints: [20, 60],
      markedParts: [{ kind: 'good', fromPage: 10, toPage: 40 }],
    });
    await readTogether(factories, hostSession.id, together.id);
    const alone = await reader.read(reading, COUNTED);
    await reader.finish(reading);

    const { tree } = await treeOf(reader, reading.id);
    const withoutGroups = computeTree(
      {
        seed: reading.id,
        finished: true,
        sessions: [engineSession(together), engineSession(alone)],
        decorations: [],
      },
      1,
    );

    expect(tree.decorations).toHaveLength(1);
    expect({ ...tree, decorations: [] }).toStrictEqual(withoutGroups);
  });
});

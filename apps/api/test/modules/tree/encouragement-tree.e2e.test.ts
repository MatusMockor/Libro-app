import { computeTree } from '@libro/tree-engine';
import type { SeederFactoryManager } from 'typeorm-extension';
import { describe, expect } from 'vitest';
import type { CongratulationFactoryMeta } from '../../../src/modules/encouragements/factories/congratulation.factory.js';
import type { InsightFactoryMeta } from '../../../src/modules/encouragements/factories/insight.factory.js';
import type { InsightResponse } from '../../../src/modules/encouragements/http/encouragement.response.js';
import { CongratulationEntity } from '../../../src/modules/encouragements/persistence/congratulation.entity.js';
import { InsightEntity } from '../../../src/modules/encouragements/persistence/insight.entity.js';
import type { FollowFactoryMeta } from '../../../src/modules/profiles/factories/follow.factory.js';
import type { ProfileFactoryMeta } from '../../../src/modules/profiles/factories/profile.factory.js';
import { FollowEntity } from '../../../src/modules/profiles/persistence/follow.entity.js';
import { ProfileEntity } from '../../../src/modules/profiles/persistence/profile.entity.js';
import type { SessionParticipantFactoryMeta } from '../../../src/modules/reading-sessions/factories/session-participant.factory.js';
import { SessionParticipantEntity } from '../../../src/modules/reading-sessions/persistence/session-participant.entity.js';
import type { ReadingTreeResponse } from '../../../src/modules/tree/http/reading-tree.response.js';
import { engineSession, test, treeRoute, type TreeReader } from './tree.fixture.js';

const COUNTED = { activeSeconds: 1800, checkpoints: [30] } as const;

const at = (minute: number): Date => new Date(Date.UTC(2026, 9, 1, 12, minute));

async function treeOf(reader: TreeReader, readingId: string): Promise<ReadingTreeResponse> {
  const response = await reader.get(treeRoute(readingId));
  expect(response.status).toBe(200);

  return response.body as ReadingTreeResponse;
}

const decorationsOf = ({ tree }: ReadingTreeResponse) =>
  tree.decorations.map(({ id, kind }) => ({ id, kind }));

async function befriend(
  factories: SeederFactoryManager,
  reader: TreeReader,
  ...followers: readonly TreeReader[]
): Promise<void> {
  const profiles = factories.get<ProfileEntity, ProfileFactoryMeta>(ProfileEntity);
  for (const member of [reader, ...followers]) {
    await profiles.save({ userId: member.id });
  }
  for (const follower of followers) {
    await factories
      .get<FollowEntity, FollowFactoryMeta>(FollowEntity)
      .save({ followerId: follower.id, followeeId: reader.id });
  }
}

async function addInsight(
  author: TreeReader,
  readingId: string,
  text = 'Water for your tree',
): Promise<InsightResponse> {
  const response = await author.send('post', `/v1/readings/${readingId}/insights`, { text });
  expect(response.status).toBe(201);

  return response.body as InsightResponse;
}

async function congratulate(author: TreeReader, readingId: string): Promise<void> {
  const response = await author.send('put', `/v1/readings/${readingId}/congratulation`);
  expect(response.status).toBe(204);
}

describe('insights and congratulations on the tree', () => {
  test('decorates the growing tree with insights and the finished tree with congratulations', async ({
    factories,
    reader,
    newReader,
  }) => {
    const friend = await newReader();
    await befriend(factories, reader, friend);
    const reading = await reader.newReading();
    await reader.read(reading, COUNTED);
    const insight = await addInsight(friend, reading.id);

    const growing = await treeOf(reader, reading.id);
    await reader.finish(reading);
    await congratulate(friend, reading.id);
    const finished = await treeOf(reader, reading.id);

    expect(decorationsOf(growing)).toEqual([{ id: `insight:${insight.id}`, kind: 'insight' }]);
    expect(decorationsOf(finished)).toEqual([
      { id: `insight:${insight.id}`, kind: 'insight' },
      { id: `congratulation:${friend.id}`, kind: 'congratulation' },
    ]);
    expect(insight.decorationId).toBe(`insight:${insight.id}`);
  });

  test('changes nothing but the decorations of a finished tree', async ({
    factories,
    reader,
    newReader,
  }) => {
    const [first, second] = [await newReader(), await newReader()];
    await befriend(factories, reader, first, second);
    const reading = await reader.newReading();
    const sessions = [
      await reader.read(reading, {
        activeSeconds: 3600,
        checkpoints: [20, 60],
        markedParts: [{ kind: 'good', fromPage: 10, toPage: 40 }],
      }),
      await reader.read(reading, COUNTED),
    ];
    await addInsight(first, reading.id, 'One');
    await addInsight(second, reading.id, 'Two');
    await reader.finish(reading);
    const before = await treeOf(reader, reading.id);

    await congratulate(first, reading.id);
    await congratulate(second, reading.id);
    const { tree } = await treeOf(reader, reading.id);
    const undecorated = computeTree(
      {
        seed: reading.id,
        finished: true,
        sessions: sessions.map(engineSession),
        decorations: [],
      },
      1,
    );

    expect(before.tree.decorations).toHaveLength(2);
    expect(tree.decorations).toHaveLength(4);
    expect(tree.decorations.slice(0, 2)).toStrictEqual(before.tree.decorations);
    expect({ ...tree, decorations: [] }).toStrictEqual(undecorated);
    expect({ ...before.tree, decorations: [] }).toStrictEqual(undecorated);
  });

  test('puts the group decorations first, then the encouragements oldest first', async ({
    factories,
    reader,
    newReader,
  }) => {
    const host = await newReader();
    const [early, late] = [await newReader(), await newReader()];
    const hostSession = await host.read(await host.newReading(), COUNTED);
    const reading = await reader.newReading();
    const together = await reader.read(reading, COUNTED);
    await factories
      .get<SessionParticipantEntity, SessionParticipantFactoryMeta>(SessionParticipantEntity)
      .save({ hostSessionId: hostSession.id, participantSessionId: together.id });
    const insights = factories.get<InsightEntity, InsightFactoryMeta>(InsightEntity);
    const congratulations = factories.get<CongratulationEntity, CongratulationFactoryMeta>(
      CongratulationEntity,
    );
    const newest = await insights.save({
      readingId: reading.id,
      readerId: reader.id,
      authorId: late.id,
      createdAt: at(3),
    });
    await congratulations.save({
      readingId: reading.id,
      readerId: reader.id,
      authorId: early.id,
      createdAt: at(2),
    });
    const oldest = await insights.save({
      readingId: reading.id,
      readerId: reader.id,
      authorId: early.id,
      createdAt: at(1),
    });

    expect(decorationsOf(await treeOf(reader, reading.id))).toEqual([
      { id: `group:${hostSession.id}`, kind: 'group_reading' },
      { id: `insight:${oldest.id}`, kind: 'insight' },
      { id: `congratulation:${early.id}`, kind: 'congratulation' },
      { id: `insight:${newest.id}`, kind: 'insight' },
    ]);
  });

  test('keeps the 100 oldest encouragements, so a new one never moves an earlier one', async ({
    factories,
    reader,
  }) => {
    const reading = await reader.newReading();
    const congratulations = factories.get<CongratulationEntity, CongratulationFactoryMeta>(
      CongratulationEntity,
    );
    const authors: string[] = [];
    for (let minute = 0; minute < 100; minute += 1) {
      const congratulation = await congratulations.save({
        readingId: reading.id,
        readerId: reader.id,
        createdAt: at(minute),
      });
      authors.push(congratulation.authorId);
    }
    const before = await treeOf(reader, reading.id);

    await congratulations.save({ readingId: reading.id, readerId: reader.id, createdAt: at(200) });
    const after = await treeOf(reader, reading.id);

    expect(after.tree.decorations).toHaveLength(100);
    expect(after.tree.decorations).toStrictEqual(before.tree.decorations);
    expect(after.tree.decorations.map(({ id }) => id)).toEqual(
      authors.map((authorId) => `congratulation:${authorId}`),
    );
  });

  test('drops the decoration of a deleted insight and keeps the others in place', async ({
    factories,
    reader,
    newReader,
  }) => {
    const friend = await newReader();
    await befriend(factories, reader, friend);
    const reading = await reader.newReading();
    await reader.read(reading, COUNTED);
    const kept = await addInsight(friend, reading.id, 'Kept');
    const removed = await addInsight(friend, reading.id, 'Removed');
    const before = await treeOf(reader, reading.id);

    const deleted = await reader.send('delete', `/v1/insights/${removed.id}`);
    const after = await treeOf(reader, reading.id);

    expect(deleted.status).toBe(204);
    expect(decorationsOf(before).map(({ id }) => id)).toEqual([
      `insight:${kept.id}`,
      `insight:${removed.id}`,
    ]);
    expect(after.tree.decorations).toStrictEqual(
      before.tree.decorations.filter(({ id }) => id === `insight:${kept.id}`),
    );
  });
});

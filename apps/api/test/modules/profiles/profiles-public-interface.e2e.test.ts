import { randomUUID } from 'node:crypto';
import { describe, expect } from 'vitest';
import {
  MAX_PROFILE_SUMMARIES_PER_CALL,
  PROFILE_DIRECTORY,
  SOCIAL_GRAPH,
  type ProfileDirectory,
  type SocialGraph,
} from '../../../src/modules/profiles/index.js';
import { test as base } from './profiles.fixture.js';

const test = base
  .extend('socialGraph', { scope: 'file' }, ({ app }) => app.get<SocialGraph>(SOCIAL_GRAPH))
  .extend('directory', { scope: 'file' }, ({ app }) =>
    app.get<ProfileDirectory>(PROFILE_DIRECTORY),
  );

describe('SOCIAL_GRAPH public interface', () => {
  test('knows who follows whom, in one direction', async ({ socialGraph, member, newMember }) => {
    const jana = await newMember();
    await member.follows(jana);

    expect(await socialGraph.isFollowing(member.id, jana.id)).toBe(true);
    expect(await socialGraph.isFollowing(jana.id, member.id)).toBe(false);
    expect(await socialGraph.isFollowing(member.id, randomUUID())).toBe(false);
  });

  test('answers the followed user ids, most recent follow first', async ({
    socialGraph,
    member,
    newMember,
  }) => {
    const jana = await newMember();
    const peter = await newMember();
    await member.follows(jana, peter);

    expect(await socialGraph.followeeIdsOf(member.id)).toEqual([peter.id, jana.id]);
    expect(await socialGraph.followeeIdsOf(randomUUID())).toEqual([]);
  });
});

describe('PROFILE_DIRECTORY public interface', () => {
  test('answers the summaries of known profiles as seen by the viewer', async ({
    directory,
    member,
    newMember,
  }) => {
    const jana = await newMember({ handle: 'jana', displayName: 'Jana' });
    const peter = await newMember({ handle: 'peter' });
    await member.follows(jana);

    const summaries = await directory.findSummaries(member.id, [jana.id, peter.id, randomUUID()]);

    expect(summaries.size).toBe(2);
    expect(summaries.get(jana.id)).toStrictEqual({
      userId: jana.id,
      handle: 'jana',
      displayName: 'Jana',
      avatar: null,
      official: false,
      followedByMe: true,
    });
    expect(summaries.get(peter.id)).toStrictEqual({
      userId: peter.id,
      handle: 'peter',
      displayName: null,
      avatar: null,
      official: false,
      followedByMe: false,
    });
  });

  test('answers an empty map for no ids', async ({ directory, member }) => {
    expect((await directory.findSummaries(member.id, [])).size).toBe(0);
  });
});

describe('PROFILE_DIRECTORY batch limit', () => {
  test('answers each repeated profile once', async ({ directory, member, newMember }) => {
    const jana = await newMember();

    const summaries = await directory.findSummaries(member.id, [jana.id, jana.id]);

    expect([...summaries.keys()]).toEqual([jana.id]);
  });

  test('accepts 100 distinct ids, counting repeats once', async ({ directory, member }) => {
    const ids = Array.from({ length: MAX_PROFILE_SUMMARIES_PER_CALL }, () => randomUUID());

    expect((await directory.findSummaries(member.id, [...ids, ids[0] ?? ''])).size).toBe(0);
  });

  test('throws a RangeError for more than 100 distinct ids', async ({ directory, member }) => {
    const ids = Array.from({ length: MAX_PROFILE_SUMMARIES_PER_CALL + 1 }, () => randomUUID());

    await expect(directory.findSummaries(member.id, ids)).rejects.toThrow(RangeError);
  });
});

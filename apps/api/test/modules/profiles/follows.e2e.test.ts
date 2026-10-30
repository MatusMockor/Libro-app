import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import type { SeederFactoryManager } from 'typeorm-extension';
import { describe, expect } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import type { FollowFactoryMeta } from '../../../src/modules/profiles/factories/follow.factory.js';
import type { ProfileFactoryMeta } from '../../../src/modules/profiles/factories/profile.factory.js';
import type {
  ProfileResponse,
  ProfileSummaryPageResponse,
} from '../../../src/modules/profiles/http/profile.response.js';
import { FollowEntity } from '../../../src/modules/profiles/persistence/follow.entity.js';
import { ProfileEntity } from '../../../src/modules/profiles/persistence/profile.entity.js';
import {
  followRoute,
  profileRoute,
  storedProfiles,
  test,
  type Member,
} from './profiles.fixture.js';

const MAX_FOLLOWING = 2000;

interface StoredFollow {
  readonly followerId: string;
  readonly followeeId: string;
}

function storedFollows(dataSource: DataSource): Promise<StoredFollow[]> {
  return dataSource.query<StoredFollow[]>(
    `SELECT follower_id AS "followerId", followee_id AS "followeeId"
     FROM profiles.follows
     ORDER BY created_at`,
  );
}

async function arrangeFollowing(
  factories: SeederFactoryManager,
  dataSource: DataSource,
  followerId: string,
  count: number,
): Promise<void> {
  const profileFactory = factories.get<ProfileEntity, ProfileFactoryMeta>(ProfileEntity);
  const followFactory = factories.get<FollowEntity, FollowFactoryMeta>(FollowEntity);
  const followees: ProfileEntity[] = [];
  const follows: FollowEntity[] = [];
  for (let made = 0; made < count; made += 1) {
    const followee = await profileFactory.make();
    followees.push(followee);
    follows.push(await followFactory.make({ followerId, followeeId: followee.userId }));
  }

  await dataSource.getRepository(ProfileEntity).save(followees, { chunk: 500 });
  await dataSource.getRepository(FollowEntity).save(follows, { chunk: 500 });
}

async function listOf(member: Member, path: string): Promise<ProfileSummaryPageResponse> {
  const response = await member.get(path);
  expect(response.status, path).toBe(200);

  return response.body as ProfileSummaryPageResponse;
}

async function profileOf(viewer: Member, member: Member): Promise<ProfileResponse> {
  const response = await viewer.get(profileRoute(member.id));
  expect(response.status).toBe(200);

  return response.body as ProfileResponse;
}

describe('PUT /v1/profiles/:userId/follow', () => {
  test('answers 401 authentication_required without an access token', async ({ http, member }) => {
    const response = await http.put(followRoute(member.id));

    expect(response.status).toBe(401);
    expect((response.body as ProblemDetails).code).toBe('authentication_required');
  });

  test('follows the user and counts it on both profiles', async ({
    member,
    newMember,
    dataSource,
  }) => {
    const jana = await newMember({ handle: 'jana' });

    const response = await member.follow(jana.id);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
    expect(await storedFollows(dataSource)).toEqual([
      { followerId: member.id, followeeId: jana.id },
    ]);
    expect(await profileOf(member, jana)).toMatchObject({
      followerCount: 1,
      followingCount: 0,
      followedByMe: true,
    });
    expect(await member.profile()).toMatchObject({
      followerCount: 0,
      followingCount: 1,
      followedByMe: false,
    });
    expect(await profileOf(jana, member)).toMatchObject({ followingCount: 1, followedByMe: false });
  });

  test('answers 204 again when the user is already followed', async ({
    member,
    newMember,
    dataSource,
  }) => {
    const jana = await newMember();
    await member.follows(jana);

    const response = await member.follow(jana.id);

    expect(response.status).toBe(204);
    expect(await storedFollows(dataSource)).toHaveLength(1);
  });

  test('creates the missing profile of the follower', async ({
    newMember,
    newMemberWithoutProfile,
    dataSource,
  }) => {
    const jana = await newMember({ handle: 'jana' });
    const follower = await newMemberWithoutProfile();

    const response = await follower.follow(jana.id);

    expect(response.status).toBe(204);
    expect((await storedProfiles(dataSource)).map(({ userId }) => userId)).toContain(follower.id);
    expect(await storedFollows(dataSource)).toEqual([
      { followerId: follower.id, followeeId: jana.id },
    ]);
  });

  test('answers 409 cannot_follow_self for the own profile', async ({ member, dataSource }) => {
    const response = await member.follow(member.id);

    expect(response.status).toBe(409);
    expect(response.body).toStrictEqual({
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      detail: 'A profile cannot follow itself.',
      instance: followRoute(member.id),
      code: 'cannot_follow_self',
    });
    expect(await storedFollows(dataSource)).toEqual([]);
  });

  test('answers 409 cannot_follow_self for the own id in upper case', async ({ member }) => {
    const response = await member.follow(member.id.toUpperCase());

    expect(response.status).toBe(409);
    expect((response.body as ProblemDetails).code).toBe('cannot_follow_self');
  });

  test('answers 404 profile_not_found for an unknown user', async ({ member, dataSource }) => {
    const unknown = randomUUID();

    const response = await member.follow(unknown);

    expect(response.status).toBe(404);
    expect(response.body).toStrictEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'No such profile was found.',
      instance: followRoute(unknown),
      code: 'profile_not_found',
    });
    expect(await storedFollows(dataSource)).toEqual([]);
  });

  test('answers 404 profile_not_found for a user without a profile', async ({
    member,
    newMemberWithoutProfile,
  }) => {
    const withoutProfile = await newMemberWithoutProfile();

    const response = await member.follow(withoutProfile.id);

    expect(response.status).toBe(404);
    expect((response.body as ProblemDetails).code).toBe('profile_not_found');
  });

  test('answers 400 validation_failed for an id that is not a UUID', async ({ member }) => {
    const response = await member.follow('jana');

    expect(response.status).toBe(400);
    expect((response.body as ProblemDetails).code).toBe('validation_failed');
  });
});

describe('DELETE /v1/profiles/:userId/follow', () => {
  test('answers 401 authentication_required without an access token', async ({ http, member }) => {
    const response = await http.delete(followRoute(member.id));

    expect(response.status).toBe(401);
  });

  test('unfollows the user, also when the user is not followed', async ({
    member,
    newMember,
    dataSource,
  }) => {
    const jana = await newMember();
    await member.follows(jana);

    const first = await member.unfollow(jana.id);
    const second = await member.unfollow(jana.id);

    expect([first.status, second.status]).toEqual([204, 204]);
    expect(await storedFollows(dataSource)).toEqual([]);
    expect(await profileOf(member, jana)).toMatchObject({
      followerCount: 0,
      followedByMe: false,
    });
  });

  test('keeps the follows of other users', async ({ member, newMember, dataSource }) => {
    const jana = await newMember();
    const peter = await newMember();
    await member.follows(jana);
    await peter.follows(jana);

    await member.unfollow(jana.id);

    expect(await storedFollows(dataSource)).toEqual([
      { followerId: peter.id, followeeId: jana.id },
    ]);
  });

  test('answers 409 cannot_follow_self for the own profile', async ({ member }) => {
    const response = await member.unfollow(member.id);

    expect(response.status).toBe(409);
    expect((response.body as ProblemDetails).code).toBe('cannot_follow_self');
  });

  test('answers 404 profile_not_found for an unknown user', async ({ member }) => {
    const response = await member.unfollow(randomUUID());

    expect(response.status).toBe(404);
    expect((response.body as ProblemDetails).code).toBe('profile_not_found');
  });
});

describe('GET /v1/profiles/:userId/followers and /following', () => {
  test('lists the followers, most recent follow first', async ({ member, newMember }) => {
    const jana = await newMember({ handle: 'jana' });
    const peter = await newMember({ handle: 'peter', displayName: 'Peter' });
    const eva = await newMember({ handle: 'eva' });
    await jana.follows(member);
    await peter.follows(member);
    await eva.follows(member);

    const followers = await listOf(member, `${profileRoute(member.id)}/followers`);

    expect(followers).toStrictEqual({
      items: [
        {
          userId: eva.id,
          handle: 'eva',
          displayName: null,
          avatar: null,
          official: false,
          followedByMe: false,
        },
        {
          userId: peter.id,
          handle: 'peter',
          displayName: 'Peter',
          avatar: null,
          official: false,
          followedByMe: false,
        },
        {
          userId: jana.id,
          handle: 'jana',
          displayName: null,
          avatar: null,
          official: false,
          followedByMe: false,
        },
      ],
      nextOffset: null,
    });
  });

  test('lists the followed profiles, most recent follow first', async ({ member, newMember }) => {
    const jana = await newMember({ handle: 'jana' });
    const peter = await newMember({ handle: 'peter' });
    await member.follows(jana, peter);

    const following = await listOf(member, `${profileRoute(member.id)}/following`);

    expect(following.items.map(({ handle, followedByMe }) => ({ handle, followedByMe }))).toEqual([
      { handle: 'peter', followedByMe: true },
      { handle: 'jana', followedByMe: true },
    ]);
  });

  test('tells which listed profiles the viewer follows', async ({ member, newMember }) => {
    const jana = await newMember({ handle: 'jana' });
    const peter = await newMember({ handle: 'peter' });
    const eva = await newMember({ handle: 'eva' });
    await jana.follows(peter, eva);
    await member.follows(eva);

    const following = await listOf(member, `${profileRoute(jana.id)}/following`);

    expect(following.items.map(({ handle, followedByMe }) => ({ handle, followedByMe }))).toEqual([
      { handle: 'eva', followedByMe: true },
      { handle: 'peter', followedByMe: false },
    ]);
  });

  test('pages through the lists', async ({ member, newMember }) => {
    const followers: Member[] = [];
    for (const handle of ['a.reader', 'b.reader', 'c.reader']) {
      const follower = await newMember({ handle });
      await follower.follows(member);
      followers.push(follower);
    }

    const first = await listOf(member, `${profileRoute(member.id)}/followers?limit=2`);
    const second = await listOf(member, `${profileRoute(member.id)}/followers?limit=2&offset=2`);

    expect(first.items.map(({ handle }) => handle)).toEqual(['c.reader', 'b.reader']);
    expect(first.nextOffset).toBe(2);
    expect(second.items.map(({ handle }) => handle)).toEqual(['a.reader']);
    expect(second.nextOffset).toBeNull();
  });

  test('answers empty lists for a profile without follows', async ({ member, newMember }) => {
    const jana = await newMember();

    for (const list of ['followers', 'following']) {
      expect(await listOf(member, `${profileRoute(jana.id)}/${list}`)).toStrictEqual({
        items: [],
        nextOffset: null,
      });
    }
  });

  test.for(['followers', 'following'])(
    'answers 404 profile_not_found for the %s of an unknown user',
    async (list, { member }) => {
      const response = await member.get(`${profileRoute(randomUUID())}/${list}`);

      expect(response.status).toBe(404);
      expect((response.body as ProblemDetails).code).toBe('profile_not_found');
    },
  );

  test.for(['limit=0', 'limit=51', 'offset=1001'])(
    'answers 400 validation_failed for %s',
    async (query, { member }) => {
      const response = await member.get(`${profileRoute(member.id)}/followers?${query}`);

      expect(response.status).toBe(400);
      expect((response.body as ProblemDetails).code).toBe('validation_failed');
    },
  );

  test('answers 401 authentication_required without an access token', async ({ http, member }) => {
    for (const list of ['followers', 'following']) {
      const response = await http.get(`${profileRoute(member.id)}/${list}`);

      expect(response.status).toBe(401);
    }
  });
});

describe('the limit of 2000 followed profiles', () => {
  test('answers 409 follow_limit_reached at the limit', async ({
    member,
    newMember,
    factories,
    dataSource,
  }) => {
    await arrangeFollowing(factories, dataSource, member.id, MAX_FOLLOWING);
    const jana = await newMember({ handle: 'jana' });

    const response = await member.follow(jana.id);

    expect(response.status).toBe(409);
    expect(response.body).toStrictEqual({
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      detail: 'A profile can follow at most 2000 profiles; unfollow some before following more.',
      instance: followRoute(jana.id),
      code: 'follow_limit_reached',
    });
    expect((await member.profile()).followingCount).toBe(MAX_FOLLOWING);
  });

  test('still answers 204 for a profile that is already followed at the limit', async ({
    member,
    factories,
    dataSource,
  }) => {
    await arrangeFollowing(factories, dataSource, member.id, MAX_FOLLOWING);
    const [followed] = await storedFollows(dataSource);

    const response = await member.follow(followed?.followeeId ?? '');

    expect(response.status).toBe(204);
  });

  test('follows again after an unfollow below the limit', async ({
    member,
    newMember,
    factories,
    dataSource,
  }) => {
    await arrangeFollowing(factories, dataSource, member.id, MAX_FOLLOWING);
    const [followed] = await storedFollows(dataSource);
    const jana = await newMember({ handle: 'jana' });

    await member.unfollow(followed?.followeeId ?? '');
    const response = await member.follow(jana.id);

    expect(response.status).toBe(204);
    expect((await member.profile()).followingCount).toBe(MAX_FOLLOWING);
  });

  test('lets only one of two concurrent follows take the last place', async ({
    member,
    newMember,
    factories,
    dataSource,
  }) => {
    await arrangeFollowing(factories, dataSource, member.id, MAX_FOLLOWING - 1);
    const jana = await newMember({ handle: 'jana' });
    const peter = await newMember({ handle: 'peter' });

    const responses = await Promise.all([member.follow(jana.id), member.follow(peter.id)]);

    expect(responses.map(({ status }) => status).toSorted()).toEqual([204, 409]);
    expect((await member.profile()).followingCount).toBe(MAX_FOLLOWING);
  });
});

import { randomUUID } from 'node:crypto';
import { describe, expect } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import type { ProfileResponse } from '../../../src/modules/profiles/http/profile.response.js';
import { PROFILES_ROUTE, profileRoute, storedProfiles, test } from './profiles.fixture.js';

const byHandleRoute = (handle: string): string => `${PROFILES_ROUTE}/by-handle/${handle}`;

const PROFILE_NOT_FOUND = {
  type: 'about:blank',
  title: 'Not Found',
  status: 404,
  detail: 'No such profile was found.',
  code: 'profile_not_found',
};

describe('GET /v1/profiles/:userId', () => {
  test('answers 401 authentication_required without an access token', async ({ http, member }) => {
    const response = await http.get(profileRoute(member.id));

    expect(response.status).toBe(401);
    expect((response.body as ProblemDetails).code).toBe('authentication_required');
  });

  test('answers the profile of another user', async ({ member, newMember }) => {
    const jana = await newMember({
      handle: 'jana',
      displayName: 'Jana',
      bio: 'Čítam po nociach.',
      favouriteGenres: ['poetry'],
    });

    const response = await member.get(profileRoute(jana.id));

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      userId: jana.id,
      handle: 'jana',
      displayName: 'Jana',
      bio: 'Čítam po nociach.',
      favouriteGenres: ['poetry'],
      topBooks: [],
      avatar: null,
      official: false,
      followerCount: 0,
      followingCount: 0,
      followedByMe: false,
    });
  });

  test('accepts the user id in upper case', async ({ member, newMember }) => {
    const jana = await newMember({ handle: 'jana' });

    const response = await member.get(profileRoute(jana.id.toUpperCase()));

    expect(response.status).toBe(200);
    expect((response.body as ProfileResponse).userId).toBe(jana.id);
  });

  test('answers 404 profile_not_found for an unknown user', async ({ member }) => {
    const unknown = randomUUID();

    const response = await member.get(profileRoute(unknown));

    expect(response.status).toBe(404);
    expect(response.body).toStrictEqual({ ...PROFILE_NOT_FOUND, instance: profileRoute(unknown) });
  });

  test('answers 404 profile_not_found for a user without a profile and creates none', async ({
    member,
    newMemberWithoutProfile,
    dataSource,
  }) => {
    const withoutProfile = await newMemberWithoutProfile();

    const response = await member.get(profileRoute(withoutProfile.id));

    expect(response.status).toBe(404);
    expect((response.body as ProblemDetails).code).toBe('profile_not_found');
    expect(await storedProfiles(dataSource)).toEqual([
      { userId: member.id, handle: expect.any(String) as string },
    ]);
  });

  test('answers 400 validation_failed for an id that is not a UUID', async ({ member }) => {
    const response = await member.get(profileRoute('jana'));

    expect(response.status).toBe(400);
    expect((response.body as ProblemDetails).errors).toEqual([
      expect.objectContaining({ path: 'userId', code: 'invalid_format' }),
    ]);
  });
});

describe('GET /v1/profiles/by-handle/:handle', () => {
  test('answers the profile with the handle, ignoring case', async ({ member, newMember }) => {
    const jana = await newMember({ handle: 'jana.novakova' });

    const response = await member.get(byHandleRoute('Jana.Novakova'));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ userId: jana.id, handle: 'jana.novakova' });
  });

  test('answers 404 profile_not_found for an unknown handle', async ({ member }) => {
    const response = await member.get(byHandleRoute('nobody'));

    expect(response.status).toBe(404);
    expect(response.body).toStrictEqual({
      ...PROFILE_NOT_FOUND,
      instance: byHandleRoute('nobody'),
    });
  });

  test('answers 400 validation_failed for a malformed handle', async ({ member }) => {
    const response = await member.get(byHandleRoute('a..b'));

    expect(response.status).toBe(400);
    expect((response.body as ProblemDetails).errors).toEqual([
      expect.objectContaining({ path: 'handle', code: 'invalid_format' }),
    ]);
  });
});

describe('GET /v1/profiles/genres', () => {
  test('answers the genre keys', async ({ member }) => {
    const response = await member.get(`${PROFILES_ROUTE}/genres`);

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      genres: [
        'fantasy',
        'science_fiction',
        'crime',
        'thriller',
        'romance',
        'literary_fiction',
        'classics',
        'historical_fiction',
        'horror',
        'poetry',
        'drama',
        'biography',
        'history',
        'philosophy',
        'psychology',
        'self_help',
        'science',
        'travel',
        'children',
        'young_adult',
        'comics',
        'non_fiction_other',
      ],
    });
  });

  test('answers 401 authentication_required without an access token', async ({ http }) => {
    const response = await http.get(`${PROFILES_ROUTE}/genres`);

    expect(response.status).toBe(401);
  });
});

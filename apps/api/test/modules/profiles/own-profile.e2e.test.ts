import { describe, expect } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import type { AuthSessionResponse } from '../../../src/modules/auth/http/auth-session.response.js';
import type { ProfileResponse } from '../../../src/modules/profiles/http/profile.response.js';
import { ME_PROFILE_ROUTE, storedProfiles, test } from './profiles.fixture.js';

const DEFAULT_HANDLE = /^citatel\d{6}$/;

const EMPTY_PROFILE = {
  displayName: null,
  bio: null,
  favouriteGenres: [],
  topBooks: [],
  avatar: null,
  followerCount: 0,
  followingCount: 0,
  followedByMe: false,
};

describe('profile creation', () => {
  test('creates a profile with a generated handle when a user registers', async ({
    http,
    dataSource,
  }) => {
    const registered = await http
      .post('/v1/auth/register')
      .send({ email: 'jana@example.test', password: 'a quiet afternoon with a book' });
    const { user, accessToken } = registered.body as AuthSessionResponse;
    const stored = await storedProfiles(dataSource);

    const response = await http.get(ME_PROFILE_ROUTE).set('Authorization', `Bearer ${accessToken}`);

    expect(registered.status).toBe(201);
    expect(stored).toEqual([
      { userId: user.id, handle: expect.stringMatching(DEFAULT_HANDLE) as string },
    ]);
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      userId: user.id,
      handle: stored[0]?.handle,
      ...EMPTY_PROFILE,
    });
  });

  test('creates a missing profile on the first read when the registration event was lost', async ({
    newMemberWithoutProfile,
    dataSource,
  }) => {
    const member = await newMemberWithoutProfile();
    const before = await storedProfiles(dataSource);

    const first = await member.profile();
    const second = await member.profile();

    expect(before).toEqual([]);
    expect(first).toStrictEqual({
      userId: member.id,
      handle: expect.stringMatching(DEFAULT_HANDLE) as string,
      ...EMPTY_PROFILE,
    });
    expect(second.handle).toBe(first.handle);
    expect(await storedProfiles(dataSource)).toEqual([{ userId: member.id, handle: first.handle }]);
  });

  test('creates a missing profile on the first update and applies the change', async ({
    newMemberWithoutProfile,
    dataSource,
  }) => {
    const member = await newMemberWithoutProfile();

    const response = await member.updateProfile({ displayName: 'Jana' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ userId: member.id, displayName: 'Jana' });
    expect(await storedProfiles(dataSource)).toHaveLength(1);
  });

  test('creates one profile for concurrent first reads', async ({
    newMemberWithoutProfile,
    dataSource,
  }) => {
    const member = await newMemberWithoutProfile();

    const responses = await Promise.all([
      member.get(ME_PROFILE_ROUTE),
      member.get(ME_PROFILE_ROUTE),
      member.get(ME_PROFILE_ROUTE),
    ]);
    const handles = responses.map(({ body }) => (body as ProfileResponse).handle);

    expect(responses.map(({ status }) => status)).toEqual([200, 200, 200]);
    expect(new Set(handles).size).toBe(1);
    expect(await storedProfiles(dataSource)).toHaveLength(1);
  });
});

describe('GET /v1/me/profile', () => {
  test('answers 401 authentication_required without an access token', async ({ http }) => {
    const response = await http.get(ME_PROFILE_ROUTE);

    expect(response.status).toBe(401);
    expect((response.body as ProblemDetails).code).toBe('authentication_required');
  });

  test('answers the own profile', async ({ newMember }) => {
    const member = await newMember({
      handle: 'jana.novakova',
      displayName: 'Jana Nováková',
      bio: 'Čítam po nociach.',
      favouriteGenres: ['crime', 'poetry'],
    });

    expect(await member.profile()).toStrictEqual({
      ...EMPTY_PROFILE,
      userId: member.id,
      handle: 'jana.novakova',
      displayName: 'Jana Nováková',
      bio: 'Čítam po nociach.',
      favouriteGenres: ['crime', 'poetry'],
    });
  });
});

describe('PATCH /v1/me/profile', () => {
  test('answers 401 authentication_required without an access token', async ({ http }) => {
    const response = await http.patch(ME_PROFILE_ROUTE).send({ displayName: 'Jana' });

    expect(response.status).toBe(401);
    expect((response.body as ProblemDetails).code).toBe('authentication_required');
  });

  test('changes only the fields in the body', async ({ newMember }) => {
    const member = await newMember({
      handle: 'jana',
      displayName: 'Jana',
      bio: 'Čítam.',
      favouriteGenres: ['fantasy'],
    });

    const response = await member.updateProfile({ bio: 'Čítam veľa.' });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      ...EMPTY_PROFILE,
      userId: member.id,
      handle: 'jana',
      displayName: 'Jana',
      bio: 'Čítam veľa.',
      favouriteGenres: ['fantasy'],
    });
    expect(await member.profile()).toStrictEqual(response.body);
  });

  test('keeps everything for an empty body', async ({ newMember }) => {
    const member = await newMember({ handle: 'jana', displayName: 'Jana' });
    const before = await member.profile();

    const response = await member.updateProfile({});

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual(before);
  });

  test('clears nullable fields with null and keeps the others', async ({ newMember }) => {
    const member = await newMember({ handle: 'jana', displayName: 'Jana', bio: 'Čítam.' });

    const response = await member.updateProfile({ displayName: null });

    expect(response.body).toMatchObject({ handle: 'jana', displayName: null, bio: 'Čítam.' });
  });

  test('ignores unknown fields', async ({ member }) => {
    const before = await member.profile();

    const response = await member.updateProfile({ followerCount: 1000, userId: 'x' });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual(before);
  });

  describe('handle', () => {
    test.for([
      { input: 'jana', stored: 'jana' },
      { input: '  Jana.Novakova  ', stored: 'jana.novakova' },
      { input: 'abc', stored: 'abc' },
      { input: 'a'.repeat(30), stored: 'a'.repeat(30) },
      { input: 'j_n.2026', stored: 'j_n.2026' },
      { input: '007', stored: '007' },
    ])('accepts $input as $stored', async ({ input, stored }, { member }) => {
      const response = await member.updateProfile({ handle: input });

      expect(response.status).toBe(200);
      expect((response.body as ProfileResponse).handle).toBe(stored);
    });

    test.for([
      { input: 'ab', code: 'too_small' },
      { input: '  ab  ', code: 'too_small' },
      { input: 'a'.repeat(31), code: 'too_big' },
      { input: '.jana', code: 'invalid_format' },
      { input: 'jana.', code: 'invalid_format' },
      { input: '_jana', code: 'invalid_format' },
      { input: 'jana_', code: 'invalid_format' },
      { input: 'ja..na', code: 'invalid_format' },
      { input: 'ja._na', code: 'invalid_format' },
      { input: 'ján', code: 'invalid_format' },
      { input: 'ja na', code: 'invalid_format' },
      { input: 'ja-na', code: 'invalid_format' },
      { input: '@jana', code: 'invalid_format' },
      { input: null, code: 'invalid_type' },
      { input: 42, code: 'invalid_type' },
    ])('rejects $input with 400 validation_failed', async ({ input, code }, { member }) => {
      const before = await member.profile();

      const response = await member.updateProfile({ handle: input });
      const problem = response.body as ProblemDetails;

      expect(response.status).toBe(400);
      expect(problem.code).toBe('validation_failed');
      expect(problem.errors).toEqual([expect.objectContaining({ path: 'handle', code })]);
      expect(await member.profile()).toStrictEqual(before);
    });

    test('answers 409 handle_taken for a handle of another profile, ignoring case', async ({
      member,
      newMember,
    }) => {
      await newMember({ handle: 'jana' });
      const before = await member.profile();

      const response = await member.updateProfile({ handle: 'JANA', displayName: 'Jana' });

      expect(response.status).toBe(409);
      expect(response.body).toStrictEqual({
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        detail: 'Another profile already uses this handle.',
        instance: ME_PROFILE_ROUTE,
        code: 'handle_taken',
      });
      expect(await member.profile()).toStrictEqual(before);
    });

    test('keeps the own handle when it is sent again', async ({ newMember }) => {
      const member = await newMember({ handle: 'jana' });

      const response = await member.updateProfile({ handle: 'jana' });

      expect(response.status).toBe(200);
    });

    test('gives one 200 and one 409 handle_taken for concurrent changes to the same handle', async ({
      member,
      newMember,
      dataSource,
    }) => {
      const other = await newMember();

      const responses = await Promise.all([
        member.updateProfile({ handle: 'jana' }),
        other.updateProfile({ handle: 'jana' }),
      ]);

      expect(responses.map(({ status }) => status).toSorted()).toEqual([200, 409]);
      expect(responses.map(({ body }) => (body as ProblemDetails).code)).toContain('handle_taken');
      expect(
        (await storedProfiles(dataSource)).filter(({ handle }) => handle === 'jana'),
      ).toHaveLength(1);
    });
  });

  describe('display name and bio', () => {
    test('trims and composes the text (NFC)', async ({ member }) => {
      const response = await member.updateProfile({
        displayName: '  Jána Nováková  ',
        bio: '\n Čítam po nociach. \n',
      });

      expect(response.body).toMatchObject({
        displayName: 'Jána Nováková',
        bio: 'Čítam po nociach.',
      });
    });

    test.for([
      { field: 'displayName', value: '' },
      { field: 'displayName', value: '   ' },
      { field: 'displayName', value: null },
      { field: 'bio', value: '' },
      { field: 'bio', value: ' \n ' },
      { field: 'bio', value: null },
    ])('stores no $field for $value', async ({ field, value }, { newMember }) => {
      const member = await newMember({ displayName: 'Jana', bio: 'Čítam.' });

      const response = await member.updateProfile({ [field]: value });

      expect(response.status).toBe(200);
      expect((response.body as Record<string, unknown>)[field]).toBeNull();
    });

    test.for([
      { field: 'displayName', value: 'd'.repeat(50) },
      { field: 'displayName', value: '📚'.repeat(50) },
      { field: 'bio', value: 'b'.repeat(300) },
      { field: 'bio', value: '📚'.repeat(300) },
    ])(
      'accepts a $field at the limit of Unicode code points',
      async ({ field, value }, { member }) => {
        const response = await member.updateProfile({ [field]: `  ${value}  ` });

        expect(response.status).toBe(200);
        expect((response.body as Record<string, unknown>)[field]).toBe(value);
      },
    );

    test.for([
      { field: 'displayName', value: 'd'.repeat(51) },
      { field: 'displayName', value: '📚'.repeat(51) },
      { field: 'bio', value: 'b'.repeat(301) },
      { field: 'bio', value: '📚'.repeat(301) },
    ])('rejects a $field over the limit', async ({ field, value }, { member }) => {
      const response = await member.updateProfile({ [field]: value });
      const problem = response.body as ProblemDetails;

      expect(response.status).toBe(400);
      expect(problem.errors).toEqual([expect.objectContaining({ path: field, code: 'too_big' })]);
    });
  });

  describe('favourite genres', () => {
    test('stores the genres in the given order', async ({ member }) => {
      const response = await member.updateProfile({
        favouriteGenres: ['poetry', 'fantasy', 'science_fiction'],
      });

      expect(response.status).toBe(200);
      expect((response.body as ProfileResponse).favouriteGenres).toEqual([
        'poetry',
        'fantasy',
        'science_fiction',
      ]);
    });

    test('accepts 10 genres and clears them with an empty list', async ({ member }) => {
      const ten = [
        'fantasy',
        'science_fiction',
        'crime',
        'thriller',
        'romance',
        'classics',
        'horror',
        'poetry',
        'drama',
        'history',
      ];

      const filled = await member.updateProfile({ favouriteGenres: ten });
      const cleared = await member.updateProfile({ favouriteGenres: [] });

      expect((filled.body as ProfileResponse).favouriteGenres).toEqual(ten);
      expect((cleared.body as ProfileResponse).favouriteGenres).toEqual([]);
    });

    test.for([
      {
        problem: 'an unknown genre',
        genres: ['fantasy', 'cooking'],
        error: { path: 'favouriteGenres.1', code: 'invalid_value' },
      },
      {
        problem: 'a repeated genre',
        genres: ['fantasy', 'crime', 'fantasy'],
        error: { path: 'favouriteGenres', code: 'custom' },
      },
      {
        problem: 'more than 10 genres',
        genres: [
          'fantasy',
          'science_fiction',
          'crime',
          'thriller',
          'romance',
          'classics',
          'horror',
          'poetry',
          'drama',
          'history',
          'travel',
        ],
        error: { path: 'favouriteGenres', code: 'too_big' },
      },
      {
        problem: 'a genre that is not a string',
        genres: [7],
        error: { path: 'favouriteGenres.0', code: 'invalid_value' },
      },
    ])('rejects $problem with 400 validation_failed', async ({ genres, error }, { member }) => {
      const response = await member.updateProfile({ favouriteGenres: genres });
      const problem = response.body as ProblemDetails;

      expect(response.status).toBe(400);
      expect(problem.code).toBe('validation_failed');
      expect(problem.errors).toEqual([expect.objectContaining(error)]);
    });
  });
});

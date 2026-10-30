import { describe, expect } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import type { ProfileSummaryPageResponse } from '../../../src/modules/profiles/http/profile.response.js';
import { PROFILES_ROUTE, test, type Member } from './profiles.fixture.js';

async function search(member: Member, query: string): Promise<ProfileSummaryPageResponse> {
  const response = await member.get(`${PROFILES_ROUTE}?${query}`);
  expect(response.status).toBe(200);

  return response.body as ProfileSummaryPageResponse;
}

async function handlesFound(member: Member, q: string): Promise<string[]> {
  const { items } = await search(member, `q=${encodeURIComponent(q)}`);

  return items.map(({ handle }) => handle);
}

describe('GET /v1/profiles', () => {
  test('answers 401 authentication_required without an access token', async ({ http }) => {
    const response = await http.get(`${PROFILES_ROUTE}?q=jana`);

    expect(response.status).toBe(401);
    expect((response.body as ProblemDetails).code).toBe('authentication_required');
  });

  test('answers matching profiles as summaries', async ({ member, newMember }) => {
    const jan = await newMember({ handle: 'jan.stastny', displayName: 'Ján Šťastný', bio: 'Bio' });

    expect(await search(member, 'q=stastny')).toStrictEqual({
      items: [
        {
          userId: jan.id,
          handle: 'jan.stastny',
          displayName: 'Ján Šťastný',
          avatar: null,
          official: false,
          followedByMe: false,
        },
      ],
      nextOffset: null,
    });
  });

  test.for([
    { q: 'šťastný', found: ['jan.stastny'] },
    { q: 'ŠŤASTNÝ', found: ['jan.stastny'] },
    { q: 'Stastny', found: ['jan.stastny'] },
    { q: 'kovacova', found: ['jana.k'] },
    { q: 'jan', found: ['jan.stastny', 'jana.k'] },
    { q: '@jana', found: ['jana.k'] },
    { q: 'jana.k', found: ['jana.k'] },
    { q: 'ján šťastný', found: ['jan.stastny'] },
    { q: 'kovacova peter', found: [] },
    { q: 'nikto', found: [] },
    { q: '@@', found: [] },
    { q: '%_', found: [] },
  ])(
    'finds $found for $q, ignoring case and diacritics',
    async ({ q, found }, { member, newMember }) => {
      await newMember({ handle: 'jan.stastny', displayName: 'Ján Šťastný' });
      await newMember({ handle: 'jana.k', displayName: 'Jana Kováčová' });
      await newMember({ handle: 'peter', displayName: null });

      expect(await handlesFound(member, q)).toEqual(found);
    },
  );

  test('tells which found profiles the user follows', async ({ member, newMember }) => {
    const jana = await newMember({ handle: 'jana' });
    await newMember({ handle: 'janka' });
    await member.follows(jana);

    const { items } = await search(member, 'q=jan');

    expect(items.map(({ handle, followedByMe }) => ({ handle, followedByMe }))).toEqual([
      { handle: 'jana', followedByMe: true },
      { handle: 'janka', followedByMe: false },
    ]);
  });

  test('pages through the results', async ({ member, newMember }) => {
    for (const handle of ['citatel.a', 'citatel.b', 'citatel.c']) {
      await newMember({ handle });
    }

    const first = await search(member, 'q=citatel&limit=2');
    const second = await search(member, 'q=citatel&limit=2&offset=2');

    expect(first.items.map(({ handle }) => handle)).toEqual(['citatel.a', 'citatel.b']);
    expect(first.nextOffset).toBe(2);
    expect(second.items.map(({ handle }) => handle)).toEqual(['citatel.c']);
    expect(second.nextOffset).toBeNull();
  });

  test.for([
    { query: '', path: 'q' },
    { query: 'q=j', path: 'q' },
    { query: 'q=%20%20j%20%20', path: 'q' },
    { query: `q=${'j'.repeat(51)}`, path: 'q' },
    { query: 'q=jana&limit=0', path: 'limit' },
    { query: 'q=jana&limit=51', path: 'limit' },
    { query: 'q=jana&offset=-1', path: 'offset' },
    { query: 'q=jana&offset=1001', path: 'offset' },
  ])('answers 400 validation_failed for $query', async ({ query, path }, { member }) => {
    const response = await member.get(`${PROFILES_ROUTE}?${query}`);
    const problem = response.body as ProblemDetails;

    expect(response.status).toBe(400);
    expect(problem.code).toBe('validation_failed');
    expect(problem.errors).toEqual([expect.objectContaining({ path })]);
  });
});

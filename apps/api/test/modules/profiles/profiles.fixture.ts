import type { Agent, Test } from 'supertest';
import type { DataSource } from 'typeorm';
import type { SeederFactoryManager } from 'typeorm-extension';
import { expect } from 'vitest';
import type { ProfileFactoryMeta } from '../../../src/modules/profiles/factories/profile.factory.js';
import type { ProfileResponse } from '../../../src/modules/profiles/http/profile.response.js';
import { ProfileEntity } from '../../../src/modules/profiles/persistence/profile.entity.js';
import { integrationTest } from '../../support/integration-test.js';
import type { SignedInUser, SignIn } from '../../support/sign-in.js';

export const ME_PROFILE_ROUTE = '/v1/me/profile';

export const PROFILES_ROUTE = '/v1/profiles';

export const profileRoute = (userId: string): string => `${PROFILES_ROUTE}/${userId}`;

export const followRoute = (userId: string): string => `${profileRoute(userId)}/follow`;

export interface Member {
  readonly id: string;
  readonly authorization: string;
  get(path: string): Test;
  updateProfile(body: object): Test;
  follow(userId: string): Test;
  unfollow(userId: string): Test;
  profile(): Promise<ProfileResponse>;
  follows(...members: readonly { readonly id: string }[]): Promise<void>;
}

export type NewMember = (profile?: ProfileFactoryMeta) => Promise<Member>;

export interface StoredProfileRow {
  readonly userId: string;
  readonly handle: string;
}

export function memberOf(http: Agent, { id, authorization }: SignedInUser): Member {
  const member: Member = {
    id,
    authorization,
    get: (path) => http.get(path).set('Authorization', authorization),
    updateProfile: (body) =>
      http.patch(ME_PROFILE_ROUTE).set('Authorization', authorization).send(body),
    follow: (userId) => http.put(followRoute(userId)).set('Authorization', authorization),
    unfollow: (userId) => http.delete(followRoute(userId)).set('Authorization', authorization),
    profile: async () => {
      const response = await member.get(ME_PROFILE_ROUTE);
      expect(response.status).toBe(200);

      return response.body as ProfileResponse;
    },
    follows: async (...members) => {
      for (const followee of members) {
        const response = await member.follow(followee.id);
        expect(response.status, `follow ${followee.id}`).toBe(204);
      }
    },
  };

  return member;
}

function newMemberWith(http: Agent, factories: SeederFactoryManager, signIn: SignIn): NewMember {
  return async (profile = {}) => {
    const user = await signIn();
    await factories
      .get<ProfileEntity, ProfileFactoryMeta>(ProfileEntity)
      .setMeta({ ...profile, userId: user.id })
      .save();

    return memberOf(http, user);
  };
}

export function storedProfiles(dataSource: DataSource): Promise<StoredProfileRow[]> {
  return dataSource.query<StoredProfileRow[]>(
    'SELECT user_id AS "userId", handle FROM profiles.profiles ORDER BY handle',
  );
}

export const test = integrationTest()
  .extend('newMember', ({ http, factories, signIn }) => newMemberWith(http, factories, signIn))
  .extend(
    'newMemberWithoutProfile',
    ({ http, signIn }) =>
      async () =>
        memberOf(http, await signIn()),
  )
  .extend('member', ({ newMember }) => newMember());

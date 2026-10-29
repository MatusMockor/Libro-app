import { randomUUID } from 'node:crypto';
import type { Agent } from 'supertest';
import { describe, expect } from 'vitest';
import type { MediaResponse } from '../../../src/modules/media/http/media.response.js';
import type {
  ProfileResponse,
  ProfileSummaryPageResponse,
} from '../../../src/modules/profiles/http/profile.response.js';
import { ANY_ISO_DATE } from '../../support/matchers.js';
import { jpeg } from '../media/images.js';
import { fetchFile, pathOf } from '../media/media.fixture.js';
import {
  ME_PROFILE_ROUTE,
  PROFILES_ROUTE,
  profileRoute,
  test,
  type Member,
} from './profiles.fixture.js';

const SIGNED_URL =
  /^http:\/\/media\.test\/v1\/media\/files\/[0-9a-f-]{36}\/(small|medium|large)\.webp\?expires=\d+&signature=[\w-]+$/;

async function uploadPhoto(http: Agent, member: Member): Promise<MediaResponse> {
  const response = await http
    .post('/v1/media')
    .set('Authorization', member.authorization)
    .attach('file', await jpeg({ width: 1600, height: 1200 }), {
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    });
  expect(response.status).toBe(201);

  return response.body as MediaResponse;
}

function expectedAvatar({ variants }: MediaResponse) {
  const variant = ({ width, height }: { width: number; height: number }) => ({
    url: expect.stringMatching(SIGNED_URL) as string,
    width,
    height,
  });

  return {
    variants: {
      small: variant(variants.small),
      medium: variant(variants.medium),
      large: variant(variants.large),
    },
    urlsExpireAt: ANY_ISO_DATE,
  };
}

describe('avatar', () => {
  test('sets one of the own photos as the avatar', async ({ http, member }) => {
    const photo = await uploadPhoto(http, member);

    const response = await member.updateProfile({ avatarMediaId: photo.id });

    expect(response.status).toBe(200);
    expect((response.body as ProfileResponse).avatar).toStrictEqual(expectedAvatar(photo));
    expect((await member.profile()).avatar).toStrictEqual(expectedAvatar(photo));
  });

  test('shows the avatar to other users through a working signed URL', async ({
    http,
    member,
    newMember,
  }) => {
    const photo = await uploadPhoto(http, member);
    await member.updateProfile({ avatarMediaId: photo.id });
    const other = await newMember();

    const response = await other.get(profileRoute(member.id));
    const avatar = (response.body as ProfileResponse).avatar;
    const file = await fetchFile(http, pathOf(avatar?.variants.small.url ?? ''));

    expect(avatar).toStrictEqual(expectedAvatar(photo));
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toBe('image/webp');
  });

  test('shows the avatar in profile lists', async ({ http, member, newMember }) => {
    const photo = await uploadPhoto(http, member);
    await member.updateProfile({ handle: 'jana.reads', avatarMediaId: photo.id });
    const other = await newMember();

    const response = await other.get(`${PROFILES_ROUTE}?q=jana`);

    expect((response.body as ProfileSummaryPageResponse).items).toEqual([
      expect.objectContaining({ userId: member.id, avatar: expectedAvatar(photo) }),
    ]);
  });

  test('removes the avatar with null', async ({ http, member }) => {
    const photo = await uploadPhoto(http, member);
    await member.updateProfile({ avatarMediaId: photo.id });

    const response = await member.updateProfile({ avatarMediaId: null });

    expect((response.body as ProfileResponse).avatar).toBeNull();
  });

  test('answers no avatar once the photo was deleted', async ({ http, member, newMember }) => {
    const photo = await uploadPhoto(http, member);
    await member.updateProfile({ avatarMediaId: photo.id });

    const deleted = await http
      .delete(`/v1/media/${photo.id}`)
      .set('Authorization', member.authorization);
    const other = await newMember();
    const seenByOther = await other.get(profileRoute(member.id));

    expect(deleted.status).toBe(204);
    expect((await member.profile()).avatar).toBeNull();
    expect(seenByOther.status).toBe(200);
    expect((seenByOther.body as ProfileResponse).avatar).toBeNull();
  });

  test('answers 404 media_not_found for a photo of another user', async ({
    http,
    member,
    newMember,
  }) => {
    const other = await newMember();
    const theirs = await uploadPhoto(http, other);
    const before = await member.profile();

    const response = await member.updateProfile({ avatarMediaId: theirs.id });

    expect(response.status).toBe(404);
    expect(response.body).toStrictEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: `No media with id ${theirs.id} was found.`,
      instance: ME_PROFILE_ROUTE,
      code: 'media_not_found',
    });
    expect(await member.profile()).toStrictEqual(before);
  });

  test('answers 404 media_not_found for an unknown photo', async ({ member }) => {
    const response = await member.updateProfile({ avatarMediaId: randomUUID() });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'media_not_found' });
  });

  test('rejects an avatar id that is not a UUID', async ({ member }) => {
    const response = await member.updateProfile({ avatarMediaId: 'photo' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'validation_failed',
      errors: [expect.objectContaining({ path: 'avatarMediaId' })],
    });
  });
});

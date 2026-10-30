import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import type { SeederFactoryManager } from 'typeorm-extension';
import { describe, expect, vi } from 'vitest';
import type { ProblemDetails } from '../../../src/http/problem-details/problem-details.schema.js';
import type { PostResponse } from '../../../src/modules/feed/http/post.response.js';
import type { MediaFileFactoryMeta } from '../../../src/modules/media/factories/media-file.factory.js';
import type { MediaResponse } from '../../../src/modules/media/http/media.response.js';
import { MediaFileEntity } from '../../../src/modules/media/persistence/media-file.entity.js';
import { expectedPhoto, fetchFile, pathOf, uploadPhoto } from '../media/media.fixture.js';
import {
  arrangePosts,
  COMMUNITY_ROUTE,
  hoursAgo,
  POSTS_ROUTE,
  test,
  type Reader,
} from './feed.fixture.js';

interface StoredPhotoRow {
  readonly position: number;
  readonly mediaId: string;
}

interface StoredPostRow {
  readonly text: string | null;
}

function storedPhotos(dataSource: DataSource, postId: string): Promise<StoredPhotoRow[]> {
  return dataSource.query<StoredPhotoRow[]>(
    `SELECT position, media_id AS "mediaId"
     FROM feed.post_photos
     WHERE post_id = $1
     ORDER BY position`,
    [postId],
  );
}

function storedPosts(dataSource: DataSource): Promise<StoredPostRow[]> {
  return dataSource.query<StoredPostRow[]>('SELECT text FROM feed.posts ORDER BY created_at');
}

async function photosOf(
  http: Parameters<typeof uploadPhoto>[0],
  reader: Reader,
  count: number,
): Promise<MediaResponse[]> {
  const photos: MediaResponse[] = [];
  for (let uploaded = 0; uploaded < count; uploaded += 1) {
    photos.push(await uploadPhoto(http, reader, { width: 400 + uploaded * 10, height: 300 }));
  }

  return photos;
}

async function arrangeMedia(
  factories: SeederFactoryManager,
  ownerId: string,
  count: number,
): Promise<string[]> {
  const factory = factories.get<MediaFileEntity, MediaFileFactoryMeta>(MediaFileEntity);
  const ids: string[] = [];
  for (let made = 0; made < count; made += 1) {
    ids.push((await factory.setMeta({ ownerId }).save()).id);
  }

  return ids;
}

function mediaIdsOf({ photos }: PostResponse): string[] {
  return photos.map(({ mediaId }) => mediaId);
}

describe('photos in posts', () => {
  test('publishes a post with own photos in the given order', async ({
    http,
    reader,
    dataSource,
  }) => {
    const [first, second, third] = await photosOf(http, reader, 3);
    const order = [third, first, second].map((photo) => photo?.id ?? '');

    const post = await reader.post({ text: 'Tri fotky', photoIds: order });

    expect(post.photos).toStrictEqual(
      [third, first, second].map((photo) => photo && expectedPhoto(photo)),
    );
    expect(await reader.find(post.id)).toStrictEqual(post);
    expect(await storedPhotos(dataSource, post.id)).toEqual(
      order.map((mediaId, index) => ({ position: index + 1, mediaId })),
    );
  });

  test('accepts four photos and ids in upper case', async ({ http, reader }) => {
    const photos = await photosOf(http, reader, 4);

    const post = await reader.post({
      text: 'Štyri fotky',
      photoIds: photos.map(({ id }) => id.toUpperCase()),
    });

    expect(mediaIdsOf(post)).toEqual(photos.map(({ id }) => id));
  });

  test('publishes a post with only photos, without text', async ({ http, reader, dataSource }) => {
    const [photo] = await photosOf(http, reader, 1);
    const photoIds = [photo?.id];

    const withoutText = await reader.post({ photoIds });
    const withBlankText = await reader.post({ text: ' \n ', photoIds });
    const withNullText = await reader.post({ text: null, photoIds });

    expect([withoutText, withBlankText, withNullText].map(({ text }) => text)).toEqual([
      '',
      '',
      '',
    ]);
    expect(mediaIdsOf(withoutText)).toEqual(photoIds);
    expect(await storedPosts(dataSource)).toEqual([{ text: null }, { text: null }, { text: null }]);
  });

  test.for([
    { name: 'no text and no photo', body: {}, path: 'text' },
    { name: 'a blank text and no photo', body: { text: '  ', photoIds: [] }, path: 'text' },
    { name: 'a null text and no photo', body: { text: null }, path: 'text' },
    {
      name: 'five photos',
      body: { text: 'Ahoj', photoIds: Array.from({ length: 5 }, () => randomUUID()) },
      path: 'photoIds',
    },
    { name: 'a photo id that is not a UUID', body: { photoIds: ['photo'] }, path: 'photoIds.0' },
  ])('answers 400 validation_failed for $name', async ({ body, path }, { reader, dataSource }) => {
    const response = await reader.publish(body);
    const problem = response.body as ProblemDetails;

    expect(response.status).toBe(400);
    expect(problem.code).toBe('validation_failed');
    expect(problem.errors?.map((error) => error.path)).toEqual([path]);
    expect(await storedPosts(dataSource)).toEqual([]);
  });

  test('answers 400 validation_failed for a repeated photo', async ({
    http,
    reader,
    dataSource,
  }) => {
    const [photo] = await photosOf(http, reader, 1);
    const id = photo?.id ?? '';

    const response = await reader.publish({ text: 'Ahoj', photoIds: [id, id.toUpperCase()] });

    expect(response.status).toBe(400);
    expect((response.body as ProblemDetails).errors).toEqual([
      expect.objectContaining({ path: 'photoIds', message: 'Must not repeat a photo' }),
    ]);
    expect(await storedPosts(dataSource)).toEqual([]);
  });

  test('answers 404 media_not_found for a photo of another user', async ({
    http,
    reader,
    newReader,
    dataSource,
    recorder,
  }) => {
    const other = await newReader();
    const [mine] = await photosOf(http, reader, 1);
    const [theirs] = await photosOf(http, other, 1);

    const response = await reader.publish({ text: 'Ahoj', photoIds: [mine?.id, theirs?.id] });

    expect(response.status).toBe(404);
    expect(response.body).toStrictEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: `No media with id ${theirs?.id ?? ''} was found.`,
      instance: POSTS_ROUTE,
      code: 'media_not_found',
    });
    expect(await storedPosts(dataSource)).toEqual([]);
    expect(recorder.all()).toEqual([]);
  });

  test('answers 404 media_not_found for an unknown photo', async ({ reader, dataSource }) => {
    const response = await reader.publish({ photoIds: [randomUUID()] });

    expect(response.status).toBe(404);
    expect((response.body as ProblemDetails).code).toBe('media_not_found');
    expect(await storedPosts(dataSource)).toEqual([]);
  });

  test('shows the photos to another user through working signed URLs', async ({
    http,
    reader,
    newReader,
  }) => {
    const photos = await photosOf(http, reader, 2);
    const post = await reader.post({ text: 'Pozrite', photoIds: photos.map(({ id }) => id) });
    const other = await newReader();

    const seen = await other.find(post.id);
    const [inFeed] = (await other.page(COMMUNITY_ROUTE)).items;
    const files = await Promise.all(
      seen.photos.map(({ variants }) => fetchFile(http, pathOf(variants.medium.url))),
    );

    expect(seen.photos).toStrictEqual(photos.map(expectedPhoto));
    expect(inFeed?.photos).toStrictEqual(photos.map(expectedPhoto));
    expect(files.map(({ status }) => status)).toEqual([200, 200]);
    expect(files.map(({ headers }) => headers['content-type'])).toEqual([
      'image/webp',
      'image/webp',
    ]);
  });

  test('leaves a deleted photo out of the post', async ({ http, reader, newReader }) => {
    const [first, second, third] = await photosOf(http, reader, 3);
    const post = await reader.post({
      text: 'Tri fotky',
      photoIds: [first?.id, second?.id, third?.id],
    });

    const deleted = await http
      .delete(`/v1/media/${second?.id ?? ''}`)
      .set('Authorization', reader.authorization);
    const other = await newReader();

    expect(deleted.status).toBe(204);
    expect(mediaIdsOf(await reader.find(post.id))).toEqual([first?.id, third?.id]);
    expect(mediaIdsOf(await other.find(post.id))).toEqual([first?.id, third?.id]);
  });

  test('shows a photo-only post whose photos were all deleted with empty text and photos', async ({
    http,
    reader,
  }) => {
    const [photo] = await photosOf(http, reader, 1);
    const post = await reader.post({ photoIds: [photo?.id] });

    await http.delete(`/v1/media/${photo?.id ?? ''}`).set('Authorization', reader.authorization);

    expect(await reader.find(post.id)).toMatchObject({ text: '', photos: [] });
  });

  test('deletes the photo links with the post and keeps the photos', async ({
    http,
    reader,
    dataSource,
  }) => {
    const [photo] = await photosOf(http, reader, 1);
    const post = await reader.post({ text: 'Ahoj', photoIds: [photo?.id] });

    const deleted = await reader.delete(post.id);
    const media = await http
      .get(`/v1/media/${photo?.id ?? ''}`)
      .set('Authorization', reader.authorization);

    expect(deleted.status).toBe(204);
    expect(await storedPhotos(dataSource, post.id)).toEqual([]);
    expect(media.status).toBe(200);
  });

  test('answers a page of 50 posts with 200 photos with one more query than a page of 1', async ({
    reader,
    factories,
    dataSource,
  }) => {
    const mediaIds = await arrangeMedia(factories, reader.id, 204);
    await arrangePosts(
      factories,
      dataSource,
      Array.from({ length: 51 }, (_, index) => ({
        authorId: reader.id,
        photoIds: mediaIds.slice(index * 4, index * 4 + 4),
        createdAt: hoursAgo(index + 1),
      })),
    );
    const queries = vi.spyOn(dataSource.logger, 'logQuery');
    const countQueries = async (limit: number): Promise<number> => {
      queries.mockClear();
      const page = await reader.page(`${COMMUNITY_ROUTE}?limit=${String(limit)}`);
      expect(page.items).toHaveLength(limit);
      expect(page.items.flatMap(mediaIdsOf)).toEqual(mediaIds.slice(0, limit * 4));

      return queries.mock.calls.length;
    };

    const one = await countQueries(1);
    const fifty = await countQueries(50);
    queries.mockRestore();

    expect(fifty).toBe(one + 1);
  });
});

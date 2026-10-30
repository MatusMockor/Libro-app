import type { DataSource } from 'typeorm';
import { describe, expect, onTestFinished } from 'vitest';
import { FACTORY_USER_PASSWORD } from '../../../src/modules/auth/factories/user.factory.js';
import { userTables } from '../../support/truncate-tables.js';
import type { PostResponse } from '../../../src/modules/feed/http/post.response.js';
import {
  encourages,
  engagesWith,
  filesOf,
  follows,
  needlesOf,
  storedFiles,
  tablesMentioning,
  test,
} from './account-deletion.fixture.js';

const TABLES_WITHOUT_USER_DATA: Readonly<Record<string, string>> = {
  'auth.deleted_accounts': 'the tombstone itself, kept on purpose for 30 days (only the user id)',
  'auth.sign_in_nonces': 'single-use nonces without a link to any user',
  'books.authors': 'catalogue, no user data',
  'books.editions': 'catalogue, no user data',
  'books.work_authors': 'catalogue, no user data',
  'books.works': 'catalogue, no user data',
  'media.pending_file_deletions':
    'transient queue of files still to delete; the scan after the deletion still covers it',
  'public.migrations': 'migration bookkeeping',
};

async function tablesWithoutDataOf(
  dataSource: DataSource,
  needles: readonly string[],
): Promise<string[]> {
  const mentioning = new Set(await tablesMentioning(dataSource, needles));

  return (await userTables(dataSource, [])).filter(
    (table) => !(table in TABLES_WITHOUT_USER_DATA) && !mentioning.has(table),
  );
}

describe('account deletion leaves no trace', () => {
  test('arranges data of the user in every table that can hold user data', async ({
    http,
    dataSource,
    arrangeAccount,
  }) => {
    const ann = await arrangeAccount();
    const ben = await arrangeAccount();
    await follows(http, ann, ben);
    await follows(http, ben, ann);
    await engagesWith(http, ann, ben);
    await engagesWith(http, ben, ann);
    await encourages(http, ann, ben);
    await encourages(http, ben, ann);

    const withoutArrangedData = await tablesWithoutDataOf(dataSource, needlesOf(ann));

    expect(
      withoutArrangedData,
      `These tables hold no data of the arranged account. Arrange data for them in account-deletion.fixture.ts (and delete it in a UserDeleted handler), or list them in TABLES_WITHOUT_USER_DATA with the reason: ${withoutArrangedData.join(', ')}`,
    ).toEqual([]);
  });

  test('names a new table that holds no arranged data and is not excluded', async ({
    http,
    dataSource,
    arrangeAccount,
  }) => {
    const ann = await arrangeAccount();
    const ben = await arrangeAccount();
    await follows(http, ann, ben);
    await engagesWith(http, ann, ben);
    await encourages(http, ann, ben);
    await dataSource.query('CREATE TABLE public.probe_posts (author_id uuid NOT NULL)');
    onTestFinished(async () => {
      await dataSource.query('DROP TABLE public.probe_posts');
    });

    expect(await tablesWithoutDataOf(dataSource, needlesOf(ann))).toEqual(['public.probe_posts']);
  });

  test('keeps the exclusion list to tables that exist', async ({ dataSource }) => {
    const tables = await userTables(dataSource, []);

    expect(
      Object.keys(TABLES_WITHOUT_USER_DATA).filter((table) => !tables.includes(table)),
    ).toEqual([]);
  });

  test('finds the user id, email and owned ids in no table and no media file afterwards', async ({
    http,
    dataSource,
    mediaRoot,
    arrangeAccount,
    deleteAccount,
  }) => {
    const ann = await arrangeAccount();
    const ben = await arrangeAccount();
    await follows(http, ann, ben);
    await follows(http, ben, ann);
    await engagesWith(http, ann, ben);
    await engagesWith(http, ben, ann);
    await encourages(http, ann, ben);
    await encourages(http, ben, ann);

    const response = await deleteAccount(ann, { password: FACTORY_USER_PASSWORD });
    const bensPosts = await Promise.all(
      ben.postIds.map((postId) =>
        http.get(`/v1/posts/${postId}`).set('Authorization', ben.authorization),
      ),
    );

    expect(response.status).toBe(204);
    expect(await tablesMentioning(dataSource, needlesOf(ann))).toEqual([]);
    expect(bensPosts.map(({ status }) => status)).toEqual([200]);
    expect(bensPosts.map(({ body }) => body as PostResponse)).toMatchObject([
      { authorId: ben.id, likeCount: 0, reactions: [] },
    ]);
    expect(filesOf(await storedFiles(mediaRoot), ann.mediaIds)).toEqual([]);
    expect(filesOf(await storedFiles(mediaRoot), ben.mediaIds)).toHaveLength(3);
  });

  test('finds ids in upper case and without hyphens too', async ({ dataSource, signIn }) => {
    const ann = await signIn();
    await dataSource.query('INSERT INTO auth.deleted_accounts (user_id) VALUES ($1)', [ann.id]);
    await dataSource.query(
      'INSERT INTO media.pending_file_deletions (storage_key) VALUES ($1), ($2)',
      [`${ann.id.toUpperCase()}/small.webp`, `${ann.id.replaceAll('-', '')}/medium.webp`],
    );

    expect(await tablesMentioning(dataSource, [ann.id])).toEqual([
      'auth.sessions',
      'auth.users',
      'media.pending_file_deletions',
    ]);
  });
});

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUniqueViolation } from '../../../database/unique-violation.js';
import { HandleTakenException } from '../application/handle-taken.exception.js';
import type { ProfileCreation, ProfileRepository } from '../application/profile-repository.js';
import type { ProfileChanges, StoredProfile } from '../domain/profile.js';
import { PROFILES_HANDLE_KEY, ProfileEntity } from './profile.entity.js';

const SELECT_EXISTS = `
  SELECT EXISTS (SELECT 1 FROM profiles.profiles WHERE user_id = $1) AS "exists"
`;

const INSERT_PROFILE = `
  INSERT INTO profiles.profiles (user_id, handle)
  VALUES ($1, $2)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING user_id
`;

const SELECT_PROFILE = `
  SELECT profile.user_id AS "userId",
         profile.handle,
         profile.display_name AS "displayName",
         profile.bio,
         profile.favourite_genres AS "favouriteGenres",
         profile.avatar_media_id AS "avatarMediaId",
         coalesce(
           (SELECT array_agg(top_book.work_id::text ORDER BY top_book.position)
            FROM profiles.top_books AS top_book
            WHERE top_book.user_id = profile.user_id),
           '{}'
         ) AS "topBookIds",
         (SELECT count(*)::int FROM profiles.follows WHERE followee_id = profile.user_id)
           AS "followerCount",
         (SELECT count(*)::int FROM profiles.follows WHERE follower_id = profile.user_id)
           AS "followingCount",
         EXISTS (
           SELECT 1 FROM profiles.follows WHERE follower_id = $1 AND followee_id = profile.user_id
         ) AS "followedByMe"
  FROM profiles.profiles AS profile
`;

const SELECT_PROFILE_BY_ID = `${SELECT_PROFILE} WHERE profile.user_id = $2`;

const SELECT_PROFILE_BY_HANDLE = `${SELECT_PROFILE} WHERE profile.handle = $2`;

const UPDATE_PROFILE = `
  UPDATE profiles.profiles
  SET handle = CASE WHEN $2::boolean THEN $3::text ELSE handle END,
      display_name = CASE WHEN $4::boolean THEN $5::text ELSE display_name END,
      bio = CASE WHEN $6::boolean THEN $7::text ELSE bio END,
      favourite_genres = CASE WHEN $8::boolean THEN $9::text[] ELSE favourite_genres END,
      avatar_media_id = CASE WHEN $10::boolean THEN $11::uuid ELSE avatar_media_id END,
      updated_at = now()
  WHERE user_id = $1
`;

const DELETE_TOP_BOOKS = `
  DELETE FROM profiles.top_books WHERE user_id = $1
`;

const INSERT_TOP_BOOKS = `
  INSERT INTO profiles.top_books (user_id, position, work_id)
  SELECT $1::uuid, book.position, book.work_id
  FROM unnest($2::uuid[]) WITH ORDINALITY AS book (work_id, position)
`;

const DELETE_PROFILE = `
  DELETE FROM profiles.profiles WHERE user_id = $1
`;

@Injectable()
export class TypeOrmProfileRepository implements ProfileRepository {
  constructor(
    @InjectRepository(ProfileEntity) private readonly profiles: Repository<ProfileEntity>,
  ) {}

  async exists(userId: string): Promise<boolean> {
    const [row] = await this.profiles.query<[{ exists: boolean }]>(SELECT_EXISTS, [userId]);

    return row.exists;
  }

  async create(userId: string, handle: string): Promise<ProfileCreation> {
    try {
      const created = await this.profiles.query<unknown[]>(INSERT_PROFILE, [userId, handle]);

      return created.length > 0 ? 'created' : 'exists';
    } catch (error) {
      if (isUniqueViolation(error, PROFILES_HANDLE_KEY)) {
        return 'handle_taken';
      }

      throw error;
    }
  }

  async findById(viewerId: string, userId: string): Promise<StoredProfile | undefined> {
    const [profile] = await this.profiles.query<StoredProfile[]>(SELECT_PROFILE_BY_ID, [
      viewerId,
      userId,
    ]);

    return profile;
  }

  async findByHandle(viewerId: string, handle: string): Promise<StoredProfile | undefined> {
    const [profile] = await this.profiles.query<StoredProfile[]>(SELECT_PROFILE_BY_HANDLE, [
      viewerId,
      handle,
    ]);

    return profile;
  }

  async update(userId: string, changes: ProfileChanges): Promise<void> {
    try {
      await this.profiles.manager.transaction(async (manager) => {
        await manager.query(UPDATE_PROFILE, [userId, ...columnChanges(changes)]);
        if (changes.topBookIds === undefined) {
          return;
        }

        await manager.query(DELETE_TOP_BOOKS, [userId]);
        await manager.query(INSERT_TOP_BOOKS, [userId, changes.topBookIds]);
      });
    } catch (error) {
      if (isUniqueViolation(error, PROFILES_HANDLE_KEY)) {
        throw new HandleTakenException();
      }

      throw error;
    }
  }

  async delete(userId: string): Promise<void> {
    await this.profiles.query(DELETE_PROFILE, [userId]);
  }
}

function columnChanges({
  handle,
  displayName,
  bio,
  favouriteGenres,
  avatarMediaId,
}: ProfileChanges): unknown[] {
  return [handle, displayName, bio, favouriteGenres, avatarMediaId].flatMap((value) => [
    value !== undefined,
    value ?? null,
  ]);
}

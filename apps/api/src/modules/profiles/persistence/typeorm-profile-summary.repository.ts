import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ProfileSummaryRepository } from '../application/profile-summary-repository.js';
import type { ProfileSearchQuery, StoredProfileSummary } from '../domain/profile.js';
import type { PageQuery } from '../domain/profile-page.js';
import { ProfileEntity } from './profile.entity.js';

const MAX_SEARCH_TOKENS = 5;

const SUMMARY_COLUMNS = `
  profile.user_id AS "userId",
  profile.handle,
  profile.display_name AS "displayName",
  profile.avatar_media_id AS "avatarMediaId",
  profile.official,
  EXISTS (
    SELECT 1 FROM profiles.follows AS mine
    WHERE mine.follower_id = $1 AND mine.followee_id = profile.user_id
  ) AS "followedByMe"
`;

const SEARCH_PROFILES = String.raw`
  WITH query AS (
    SELECT btrim(regexp_replace(profiles.search_normalise($2), '(^|\s)@+', '\1', 'g')) AS text
  ),
  distinct_tokens AS (
    SELECT token
    FROM query,
      regexp_split_to_table(query.text, '\s+') WITH ORDINALITY AS split (token, position)
    WHERE token <> ''
    GROUP BY token
    ORDER BY min(position)
    LIMIT $5
  ),
  tokens AS (
    SELECT
      token,
      '%' || replace(replace(replace(token, '\', '\\'), '%', '\%'), '_', '\_') || '%' AS pattern
    FROM distinct_tokens
  ),
  token_matches AS (
    SELECT tokens.token, profile.user_id
    FROM tokens
    JOIN profiles.profiles AS profile
      ON profiles.search_normalise(profile.handle) LIKE tokens.pattern
    UNION
    SELECT tokens.token, profile.user_id
    FROM tokens
    JOIN profiles.profiles AS profile
      ON profiles.search_normalise(profile.display_name) LIKE tokens.pattern
  ),
  found AS (
    SELECT user_id
    FROM token_matches
    GROUP BY user_id
    HAVING count(*) = (SELECT count(*) FROM tokens)
  )
  SELECT ${SUMMARY_COLUMNS}
  FROM found
  JOIN profiles.profiles AS profile ON profile.user_id = found.user_id
  CROSS JOIN query
  ORDER BY
    greatest(
      word_similarity(query.text, profiles.search_normalise(profile.handle)),
      word_similarity(query.text, profiles.search_normalise(profile.display_name))
    ) DESC,
    profile.handle,
    profile.user_id
  LIMIT $3 OFFSET $4
`;

const SELECT_FOLLOWERS = `
  SELECT ${SUMMARY_COLUMNS}
  FROM profiles.follows AS follow
  JOIN profiles.profiles AS profile ON profile.user_id = follow.follower_id
  WHERE follow.followee_id = $2
  ORDER BY follow.created_at DESC, follow.follower_id
  LIMIT $3 OFFSET $4
`;

const SELECT_FOLLOWING = `
  SELECT ${SUMMARY_COLUMNS}
  FROM profiles.follows AS follow
  JOIN profiles.profiles AS profile ON profile.user_id = follow.followee_id
  WHERE follow.follower_id = $2
  ORDER BY follow.created_at DESC, follow.followee_id
  LIMIT $3 OFFSET $4
`;

const SELECT_BY_USER_IDS = `
  SELECT ${SUMMARY_COLUMNS}
  FROM profiles.profiles AS profile
  WHERE profile.user_id = ANY ($2::uuid[])
`;

@Injectable()
export class TypeOrmProfileSummaryRepository implements ProfileSummaryRepository {
  constructor(
    @InjectRepository(ProfileEntity) private readonly profiles: Repository<ProfileEntity>,
  ) {}

  search(
    viewerId: string,
    { text, limit, offset }: ProfileSearchQuery,
  ): Promise<StoredProfileSummary[]> {
    return this.profiles.query<StoredProfileSummary[]>(SEARCH_PROFILES, [
      viewerId,
      text,
      limit,
      offset,
      MAX_SEARCH_TOKENS,
    ]);
  }

  followersOf(
    viewerId: string,
    userId: string,
    { limit, offset }: PageQuery,
  ): Promise<StoredProfileSummary[]> {
    return this.profiles.query<StoredProfileSummary[]>(SELECT_FOLLOWERS, [
      viewerId,
      userId,
      limit,
      offset,
    ]);
  }

  followingOf(
    viewerId: string,
    userId: string,
    { limit, offset }: PageQuery,
  ): Promise<StoredProfileSummary[]> {
    return this.profiles.query<StoredProfileSummary[]>(SELECT_FOLLOWING, [
      viewerId,
      userId,
      limit,
      offset,
    ]);
  }

  findByUserIds(viewerId: string, userIds: readonly string[]): Promise<StoredProfileSummary[]> {
    return this.profiles.query<StoredProfileSummary[]>(SELECT_BY_USER_IDS, [viewerId, userIds]);
  }
}

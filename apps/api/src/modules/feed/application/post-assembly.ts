import { toMediaPhoto, type MediaWithUrls } from '../../media/index.js';
import type { Post, StoredPost } from '../domain/post.js';
import { inReactionOrder } from '../domain/reactions.js';
import type { FeedReferences, ReferenceIds } from './feed-references.service.js';

export function postReferenceIds(stored: readonly StoredPost[]): ReferenceIds {
  return {
    profileIds: stored.map(({ authorId }) => authorId),
    workIds: stored
      .map(({ workId }) => workId)
      .filter((workId): workId is string => workId !== null),
    mediaIds: stored.flatMap(({ photoIds }) => photoIds),
  };
}

export function assemblePost(
  { workId, photoIds, reactions, ...post }: StoredPost,
  references: FeedReferences,
): Post {
  return {
    ...post,
    reactions: inReactionOrder(reactions),
    author: references.profiles.get(post.authorId) ?? null,
    book: workId === null ? null : (references.works.get(workId) ?? null),
    photos: photoIds
      .map((mediaId) => references.photos.get(mediaId))
      .filter((media): media is MediaWithUrls => media !== undefined)
      .map(toMediaPhoto),
  };
}

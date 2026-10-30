import { setSeederFactory, type FactoryCallback } from 'typeorm-extension';
import { POST_ACTIVITY } from '../domain/activity.js';
import { ActivityEntity } from '../persistence/activity.entity.js';
import { PostPhotoEntity } from '../persistence/post-photo.entity.js';
import { PostEntity } from '../persistence/post.entity.js';

export interface PostFactoryMeta {
  id?: string;
  authorId?: string;
  text?: string | null;
  workId?: string | null;
  place?: string | null;
  photoIds?: readonly string[];
  createdAt?: Date;
}

const FIRST_SERIAL = 1;

const SYNTHETIC_ID_DIGITS = 12;

export function createPostFactory(): FactoryCallback<PostEntity, PostFactoryMeta> {
  let serial = FIRST_SERIAL;

  return (meta) => samplePost(serial++, meta ?? {});
}

export default setSeederFactory(PostEntity, createPostFactory());

function samplePost(serial: number, { photoIds = [], ...meta }: PostFactoryMeta): PostEntity {
  const authorId = meta.authorId ?? syntheticId(serial);

  return Object.assign(new PostEntity(), {
    text: `Sample post ${String(serial)}`,
    workId: null,
    place: null,
    ...meta,
    authorId,
    photos: photoIds.map((mediaId, index) =>
      Object.assign(new PostPhotoEntity(), { position: index + 1, mediaId }),
    ),
    activities: [
      Object.assign(new ActivityEntity(), {
        actorId: authorId,
        kind: POST_ACTIVITY,
        ...(meta.createdAt === undefined ? {} : { createdAt: meta.createdAt }),
      }),
    ],
  });
}

function syntheticId(serial: number): string {
  return `00000000-0000-4000-8101-${String(serial).padStart(SYNTHETIC_ID_DIGITS, '0')}`;
}

import type { DataSource } from 'typeorm';
import { SeederFactoryManager } from 'typeorm-extension';
import { createIdentityFactory } from '../../src/modules/auth/factories/identity.factory.js';
import { createUserFactory } from '../../src/modules/auth/factories/user.factory.js';
import { IdentityEntity } from '../../src/modules/auth/persistence/identity.entity.js';
import { UserEntity } from '../../src/modules/auth/persistence/user.entity.js';
import { createWorkFactory } from '../../src/modules/books/factories/work.factory.js';
import { WorkEntity } from '../../src/modules/books/persistence/work.entity.js';
import { createLikeFactory } from '../../src/modules/feed/factories/like.factory.js';
import { createPostFactory } from '../../src/modules/feed/factories/post.factory.js';
import { createReactionFactory } from '../../src/modules/feed/factories/reaction.factory.js';
import { LikeEntity } from '../../src/modules/feed/persistence/like.entity.js';
import { PostEntity } from '../../src/modules/feed/persistence/post.entity.js';
import { ReactionEntity } from '../../src/modules/feed/persistence/reaction.entity.js';
import { createMediaFileFactory } from '../../src/modules/media/factories/media-file.factory.js';
import { MediaFileEntity } from '../../src/modules/media/persistence/media-file.entity.js';
import { createFollowFactory } from '../../src/modules/profiles/factories/follow.factory.js';
import { createProfileFactory } from '../../src/modules/profiles/factories/profile.factory.js';
import { FollowEntity } from '../../src/modules/profiles/persistence/follow.entity.js';
import { ProfileEntity } from '../../src/modules/profiles/persistence/profile.entity.js';
import { createReadingSessionFactory } from '../../src/modules/reading-sessions/factories/reading-session.factory.js';
import { createReadingFactory } from '../../src/modules/reading-sessions/factories/reading.factory.js';
import { createSessionParticipantFactory } from '../../src/modules/reading-sessions/factories/session-participant.factory.js';
import { ReadingSessionEntity } from '../../src/modules/reading-sessions/persistence/reading-session.entity.js';
import { ReadingEntity } from '../../src/modules/reading-sessions/persistence/reading.entity.js';
import { SessionParticipantEntity } from '../../src/modules/reading-sessions/persistence/session-participant.entity.js';
import { createReviewFactory } from '../../src/modules/reviews/factories/review.factory.js';
import { ReviewEntity } from '../../src/modules/reviews/persistence/review.entity.js';

export function seederFactories(dataSource: DataSource): SeederFactoryManager {
  const factories = new SeederFactoryManager({ dataSource });
  factories.set(WorkEntity, createWorkFactory());
  factories.set(UserEntity, createUserFactory());
  factories.set(IdentityEntity, createIdentityFactory());
  factories.set(ReadingEntity, createReadingFactory());
  factories.set(ReadingSessionEntity, createReadingSessionFactory());
  factories.set(SessionParticipantEntity, createSessionParticipantFactory());
  factories.set(MediaFileEntity, createMediaFileFactory());
  factories.set(ProfileEntity, createProfileFactory());
  factories.set(FollowEntity, createFollowFactory());
  factories.set(PostEntity, createPostFactory());
  factories.set(LikeEntity, createLikeFactory());
  factories.set(ReactionEntity, createReactionFactory());
  factories.set(ReviewEntity, createReviewFactory());

  return factories;
}

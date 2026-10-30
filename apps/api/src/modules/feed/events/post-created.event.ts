import { defineDomainEvent, type DomainEventOf } from '../../../events/domain-event.js';

export interface PostCreatedPayload {
  readonly postId: string;
  readonly authorId: string;
}

export const PostCreated = defineDomainEvent<PostCreatedPayload>('PostCreated', 1);
export type PostCreated = DomainEventOf<typeof PostCreated>;

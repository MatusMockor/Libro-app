import { setSeederFactory, type FactoryCallback } from 'typeorm-extension';
import type { ReactionKey } from '../domain/reactions.js';
import { ReactionEntity } from '../persistence/reaction.entity.js';

export interface ReactionFactoryMeta {
  postId?: string;
  userId?: string;
  reaction?: ReactionKey;
  createdAt?: Date;
}

const FIRST_SERIAL = 1;

const SYNTHETIC_ID_DIGITS = 12;

export function createReactionFactory(): FactoryCallback<ReactionEntity, ReactionFactoryMeta> {
  let serial = FIRST_SERIAL;

  return (meta) => {
    const current = serial++;

    return Object.assign(new ReactionEntity(), {
      postId: syntheticId('8104', current),
      userId: syntheticId('8105', current),
      reaction: 'heart',
      ...meta,
    });
  };
}

export default setSeederFactory(ReactionEntity, createReactionFactory());

function syntheticId(group: string, serial: number): string {
  return `00000000-0000-4000-${group}-${String(serial).padStart(SYNTHETIC_ID_DIGITS, '0')}`;
}

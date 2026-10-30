import type { ProfileSummary } from '../../profiles/index.js';

export const ENCOURAGEMENT_KINDS = ['insight', 'congratulation'] as const;

export type EncouragementKind = (typeof ENCOURAGEMENT_KINDS)[number];

export interface StoredEncouragement {
  readonly decorationId: string;
  readonly kind: EncouragementKind;
  readonly insightId: string | null;
  readonly authorId: string;
  readonly text: string | null;
  readonly createdAt: Date;
  readonly cursorAt: string;
}

export interface Encouragement extends Omit<StoredEncouragement, 'cursorAt'> {
  readonly author: ProfileSummary | null;
}

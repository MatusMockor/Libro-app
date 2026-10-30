import type { ProfileSummary } from '../../profiles/index.js';

export const INSIGHT_TEXT_MAX_LENGTH = 300;

export const MAX_INSIGHTS_PER_AUTHOR_AND_READING = 3;

export interface NewInsight {
  readonly readingId: string;
  readonly readerId: string;
  readonly authorId: string;
  readonly text: string;
}

export interface StoredInsight extends NewInsight {
  readonly id: string;
  readonly createdAt: Date;
}

export interface Insight extends StoredInsight {
  readonly decorationId: string;
  readonly author: ProfileSummary | null;
}

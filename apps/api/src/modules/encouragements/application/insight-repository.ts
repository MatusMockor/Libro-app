import type { NewInsight, StoredInsight } from '../domain/insight.js';

export const INSIGHT_REPOSITORY = Symbol('INSIGHT_REPOSITORY');

export interface InsightLimit {
  readonly perAuthorAndReading: number;
}

export type AddInsightOutcome =
  { readonly kind: 'added'; readonly insight: StoredInsight } | { readonly kind: 'limit_reached' };

export interface InsightRepository {
  add(insight: NewInsight, limit: InsightLimit): Promise<AddInsightOutcome>;
  deleteManagedBy(userId: string, insightId: string): Promise<boolean>;
}

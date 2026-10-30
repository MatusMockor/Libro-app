export const REVIEW_PAGE_MAX_LIMIT = 50;

export const REVIEW_PAGE_DEFAULT_LIMIT = 20;

export interface ReviewCursor {
  readonly createdAt: string;
  readonly readingId: string;
}

export interface ReviewPageQuery {
  readonly limit: number;
  readonly after: ReviewCursor | null;
}

export interface ReviewPage<TItem> {
  readonly items: readonly TItem[];
  readonly nextCursor: ReviewCursor | null;
}

export interface Positioned {
  readonly readingId: string;
  readonly cursorAt: string;
}

export const EMPTY_REVIEW_PAGE: ReviewPage<never> = { items: [], nextCursor: null };

export function lookahead(query: ReviewPageQuery): ReviewPageQuery {
  return { ...query, limit: query.limit + 1 };
}

export function pageOf<TItem extends Positioned>(
  found: readonly TItem[],
  { limit }: ReviewPageQuery,
): ReviewPage<TItem> {
  const items = found.slice(0, limit);
  const last = items.at(-1);
  if (found.length <= limit || !last) {
    return { items, nextCursor: null };
  }

  return { items, nextCursor: { createdAt: last.cursorAt, readingId: last.readingId } };
}

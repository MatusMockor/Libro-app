export const FEED_PAGE_MAX_LIMIT = 50;

export const FEED_PAGE_DEFAULT_LIMIT = 20;

export interface FeedCursor {
  readonly createdAt: string;
  readonly id: string;
}

export interface FeedPageQuery {
  readonly limit: number;
  readonly after: FeedCursor | null;
}

export interface FeedPage<TItem> {
  readonly items: readonly TItem[];
  readonly nextCursor: FeedCursor | null;
}

export interface Positioned {
  readonly id: string;
  readonly cursorAt: string;
}

export function lookahead(query: FeedPageQuery): FeedPageQuery {
  return { ...query, limit: query.limit + 1 };
}

export function pageOf<TItem extends Positioned>(
  found: readonly TItem[],
  { limit }: FeedPageQuery,
): FeedPage<TItem> {
  const items = found.slice(0, limit);
  const last = items.at(-1);
  if (found.length <= limit || !last) {
    return { items, nextCursor: null };
  }

  return { items, nextCursor: { createdAt: last.cursorAt, id: last.id } };
}

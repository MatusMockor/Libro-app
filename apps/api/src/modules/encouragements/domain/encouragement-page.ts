export const ENCOURAGEMENT_PAGE_MAX_LIMIT = 50;

export const ENCOURAGEMENT_PAGE_DEFAULT_LIMIT = 20;

export interface EncouragementCursor {
  readonly createdAt: string;
  readonly decorationId: string;
}

export interface EncouragementPageQuery {
  readonly limit: number;
  readonly after: EncouragementCursor | null;
}

export interface EncouragementPage<TItem> {
  readonly items: readonly TItem[];
  readonly nextCursor: EncouragementCursor | null;
}

export interface EncouragementListQuery extends EncouragementPageQuery {
  readonly readingId: string;
  readonly authorId: string | null;
}

export interface Positioned {
  readonly decorationId: string;
  readonly cursorAt: string;
}

export function lookahead(query: EncouragementPageQuery): EncouragementPageQuery {
  return { ...query, limit: query.limit + 1 };
}

export function pageOf<TItem extends Positioned>(
  found: readonly TItem[],
  { limit }: EncouragementPageQuery,
): EncouragementPage<TItem> {
  const items = found.slice(0, limit);
  const last = items.at(-1);
  if (found.length <= limit || !last) {
    return { items, nextCursor: null };
  }

  return { items, nextCursor: { createdAt: last.cursorAt, decorationId: last.decorationId } };
}

export const PROFILE_PAGE_MAX_OFFSET = 1000;

export interface PageQuery {
  readonly limit: number;
  readonly offset: number;
}

export interface Page<TItem> {
  readonly items: readonly TItem[];
  readonly nextOffset: number | null;
}

export function lookahead({ limit, offset }: PageQuery): PageQuery {
  return { limit: limit + 1, offset };
}

export function pageOf<TItem>(found: readonly TItem[], { limit, offset }: PageQuery): Page<TItem> {
  const nextOffset = offset + limit;
  const hasNextPage = found.length > limit && nextOffset <= PROFILE_PAGE_MAX_OFFSET;

  return { items: found.slice(0, limit), nextOffset: hasNextPage ? nextOffset : null };
}

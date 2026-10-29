export const POST_LIMIT = { posts: 30, windowSeconds: 24 * 60 * 60 } as const;

export type PostLimit = typeof POST_LIMIT;

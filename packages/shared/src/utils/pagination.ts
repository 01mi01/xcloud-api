export interface PageParams {
  cursor?: string;
  limit: number;
}

/** Parse cursor/limit query params with sane bounds. */
export const parsePagination = (
  query: { cursor?: unknown; limit?: unknown },
  defaultLimit = 20,
  maxLimit = 100,
): PageParams => {
  const parsed = parseInt(String(query.limit ?? defaultLimit), 10);
  const limit = Math.min(Math.max(Number.isNaN(parsed) ? defaultLimit : parsed, 1), maxLimit);
  const cursor =
    typeof query.cursor === 'string' && query.cursor.length > 0 ? query.cursor : undefined;
  return { cursor, limit };
};

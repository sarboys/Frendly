const SEARCH_QUERY_MAX_LENGTH = 64;

export function normalizeSearchQuery(value?: string) {
  const query = value?.trim();
  if (!query) {
    return null;
  }

  return query.slice(0, SEARCH_QUERY_MAX_LENGTH);
}

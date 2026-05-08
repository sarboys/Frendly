export function normalizeDuplicateSlashesInPath(rawUrl: string | undefined) {
  if (!rawUrl || !rawUrl.includes('//')) {
    return rawUrl;
  }

  const queryStart = rawUrl.indexOf('?');
  const path = queryStart === -1 ? rawUrl : rawUrl.slice(0, queryStart);
  const query = queryStart === -1 ? '' : rawUrl.slice(queryStart);
  const normalizedPath = path.replace(/\/{2,}/g, '/');

  return normalizedPath === path ? rawUrl : `${normalizedPath}${query}`;
}

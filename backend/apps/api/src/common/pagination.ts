import { decodeCursor, encodeCursor } from '@big-break/database';

export function paginateArray<T>(
  items: T[],
  limit = 20,
  getValue: (item: T) => string,
  cursor?: string,
) {
  const decoded = decodeCursor(cursor);
  const startIndex = decoded
    ? Math.max(
        items.findIndex((item) => getValue(item) === decoded.value) + 1,
        0,
      )
    : 0;

  const sliced = items.slice(startIndex, startIndex + limit);
  const nextItem = items[startIndex + limit];

  return {
    items: sliced,
    nextCursor: nextItem && sliced.length > 0 ? encodeCursor({ value: getValue(sliced[sliced.length - 1]!) }) : null,
  };
}

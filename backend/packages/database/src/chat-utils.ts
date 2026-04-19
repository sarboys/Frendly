export function buildDirectChatKey(leftUserId: string, rightUserId: string): string {
  return [leftUserId, rightUserId].sort((a, b) => a.localeCompare(b)).join(':');
}

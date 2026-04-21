export function buildDirectChatKey(leftUserId: string, rightUserId: string): string {
  return [leftUserId, rightUserId].sort((a, b) => a.localeCompare(b)).join(':');
}

export function buildMessagePreview(input: {
  text: string;
  attachments?: Array<{ kind: string }>;
}): string {
  const normalized = input.text.trim();
  if (normalized.startsWith('__bb_location__:')) {
    return 'Локация';
  }
  if (normalized.length > 0) {
    return normalized;
  }

  const attachments = input.attachments ?? [];
  if (attachments.some((item) => item.kind === 'chat_voice')) {
    return 'Голосовое сообщение';
  }

  if (attachments.length > 0) {
    return 'Вложение';
  }

  return '';
}

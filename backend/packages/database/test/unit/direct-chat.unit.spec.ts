import { buildDirectChatKey } from '../../src/chat-utils';

describe('buildDirectChatKey', () => {
  it('returns same key regardless of user order', () => {
    expect(buildDirectChatKey('user-a', 'user-b')).toBe(buildDirectChatKey('user-b', 'user-a'));
  });
});

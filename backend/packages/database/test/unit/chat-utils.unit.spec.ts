import { buildMessagePreview } from '../../src/chat-utils';

describe('buildMessagePreview', () => {
  it('returns location label for encoded location payload', () => {
    expect(
      buildMessagePreview({
        text: '__bb_location__:{"latitude":55.7,"longitude":37.6}',
      }),
    ).toBe('Локация');
  });
});

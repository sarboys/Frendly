import { OUTBOX_EVENT_TYPES } from '@big-break/database';

describe('worker outbox constants', () => {
  it('keeps media finalize event name stable', () => {
    expect(OUTBOX_EVENT_TYPES.mediaFinalize).toBe('media.finalize');
  });
});

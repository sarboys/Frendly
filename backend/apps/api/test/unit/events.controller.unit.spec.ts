import { EventsController } from '../../src/controllers/events.controller';

describe('EventsController unit', () => {
  it('passes city query to event listing service', () => {
    const listEvents = jest.fn().mockReturnValue({ items: [], nextCursor: null });
    const controller = new EventsController({ listEvents } as any);

    controller.listEvents(
      { userId: 'user-me' },
      'nearby',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'Санкт-Петербург',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );

    expect(listEvents).toHaveBeenCalledWith(
      'user-me',
      expect.objectContaining({
        city: 'Санкт-Петербург',
      }),
    );
  });
});

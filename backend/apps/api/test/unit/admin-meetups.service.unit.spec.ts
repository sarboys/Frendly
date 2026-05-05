import { AdminMeetupsService } from '../../src/services/admin-meetups.service';

const now = new Date('2026-05-05T10:00:00.000Z');
const future = new Date('2099-05-05T10:00:00.000Z');
const past = new Date('2000-05-05T10:00:00.000Z');

function createService(client: Record<string, unknown>) {
  return new AdminMeetupsService({ client } as any);
}

function listEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    title: 'Wine meetup',
    emoji: '🍷',
    place: 'Roof',
    startsAt: future,
    hostId: 'host-1',
    partnerId: null,
    partnerName: null,
    joinMode: 'open',
    priceMode: 'free',
    capacity: 10,
    canceledAt: null,
    host: {
      id: 'host-1',
      displayName: 'Анна',
      profile: { city: 'Москва' },
    },
    partner: null,
    liveState: null,
    _count: {
      participants: 1,
      joinRequests: 0,
    },
    ...overrides,
  };
}

function detailEvent(overrides: Record<string, unknown> = {}) {
  return {
    ...listEvent(),
    durationMinutes: 120,
    distanceKm: 0,
    latitude: null,
    longitude: null,
    vibe: 'Warm',
    tone: 'warm',
    lifestyle: 'neutral',
    priceAmountFrom: null,
    priceAmountTo: null,
    accessMode: 'open',
    genderMode: 'all',
    visibilityMode: 'public',
    hostNote: null,
    description: 'Meetup description',
    partnerOffer: null,
    isAfterDark: false,
    afterDarkCategory: null,
    afterDarkGlow: null,
    dressCode: null,
    ageRange: null,
    ratioLabel: null,
    consentRequired: false,
    rules: null,
    cancelReason: null,
    sourcePoster: null,
    sourceExternalContentItem: null,
    chat: { id: 'chat-1' },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('AdminMeetupsService unit', () => {
  it('derives list statuses', async () => {
    const service = createService({
      event: {
        findMany: jest.fn().mockResolvedValue([
          listEvent({ id: 'upcoming', startsAt: future }),
          listEvent({ id: 'live', startsAt: past, liveState: { status: 'live' } }),
          listEvent({ id: 'past', startsAt: past }),
          listEvent({ id: 'cancelled', canceledAt: now }),
        ]),
      },
    });

    const result = await service.listMeetups();

    expect(result.items.map((item) => item.status)).toEqual([
      'upcoming',
      'live',
      'past',
      'cancelled',
    ]);
  });

  it('creates chat and host participant when creating a meetup', async () => {
    const tx = {
      event: {
        create: jest.fn().mockResolvedValue({ id: 'event-1' }),
      },
      chat: {
        create: jest.fn().mockResolvedValue({ id: 'chat-1' }),
      },
      eventParticipant: { create: jest.fn().mockResolvedValue({}) },
      eventAttendance: { create: jest.fn().mockResolvedValue({}) },
      eventLiveState: { create: jest.fn().mockResolvedValue({}) },
      chatMember: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = createService({
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'host-1' }) },
      event: { findUnique: jest.fn().mockResolvedValue(detailEvent()) },
      $transaction: jest.fn((callback) => callback(tx)),
    });

    await service.createMeetup({
      hostId: 'host-1',
      title: 'Wine meetup',
      startsAt: future.toISOString(),
      place: 'Roof',
      description: 'Meetup description',
    });

    expect(tx.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          hostId: 'host-1',
          title: 'Wine meetup',
        }),
      }),
    );
    expect(tx.chat.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId: 'event-1',
        }),
      }),
    );
    expect(tx.eventParticipant.create).toHaveBeenCalledWith({
      data: {
        eventId: 'event-1',
        userId: 'host-1',
      },
    });
    expect(tx.chatMember.create).toHaveBeenCalledWith({
      data: {
        chatId: 'chat-1',
        userId: 'host-1',
      },
    });
  });

  it('rejects invalid capacity during update', async () => {
    const update = jest.fn();
    const service = createService({
      event: {
        findUnique: jest.fn().mockResolvedValue({ id: 'event-1' }),
        update,
      },
    });

    await expect(service.updateMeetup('event-1', { capacity: 1 })).rejects.toMatchObject({
      statusCode: 400,
      code: 'admin_meetup_capacity_invalid',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('cancels and restores meetup state', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'event-1' });
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({ id: 'event-1' })
      .mockResolvedValueOnce(
        detailEvent({
          canceledAt: now,
          cancelReason: 'rain',
        }),
      )
      .mockResolvedValueOnce({ id: 'event-1' })
      .mockResolvedValueOnce(detailEvent());
    const service = createService({
      event: { findUnique, update },
    });

    const cancelled = await service.cancelMeetup('event-1', { reason: ' rain ' });
    const restored = await service.restoreMeetup('event-1');

    expect(update).toHaveBeenNthCalledWith(1, {
      where: { id: 'event-1' },
      data: {
        canceledAt: expect.any(Date),
        cancelReason: 'rain',
      },
    });
    expect(update).toHaveBeenNthCalledWith(2, {
      where: { id: 'event-1' },
      data: {
        canceledAt: null,
        cancelReason: null,
      },
    });
    expect(cancelled.status).toBe('cancelled');
    expect(restored.status).toBe('upcoming');
  });

  it('does not remove host participant', async () => {
    const tx = jest.fn();
    const service = createService({
      event: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'event-1',
          hostId: 'host-1',
          chat: { id: 'chat-1' },
        }),
      },
      eventParticipant: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'participant-1',
          userId: 'host-1',
        }),
      },
      $transaction: tx,
    });

    await expect(
      service.removeParticipant('event-1', 'participant-1'),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'admin_meetup_host_remove_forbidden',
    });
    expect(tx).not.toHaveBeenCalled();
  });

  it('approves join request with participant and chat member upserts', async () => {
    const tx = {
      eventJoinRequest: { update: jest.fn().mockResolvedValue({}) },
      eventParticipant: { upsert: jest.fn().mockResolvedValue({}) },
      chatMember: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const service = createService({
      event: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'event-1',
          hostId: 'host-1',
          chat: { id: 'chat-1' },
        }),
      },
      eventJoinRequest: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'request-1',
          userId: 'guest-1',
        }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    });

    await service.reviewJoinRequest('event-1', 'request-1', 'approved');

    expect(tx.eventJoinRequest.update).toHaveBeenCalledWith({
      where: { id: 'request-1' },
      data: {
        status: 'approved',
        reviewedAt: expect.any(Date),
        reviewedById: 'host-1',
      },
    });
    expect(tx.eventParticipant.upsert).toHaveBeenCalledWith({
      where: {
        eventId_userId: {
          eventId: 'event-1',
          userId: 'guest-1',
        },
      },
      update: {},
      create: {
        eventId: 'event-1',
        userId: 'guest-1',
      },
    });
    expect(tx.chatMember.upsert).toHaveBeenCalledWith({
      where: {
        chatId_userId: {
          chatId: 'chat-1',
          userId: 'guest-1',
        },
      },
      update: {},
      create: {
        chatId: 'chat-1',
        userId: 'guest-1',
      },
    });
  });
});

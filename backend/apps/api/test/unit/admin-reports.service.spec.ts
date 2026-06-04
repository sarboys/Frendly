import { AdminReportsService } from '../../src/services/admin-reports.service';

describe('AdminReportsService', () => {
  it('lists event reports with reporter, host and meeting target', async () => {
    const createdAt = new Date('2026-06-01T10:00:00.000Z');
    const updatedAt = new Date('2026-06-01T11:00:00.000Z');
    const startsAt = new Date('2026-06-05T19:00:00.000Z');
    const userReport = {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'report-1',
          reason: 'spam',
          details: 'bad meetup',
          status: 'open',
          blockRequested: false,
          targetEventId: 'event-1',
          createdAt,
          updatedAt,
          reporter: {
            id: 'user-1',
            displayName: 'Анна',
            email: 'anna@example.com',
            phoneNumber: null,
            profile: { city: 'Москва', avatarUrl: null },
          },
          targetUser: {
            id: 'host-1',
            displayName: 'Олег',
            email: null,
            phoneNumber: '+70000000000',
            profile: { city: 'Москва', avatarUrl: 'https://cdn/avatar.png' },
          },
          targetEvent: {
            id: 'event-1',
            title: 'Винный вечер',
            city: 'Москва',
            place: 'Roof',
            startsAt,
          },
        },
      ]),
    };
    const service = new AdminReportsService({ client: { userReport } } as never);

    const result = await service.listReports({ targetType: 'event', status: 'open', limit: '10' });

    expect(userReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { status: 'open' },
            { targetEventId: { not: null } },
          ]),
        }),
      }),
    );
    expect(result).toEqual({
      items: [
        {
          id: 'report-1',
          targetType: 'event',
          reason: 'spam',
          details: 'bad meetup',
          status: 'open',
          blockRequested: false,
          createdAt: createdAt.toISOString(),
          updatedAt: updatedAt.toISOString(),
          reporter: {
            id: 'user-1',
            displayName: 'Анна',
            email: 'anna@example.com',
            phoneNumber: null,
            city: 'Москва',
            avatarUrl: null,
          },
          targetUser: {
            id: 'host-1',
            displayName: 'Олег',
            email: null,
            phoneNumber: '+70000000000',
            city: 'Москва',
            avatarUrl: 'https://cdn/avatar.png',
          },
          targetEvent: {
            id: 'event-1',
            title: 'Винный вечер',
            city: 'Москва',
            place: 'Roof',
            startsAt: startsAt.toISOString(),
          },
        },
      ],
      nextCursor: null,
    });
  });

  it('updates report status', async () => {
    const updatedAt = new Date('2026-06-01T12:00:00.000Z');
    const userReport = {
      update: jest.fn().mockResolvedValue({
        id: 'report-1',
        reason: 'spam',
        details: null,
        status: 'resolved',
        blockRequested: false,
        targetEventId: null,
        createdAt: new Date('2026-06-01T10:00:00.000Z'),
        updatedAt,
        reporter: {
          id: 'user-1',
          displayName: 'Анна',
          email: null,
          phoneNumber: null,
          profile: null,
        },
        targetUser: {
          id: 'user-2',
          displayName: 'Олег',
          email: null,
          phoneNumber: null,
          profile: null,
        },
        targetEvent: null,
      }),
    };
    const service = new AdminReportsService({ client: { userReport } } as never);

    const result = await service.updateReport('report-1', { status: 'resolved' });

    expect(userReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'report-1' },
        data: { status: 'resolved' },
      }),
    );
    expect(result.status).toBe('resolved');
    expect(result.targetType).toBe('user');
    expect(result.updatedAt).toBe(updatedAt.toISOString());
  });
});

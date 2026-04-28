import { SafetyService } from '../../src/services/safety.service';

describe('SafetyService unit', () => {
  it('loads only trust score fields for safety summary user data', async () => {
    const userFindUnique = jest.fn().mockResolvedValue({
      profile: {
        meetupCount: 3,
      },
      verification: {
        status: 'verified',
      },
    });
    const service = new SafetyService({
      client: {
        user: {
          findUnique: userFindUnique,
        },
        userSettings: {
          findUnique: jest.fn().mockResolvedValue({
            autoSharePlans: true,
            hideExactLocation: false,
          }),
        },
        trustedContact: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'contact-1',
            },
          ]),
        },
        userBlock: {
          count: jest.fn().mockResolvedValue(2),
        },
        userReport: {
          count: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0),
        },
      },
    } as any);

    await expect(service.getSafety('user-me')).resolves.toMatchObject({
      trustScore: 80,
      blockedUsersCount: 2,
      reportsCount: 1,
    });
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: 'user-me' },
      select: {
        profile: {
          select: {
            meetupCount: true,
          },
        },
        verification: {
          select: {
            status: true,
          },
        },
      },
    });
  });

  it('rechecks active duplicate reports inside the write transaction', async () => {
    const reportCreate = jest.fn().mockResolvedValue({
      id: 'report-created',
      status: 'open',
      blockRequested: false,
    });
    const txExecuteRaw = jest.fn().mockResolvedValue(1);
    const service = new SafetyService({
      client: {
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: 'user-target' }),
        },
        userReport: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        $transaction: jest.fn((callback: any) =>
          callback({
            $executeRaw: txExecuteRaw,
            userReport: {
              findFirst: jest.fn().mockResolvedValue({ id: 'report-existing' }),
              create: reportCreate,
            },
            userBlock: {
              upsert: jest.fn(),
            },
          }),
        ),
      },
    } as any);

    await expect(
      service.createReport('user-me', {
        targetUserId: 'user-target',
        reason: 'spam',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'duplicate_report',
    });

    expect(txExecuteRaw).toHaveBeenCalledTimes(1);
    expect(reportCreate).not.toHaveBeenCalled();
  });

  it('starts active report lookup while report target is still loading', async () => {
    let resolveTarget!: (value: { id: string }) => void;
    const targetFindUnique = jest.fn(
      () =>
        new Promise<{ id: string }>((resolve) => {
          resolveTarget = resolve;
        }),
    );
    const reportFindFirst = jest.fn().mockResolvedValue({
      id: 'report-existing',
    });
    const service = new SafetyService({
      client: {
        user: {
          findUnique: targetFindUnique,
        },
        userReport: {
          findFirst: reportFindFirst,
        },
        $transaction: jest.fn(),
      },
    } as any);

    const resultPromise = service.createReport('user-me', {
      targetUserId: 'user-target',
      reason: 'spam',
    });

    await new Promise((resolve) => setImmediate(resolve));

    expect(targetFindUnique).toHaveBeenCalledTimes(1);
    expect(reportFindFirst).toHaveBeenCalledWith({
      where: {
        reporterId: 'user-me',
        targetUserId: 'user-target',
        status: {
          in: ['open', 'in_review'],
        },
      },
      select: { id: true },
    });

    resolveTarget({ id: 'user-target' });

    await expect(resultPromise).rejects.toMatchObject({
      statusCode: 409,
      code: 'duplicate_report',
    });
  });

  it('maps trusted contact unique conflicts to duplicate errors', async () => {
    const create = jest.fn().mockRejectedValue({
      code: 'P2002',
      meta: { target: ['userId', 'phoneNumber'] },
    });
    const service = new SafetyService({
      client: {
        trustedContact: {
          findFirst: jest.fn().mockResolvedValue(null),
          create,
        },
      },
    } as any);

    await expect(
      service.createTrustedContact('user-me', {
        name: 'Аня',
        phoneNumber: '+79990001122',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'trusted_contact_duplicate',
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        userId: 'user-me',
        name: 'Аня',
        channel: 'phone',
        value: '+79990001122',
        phoneNumber: '+79990001122',
        mode: 'all_plans',
      },
    });
  });

  it('creates trusted contacts with delivery channel and value', async () => {
    const created = {
      id: 'contact-telegram',
      userId: 'user-me',
      name: 'Алина',
      channel: 'telegram',
      value: '@alina_k',
      phoneNumber: '@alina_k',
      mode: 'sos_only',
    };
    const create = jest.fn().mockResolvedValue(created);
    const service = new SafetyService({
      client: {
        trustedContact: {
          findFirst: jest.fn().mockResolvedValue(null),
          create,
        },
      },
    } as any);

    await expect(
      service.createTrustedContact('user-me', {
        name: 'Алина',
        channel: 'telegram',
        value: '@alina_k',
        mode: 'sos_only',
      }),
    ).resolves.toBe(created);

    expect(create).toHaveBeenCalledWith({
      data: {
        userId: 'user-me',
        name: 'Алина',
        channel: 'telegram',
        value: '@alina_k',
        phoneNumber: '@alina_k',
        mode: 'sos_only',
      },
    });
  });

  it('deletes only contacts owned by the current user', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = new SafetyService({
      client: {
        trustedContact: {
          deleteMany,
        },
      },
    } as any);

    await expect(
      service.deleteTrustedContact('user-me', 'contact-1'),
    ).resolves.toEqual({ id: 'contact-1', deleted: true });

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'contact-1',
        userId: 'user-me',
      },
    });
  });

  it('lists reports without loading unused target user data', async () => {
    const createdAt = new Date('2026-04-28T12:00:00.000Z');
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'report-1',
        targetUserId: 'user-target',
        reason: 'spam',
        details: 'bad invite',
        status: 'open',
        blockRequested: true,
        createdAt,
      },
    ]);
    const service = new SafetyService({
      client: {
        userReport: {
          findMany,
        },
      },
    } as any);

    await expect(service.listReports('user-me')).resolves.toEqual([
      {
        id: 'report-1',
        targetUserId: 'user-target',
        reason: 'spam',
        details: 'bad invite',
        status: 'open',
        blockRequested: true,
        createdAt: createdAt.toISOString(),
      },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: { reporterId: 'user-me' },
      select: {
        id: true,
        targetUserId: true,
        reason: true,
        details: true,
        status: true,
        blockRequested: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('lists blocks with only response fields and blocked user preview', async () => {
    const createdAt = new Date('2026-04-28T12:00:00.000Z');
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'block-1',
        blockedUserId: 'user-blocked',
        blockedUser: {
          id: 'user-blocked',
          displayName: 'Спамер',
        },
        createdAt,
      },
    ]);
    const service = new SafetyService({
      client: {
        userBlock: {
          findMany,
        },
      },
    } as any);

    await expect(service.listBlocks('user-me')).resolves.toEqual([
      {
        id: 'block-1',
        blockedUserId: 'user-blocked',
        blockedUser: {
          id: 'user-blocked',
          displayName: 'Спамер',
        },
        createdAt: createdAt.toISOString(),
      },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: 'user-me' },
      select: {
        id: true,
        blockedUserId: true,
        createdAt: true,
        blockedUser: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('persists sos alert and queues delivery payloads for trusted contacts', async () => {
    const now = new Date('2026-04-28T12:00:00.000Z');
    const contacts = [
      {
        id: 'contact-phone',
        name: 'Мама',
        channel: 'phone',
        value: '+79990001122',
        phoneNumber: '+79990001122',
        mode: 'all_plans',
      },
      {
        id: 'contact-telegram',
        name: 'Алина',
        channel: 'telegram',
        value: '@alina_k',
        phoneNumber: '@alina_k',
        mode: 'sos_only',
      },
    ];
    const sosAlertCreate = jest.fn().mockResolvedValue({
      id: 'sos-1',
      userId: 'user-me',
      eventId: 'event-1',
      recipientsCount: 2,
      recipients: contacts,
      messagePreview: 'SOS от Катя. Нужна помощь.',
      status: 'queued',
      createdAt: now,
    });
    const outboxCreateMany = jest.fn().mockResolvedValue({ count: 2 });
    const service = new SafetyService({
      client: {
        event: {
          findUnique: jest.fn().mockResolvedValue({ id: 'event-1' }),
        },
        eventParticipant: {
          findUnique: jest.fn().mockResolvedValue({ eventId: 'event-1', userId: 'user-me' }),
        },
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-me',
            displayName: 'Катя',
            phoneNumber: '+79990000000',
          }),
        },
        trustedContact: {
          findMany: jest.fn().mockResolvedValue(contacts),
        },
        $transaction: jest.fn((callback: any) =>
          callback({
            safetySosAlert: {
              create: sosAlertCreate,
            },
            outboxEvent: {
              createMany: outboxCreateMany,
            },
          }),
        ),
      },
    } as any);

    await expect(
      service.createSos('user-me', { eventId: 'event-1' }),
    ).resolves.toEqual({
      id: 'sos-1',
      eventId: 'event-1',
      notifiedContactsCount: 2,
      status: 'queued',
      createdAt: now.toISOString(),
    });

    expect(sosAlertCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-me',
        eventId: 'event-1',
        recipientsCount: 2,
        status: 'queued',
      }),
    });
    expect(outboxCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          type: 'safety.sos_delivery',
          payload: expect.objectContaining({
            sosAlertId: 'sos-1',
            contactId: 'contact-phone',
            channel: 'phone',
            value: '+79990001122',
          }),
        }),
      ]),
    });
  });

  it('starts event participation lookup while SOS event is still loading', async () => {
    let resolveEvent!: (value: { id: string; title: string }) => void;
    const eventFindUnique = jest.fn(
      () =>
        new Promise<{ id: string; title: string }>((resolve) => {
          resolveEvent = resolve;
        }),
    );
    const participantFindUnique = jest.fn().mockResolvedValue({
      eventId: 'event-1',
      userId: 'user-me',
    });
    const sosAlertCreate = jest.fn().mockResolvedValue({
      id: 'sos-1',
      userId: 'user-me',
      eventId: 'event-1',
      recipientsCount: 1,
      status: 'queued',
      createdAt: new Date('2026-04-28T12:00:00.000Z'),
    });
    const service = new SafetyService({
      client: {
        event: {
          findUnique: eventFindUnique,
        },
        eventParticipant: {
          findUnique: participantFindUnique,
        },
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-me',
            displayName: 'Катя',
            phoneNumber: '+79990000000',
          }),
        },
        trustedContact: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'contact-phone',
              name: 'Мама',
              channel: 'phone',
              value: '+79990001122',
              phoneNumber: '+79990001122',
              mode: 'all_plans',
            },
          ]),
        },
        $transaction: jest.fn((callback: any) =>
          callback({
            safetySosAlert: {
              create: sosAlertCreate,
            },
            outboxEvent: {
              createMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
          }),
        ),
      },
    } as any);

    const resultPromise = service.createSos('user-me', { eventId: 'event-1' });

    await new Promise((resolve) => setImmediate(resolve));

    expect(eventFindUnique).toHaveBeenCalledTimes(1);
    expect(participantFindUnique).toHaveBeenCalledWith({
      where: {
        eventId_userId: {
          eventId: 'event-1',
          userId: 'user-me',
        },
      },
      select: {
        eventId: true,
        userId: true,
      },
    });

    resolveEvent({ id: 'event-1', title: 'Кофе' });

    await expect(resultPromise).resolves.toMatchObject({
      id: 'sos-1',
      eventId: 'event-1',
      notifiedContactsCount: 1,
    });
  });
});

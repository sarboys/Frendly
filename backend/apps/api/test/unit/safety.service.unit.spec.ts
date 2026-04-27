import { SafetyService } from '../../src/services/safety.service';

describe('SafetyService unit', () => {
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
        phoneNumber: '+79990001122',
        mode: 'all_plans',
      },
    });
  });
});

import { VerificationService } from '../../src/services/verification.service';

describe('VerificationService unit', () => {
  const verificationRow = {
    status: 'selfie_submitted',
    selfieDone: true,
    documentDone: false,
    reviewedAt: null,
    submittedAt: null,
    reviewNote: null,
  };

  const select = {
    status: true,
    selfieDone: true,
    documentDone: true,
    reviewedAt: true,
    submittedAt: true,
    reviewNote: true,
  };

  it('loads only response fields for current verification', async () => {
    const findUnique = jest.fn().mockResolvedValue(verificationRow);
    const service = new VerificationService({
      client: {
        userVerification: {
          findUnique,
        },
      },
    } as any);

    await expect(service.getVerification('user-me')).resolves.toEqual({
      status: 'selfie_submitted',
      selfieDone: true,
      documentDone: false,
      reviewedAt: null,
      submittedAt: null,
      reviewNote: null,
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-me' },
      select,
    });
  });

  it('uses narrow reads and writes when submitting verification', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      status: 'not_started',
      selfieDone: false,
      documentDone: false,
      reviewedAt: null,
    });
    const upsert = jest.fn().mockResolvedValue(verificationRow);
    const service = new VerificationService({
      client: {
        userVerification: {
          findUnique,
          upsert,
        },
        mediaAsset: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'asset-selfie',
          }),
        },
      },
    } as any);

    await expect(
      service.submitVerification('user-me', {
        step: 'selfie',
        assetId: 'asset-selfie',
      }),
    ).resolves.toEqual({
      status: 'selfie_submitted',
      selfieDone: true,
      documentDone: false,
      reviewedAt: null,
      submittedAt: null,
      reviewNote: null,
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-me' },
      select: {
        ...select,
        selfieAssetId: true,
        documentAssetId: true,
      },
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-me' },
        update: expect.objectContaining({
          selfieAssetId: 'asset-selfie',
        }),
        select,
      }),
    );
  });

  it('rejects document submit before selfie', async () => {
    const service = new VerificationService({
      client: {
        userVerification: {
          findUnique: jest.fn().mockResolvedValue({
            status: 'not_started',
            selfieDone: false,
            documentDone: false,
            reviewedAt: null,
            submittedAt: null,
            reviewNote: null,
          }),
        },
        mediaAsset: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'asset-document',
            ownerId: 'user-me',
            kind: 'verification_document',
            status: 'ready',
          }),
        },
      },
    } as any);

    await expect(
      service.submitVerification('user-me', {
        step: 'document',
        assetId: 'asset-document',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'verification_selfie_required',
    });
  });

  it('approves verification once and grants a three day trial', async () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-05-20T10:00:00.000Z').getTime());
    const currentVerification = {
      status: 'under_review',
      selfieDone: true,
      documentDone: true,
      selfieAssetId: 'asset-selfie',
      documentAssetId: 'asset-document',
      reviewedAt: null,
      submittedAt: new Date('2026-05-20T09:00:00.000Z'),
      reviewNote: null,
      selfieAsset: {
        id: 'asset-selfie',
        kind: 'verification_selfie',
        objectKey: 'verification/user-me/selfie/a.jpg',
        bucket: 'bucket',
      },
      documentAsset: {
        id: 'asset-document',
        kind: 'verification_document',
        objectKey: 'verification/user-me/document/b.pdf',
        bucket: 'bucket',
      },
    };
    const tx: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-me',
          verified: false,
        }),
        update: jest.fn(),
      },
      userVerification: {
        findUnique: jest.fn().mockResolvedValue(currentVerification),
        upsert: jest.fn(),
      },
      userSubscription: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      notification: {
        create: jest.fn().mockResolvedValue({ id: 'notification-1' }),
      },
      outboxEvent: {
        createMany: jest.fn(),
      },
    };
    const prismaClient: any = {
      $transaction: jest.fn((callback) => callback(tx)),
      mediaAsset: {
        deleteMany: jest.fn(),
      },
    };
    const service = new VerificationService({ client: prismaClient } as any);
    service.getVerification = jest.fn().mockResolvedValue({
      status: 'verified',
      selfieDone: true,
      documentDone: true,
      reviewedAt: '2026-05-20T10:00:00.000Z',
      submittedAt: '2026-05-20T09:00:00.000Z',
      reviewNote: null,
    });

    await service.approveVerification('user-me');

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-me' },
      data: { verified: true },
    });
    expect(tx.userSubscription.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-me',
        plan: 'month',
        status: 'trial',
        startedAt: new Date('2026-05-20T10:00:00.000Z'),
        renewsAt: new Date('2026-05-23T10:00:00.000Z'),
        trialEndsAt: new Date('2026-05-23T10:00:00.000Z'),
      },
    });
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: 'verification',
          dedupeKey: 'verification:approved:user-me',
        }),
      }),
    );
    expect(tx.outboxEvent.createMany).toHaveBeenCalled();
  });

  it('does not grant another trial when already verified', async () => {
    const tx: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-me',
          verified: true,
        }),
      },
      userVerification: {
        findUnique: jest.fn().mockResolvedValue({
          status: 'verified',
          selfieDone: true,
          documentDone: true,
          selfieAssetId: null,
          documentAssetId: null,
          reviewedAt: new Date('2026-05-20T10:00:00.000Z'),
          submittedAt: new Date('2026-05-20T09:00:00.000Z'),
          reviewNote: null,
          selfieAsset: null,
          documentAsset: null,
        }),
      },
      userSubscription: {
        create: jest.fn(),
        update: jest.fn(),
      },
      notification: {
        create: jest.fn(),
      },
    };
    const prismaClient: any = {
      $transaction: jest.fn((callback) => callback(tx)),
      mediaAsset: {
        deleteMany: jest.fn(),
      },
    };
    const service = new VerificationService({ client: prismaClient } as any);
    service.getVerification = jest.fn().mockResolvedValue({
      status: 'verified',
      selfieDone: true,
      documentDone: true,
      reviewedAt: '2026-05-20T10:00:00.000Z',
      submittedAt: '2026-05-20T09:00:00.000Z',
      reviewNote: null,
    });

    await service.approveVerification('user-me');

    expect(tx.userSubscription.create).not.toHaveBeenCalled();
    expect(tx.userSubscription.update).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it('returns verification to the initial state with a reason', async () => {
    const tx: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-me',
          verified: false,
        }),
        update: jest.fn(),
      },
      userVerification: {
        findUnique: jest.fn().mockResolvedValue({
          status: 'under_review',
          selfieDone: true,
          documentDone: true,
          selfieAssetId: 'asset-selfie',
          documentAssetId: 'asset-document',
          reviewedAt: null,
          submittedAt: new Date('2026-05-20T09:00:00.000Z'),
          reviewNote: null,
          selfieAsset: {
            id: 'asset-selfie',
            kind: 'verification_selfie',
            objectKey: 'verification/user-me/selfie/a.jpg',
            bucket: 'bucket',
          },
          documentAsset: {
            id: 'asset-document',
            kind: 'verification_document',
            objectKey: 'verification/user-me/document/b.pdf',
            bucket: 'bucket',
          },
        }),
        update: jest.fn(),
      },
      notification: {
        create: jest.fn().mockResolvedValue({ id: 'notification-2' }),
      },
      outboxEvent: {
        createMany: jest.fn(),
      },
    };
    const prismaClient: any = {
      $transaction: jest.fn((callback) => callback(tx)),
      mediaAsset: {
        deleteMany: jest.fn(),
      },
    };
    const service = new VerificationService({ client: prismaClient } as any);
    service.getVerification = jest.fn().mockResolvedValue({
      status: 'not_started',
      selfieDone: false,
      documentDone: false,
      reviewedAt: '2026-05-20T10:00:00.000Z',
      submittedAt: null,
      reviewNote: 'Документ размытый',
    });

    await service.returnVerification('user-me', {
      reason: ' Документ размытый ',
    });

    expect(tx.userVerification.update).toHaveBeenCalledWith({
      where: { userId: 'user-me' },
      data: expect.objectContaining({
        status: 'not_started',
        selfieDone: false,
        documentDone: false,
        selfieAssetId: null,
        documentAssetId: null,
        submittedAt: null,
        reviewNote: 'Документ размытый',
      }),
    });
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: 'verification',
          body: 'Документ размытый',
        }),
      }),
    );
    expect(prismaClient.mediaAsset.deleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['asset-selfie', 'asset-document'] },
        ownerId: 'user-me',
        kind: { in: ['verification_selfie', 'verification_document'] },
      },
    });
  });
});

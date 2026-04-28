import { VerificationService } from '../../src/services/verification.service';

describe('VerificationService unit', () => {
  const verificationRow = {
    status: 'selfie_submitted',
    selfieDone: true,
    documentDone: false,
    reviewedAt: null,
  };

  const select = {
    status: true,
    selfieDone: true,
    documentDone: true,
    reviewedAt: true,
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
      },
    } as any);

    await expect(
      service.submitVerification('user-me', {
        step: 'selfie',
      }),
    ).resolves.toEqual({
      status: 'selfie_submitted',
      selfieDone: true,
      documentDone: false,
      reviewedAt: null,
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-me' },
      select,
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-me' },
        select,
      }),
    );
  });
});

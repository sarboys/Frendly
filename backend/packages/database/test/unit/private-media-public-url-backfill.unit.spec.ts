import {
  backfillPrivateMediaPublicUrls,
  verifyPrivateMediaPublicUrls,
} from '../../src/private-media-public-url-backfill';

describe('backfillPrivateMediaPublicUrls', () => {
  it('clears public URLs only for private media assets in cursor batches', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'asset-1' }, { id: 'asset-2' }])
      .mockResolvedValueOnce([{ id: 'asset-3' }])
      .mockResolvedValueOnce([]);
    const updateMany = jest
      .fn()
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 1 });

    const report = await backfillPrivateMediaPublicUrls(
      {
        mediaAsset: {
          findMany,
          updateMany,
        },
      } as any,
      {
        batchSize: 2,
      },
    );

    expect(report).toEqual({
      batchCount: 2,
      processedCount: 3,
      updatedCount: 3,
    });
    expect(findMany).toHaveBeenNthCalledWith(1, {
      where: {
        kind: {
          in: [
            'chat_attachment',
            'chat_voice',
            'story_media',
            'verification_selfie',
            'verification_document',
          ],
        },
        publicUrl: {
          not: null,
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        id: 'asc',
      },
      take: 2,
    });
    expect(findMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: {
          gt: 'asset-2',
        },
        kind: {
          in: [
            'chat_attachment',
            'chat_voice',
            'story_media',
            'verification_selfie',
            'verification_document',
          ],
        },
        publicUrl: {
          not: null,
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        id: 'asc',
      },
      take: 2,
    });
    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: {
          in: ['asset-1', 'asset-2'],
        },
      },
      data: {
        publicUrl: null,
      },
    });
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: {
          in: ['asset-3'],
        },
      },
      data: {
        publicUrl: null,
      },
    });
  });
});

describe('verifyPrivateMediaPublicUrls', () => {
  it('counts private media assets that still expose public URLs', async () => {
    const count = jest.fn().mockResolvedValue(7);

    await expect(
      verifyPrivateMediaPublicUrls({
        mediaAsset: {
          count,
        },
      } as any),
    ).resolves.toEqual({
      stalePublicUrlCount: 7,
      ok: false,
    });

    expect(count).toHaveBeenCalledWith({
      where: {
        kind: {
          in: [
            'chat_attachment',
            'chat_voice',
            'story_media',
            'verification_selfie',
            'verification_document',
          ],
        },
        publicUrl: {
          not: null,
        },
      },
    });
  });

  it('reports ok when no private media public URLs remain', async () => {
    const count = jest.fn().mockResolvedValue(0);

    await expect(
      verifyPrivateMediaPublicUrls({
        mediaAsset: {
          count,
        },
      } as any),
    ).resolves.toEqual({
      stalePublicUrlCount: 0,
      ok: true,
    });
  });
});

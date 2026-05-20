export const PRIVATE_MEDIA_ASSET_KINDS = [
  'chat_attachment',
  'chat_voice',
  'story_media',
  'verification_selfie',
  'verification_document',
] as const;

export type PrivateMediaPublicUrlBackfillReport = {
  batchCount: number;
  processedCount: number;
  updatedCount: number;
};

export type PrivateMediaPublicUrlVerificationReport = {
  stalePublicUrlCount: number;
  ok: boolean;
};

type PrivateMediaPublicUrlBackfillClient = {
  mediaAsset: {
    findMany(args: {
      where: Record<string, unknown>;
      select: { id: true };
      orderBy: { id: 'asc' };
      take: number;
    }): Promise<Array<{ id: string }>>;
    updateMany(args: {
      where: { id: { in: string[] } };
      data: { publicUrl: null };
    }): Promise<{ count: number }>;
  };
};

type PrivateMediaPublicUrlVerificationClient = {
  mediaAsset: {
    count(args: { where: Record<string, unknown> }): Promise<number>;
  };
};

const DEFAULT_BATCH_SIZE = 500;
const MAX_BATCH_SIZE = 5_000;

export async function backfillPrivateMediaPublicUrls(
  client: PrivateMediaPublicUrlBackfillClient,
  options: {
    batchSize?: number;
    onProgress?: (event: {
      batchCount: number;
      processedCount: number;
      cursor: string;
      updatedCount: number;
    }) => void;
  } = {},
): Promise<PrivateMediaPublicUrlBackfillReport> {
  const batchSize = normalizePrivateMediaPublicUrlBackfillBatchSize(
    options.batchSize,
  );
  let cursor: string | undefined;
  let batchCount = 0;
  let processedCount = 0;
  let updatedCount = 0;

  for (;;) {
    const assets = await client.mediaAsset.findMany({
      where: {
        ...privateMediaWithPublicUrlWhere(),
        ...(cursor == null
          ? {}
          : {
              id: {
                gt: cursor,
              },
            }),
      },
      select: {
        id: true,
      },
      orderBy: {
        id: 'asc',
      },
      take: batchSize,
    });

    if (assets.length === 0) {
      break;
    }

    const assetIds = assets.map((asset) => asset.id);
    const updated = await client.mediaAsset.updateMany({
      where: {
        id: {
          in: assetIds,
        },
      },
      data: {
        publicUrl: null,
      },
    });

    batchCount += 1;
    processedCount += assets.length;
    updatedCount += updated.count;
    cursor = assets[assets.length - 1]!.id;
    options.onProgress?.({
      batchCount,
      processedCount,
      cursor,
      updatedCount,
    });
  }

  return {
    batchCount,
    processedCount,
    updatedCount,
  };
}

export function normalizePrivateMediaPublicUrlBackfillBatchSize(raw?: number) {
  if (raw == null || !Number.isFinite(raw)) {
    return DEFAULT_BATCH_SIZE;
  }

  return Math.max(1, Math.min(Math.trunc(raw), MAX_BATCH_SIZE));
}

export async function verifyPrivateMediaPublicUrls(
  client: PrivateMediaPublicUrlVerificationClient,
): Promise<PrivateMediaPublicUrlVerificationReport> {
  const stalePublicUrlCount = await client.mediaAsset.count({
    where: privateMediaWithPublicUrlWhere(),
  });

  return {
    stalePublicUrlCount,
    ok: stalePublicUrlCount === 0,
  };
}

function privateMediaWithPublicUrlWhere() {
  return {
    kind: {
      in: [...PRIVATE_MEDIA_ASSET_KINDS],
    },
    publicUrl: {
      not: null,
    },
  };
}

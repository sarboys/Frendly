import { buildMediaProxyPath } from '@big-break/database';
import { MediaAsset } from '@prisma/client';

type PresentableMediaAsset = Pick<
  MediaAsset,
  | 'id'
  | 'kind'
  | 'status'
  | 'mimeType'
  | 'byteSize'
  | 'durationMs'
  | 'originalFileName'
  | 'publicUrl'
  | 'waveform'
>;

export function resolveMediaVisibility(
  asset: Pick<PresentableMediaAsset, 'kind'>,
): 'public' | 'private' {
  return asset.kind === 'avatar' ? 'public' : 'private';
}

export function buildMediaCacheKey(assetId: string): string {
  return `media-${assetId}`;
}

export function mapMediaResource(
  asset: Pick<
    PresentableMediaAsset,
    'id' | 'kind' | 'mimeType' | 'byteSize' | 'durationMs' | 'publicUrl'
  >,
  options?: {
    visibility?: 'public' | 'private';
    url?: string | null;
    downloadUrl?: string | null;
    expiresAt?: Date | null;
  },
) {
  const visibility = options?.visibility ?? resolveMediaVisibility(asset);
  const url =
    options?.url ??
    (visibility === 'public'
      ? asset.publicUrl ?? buildMediaProxyPath(asset.id)
      : buildMediaProxyPath(asset.id));
  const downloadUrl =
    options?.downloadUrl ??
    (visibility === 'public' ? url : null);

  return {
    id: asset.id,
    kind: asset.kind,
    visibility,
    mimeType: asset.mimeType,
    byteSize: asset.byteSize,
    url,
    downloadUrl,
    downloadUrlPath:
      visibility === 'private'
        ? `${buildMediaProxyPath(asset.id)}/download-url`
        : null,
    variants: {},
    durationMs: asset.durationMs ?? null,
    previewHash: null,
    cacheKey: buildMediaCacheKey(asset.id),
    expiresAt: options?.expiresAt?.toISOString() ?? null,
  };
}

export function mapMediaAsset(
  asset: PresentableMediaAsset,
  options?: Parameters<typeof mapMediaResource>[1],
) {
  return {
    ...mapMediaResource(asset, options),
    status: asset.status,
    fileName: asset.originalFileName,
    waveform: asset.waveform ?? [],
  };
}

export function mapProfilePhoto(
  photo: {
    id: string;
    sortOrder: number;
    mediaAsset: Pick<
      PresentableMediaAsset,
      | 'id'
      | 'kind'
      | 'mimeType'
      | 'byteSize'
      | 'durationMs'
      | 'publicUrl'
    >;
  },
) {
  const media = mapMediaResource(photo.mediaAsset, {
    visibility: 'public',
    url: photo.mediaAsset.publicUrl ?? buildMediaProxyPath(photo.mediaAsset.id),
    downloadUrl:
      photo.mediaAsset.publicUrl ?? buildMediaProxyPath(photo.mediaAsset.id),
  });

  return {
    id: photo.id,
    url: media.url,
    order: photo.sortOrder,
    media,
  };
}

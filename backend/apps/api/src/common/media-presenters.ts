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
> & { variants?: unknown };

type MediaVariantInput = {
  url?: unknown;
  downloadUrl?: unknown;
  mimeType?: unknown;
  byteSize?: unknown;
  cacheKey?: unknown;
  expiresAt?: unknown;
};

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
  > & { variants?: unknown },
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
    variants: mapMediaVariants(asset.variants),
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
      | 'variants'
    >;
  },
) {
  const url = buildMediaProxyPath(photo.mediaAsset.id);
  const media = mapMediaResource(photo.mediaAsset, {
    visibility: 'public',
    url,
    downloadUrl: url,
  });

  return {
    id: photo.id,
    url,
    order: photo.sortOrder,
    media,
    variants: media.variants,
  };
}

export function mapMediaVariants(raw: unknown) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  const variants: Record<
    string,
    NonNullable<ReturnType<typeof mapMediaVariant>>
  > = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const variant = mapMediaVariant(value);
    if (variant != null) {
      variants[key] = variant;
    }
  }
  return variants;
}

function mapMediaVariant(raw: unknown) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const input = raw as MediaVariantInput;
  const url = stringOrNull(input.url);
  const downloadUrl = stringOrNull(input.downloadUrl) ?? url;
  if (url == null && downloadUrl == null) {
    return null;
  }

  return {
    url,
    downloadUrl,
    mimeType: stringOrNull(input.mimeType),
    byteSize:
      typeof input.byteSize === 'number' && Number.isFinite(input.byteSize)
        ? Math.max(0, Math.trunc(input.byteSize))
        : null,
    cacheKey: stringOrNull(input.cacheKey),
    expiresAt: stringOrNull(input.expiresAt),
  };
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  buildPublicAssetUrl,
  createS3RequestOptions,
  getS3Config,
} from '@big-break/database';
import sharp from 'sharp';

export type ImageVariantSpec = {
  key: string;
  width?: number;
  height?: number;
  maxLongEdge?: number;
  fit: 'cover' | 'inside';
};

export type ImageVariantMetadata = {
  url: string;
  downloadUrl: string;
  mimeType: string;
  byteSize: number;
  cacheKey: string;
  objectKey: string;
  width: number;
  height: number;
};

export const PROFILE_IMAGE_VARIANT_SPECS: ImageVariantSpec[] = [
  { key: 'avatar', width: 320, height: 320, fit: 'cover' },
  { key: 'thumb', maxLongEdge: 480, fit: 'inside' },
  { key: 'card', maxLongEdge: 900, fit: 'inside' },
  { key: 'hero', maxLongEdge: 1600, fit: 'inside' },
  { key: 'fullscreen', maxLongEdge: 2200, fit: 'inside' },
];

export const AFFICHE_IMAGE_VARIANT_SPECS: ImageVariantSpec[] = [
  { key: 'thumb', maxLongEdge: 480, fit: 'inside' },
  { key: 'card', maxLongEdge: 900, fit: 'inside' },
  { key: 'hero', maxLongEdge: 1600, fit: 'inside' },
  { key: 'fullscreen', maxLongEdge: 2200, fit: 'inside' },
];

export async function createImageVariants(input: {
  s3: S3Client;
  sourceBytes: Buffer;
  sourceObjectKey: string;
  specs: ImageVariantSpec[];
}) {
  const variants: Record<string, ImageVariantMetadata> = {};
  for (const spec of input.specs) {
    const objectKey = variantObjectKey(input.sourceObjectKey, spec.key);
    const resized = sharp(input.sourceBytes)
      .rotate()
      .resize(resizeOptions(spec))
      .webp({ quality: 82 });
    const { data: bytes, info } = await resized.toBuffer({
      resolveWithObject: true,
    });

    await input.s3.send(
      new PutObjectCommand({
        Bucket: getS3Config().bucket,
        Key: objectKey,
        Body: bytes,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
      createS3RequestOptions(),
    );

    const publicUrl = buildPublicAssetUrl(objectKey);
    variants[spec.key] = {
      url: publicUrl,
      downloadUrl: publicUrl,
      mimeType: 'image/webp',
      byteSize: bytes.byteLength,
      cacheKey: `image-variant-${spec.key}-${objectKey}`,
      objectKey,
      width: info.width,
      height: info.height,
    };
  }
  return variants;
}

function resizeOptions(spec: ImageVariantSpec) {
  if (spec.fit === 'cover') {
    return {
      width: spec.width,
      height: spec.height,
      fit: 'cover' as const,
      withoutEnlargement: true,
    };
  }

  return {
    width: spec.maxLongEdge,
    height: spec.maxLongEdge,
    fit: 'inside' as const,
    withoutEnlargement: true,
  };
}

export function variantObjectKey(sourceObjectKey: string, variantKey: string) {
  const slashIndex = sourceObjectKey.lastIndexOf('/');
  const dir = slashIndex >= 0 ? sourceObjectKey.slice(0, slashIndex + 1) : '';
  const file = slashIndex >= 0 ? sourceObjectKey.slice(slashIndex + 1) : sourceObjectKey;
  const base = file.replace(/\.[^.]+$/, '') || 'image';
  return `${dir}${base}__${variantKey}.webp`;
}

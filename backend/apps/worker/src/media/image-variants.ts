import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  buildPublicAssetUrl,
  createS3RequestOptions,
  getS3Config,
} from '@big-break/database';
import sharp from 'sharp';

export type ImageVariantSpec = {
  key: string;
  width: number;
  height: number;
};

export type ImageVariantMetadata = {
  url: string;
  downloadUrl: string;
  mimeType: string;
  byteSize: number;
  cacheKey: string;
};

export const PROFILE_IMAGE_VARIANT_SPECS: ImageVariantSpec[] = [
  { key: 'avatar', width: 320, height: 320 },
  { key: 'card', width: 900, height: 1200 },
  { key: 'hero', width: 1200, height: 1600 },
  { key: 'fullscreen', width: 1600, height: 2200 },
];

export const AFFICHE_IMAGE_VARIANT_SPECS: ImageVariantSpec[] = [
  { key: 'rail', width: 560, height: 320 },
  { key: 'card', width: 900, height: 520 },
  { key: 'hero', width: 1400, height: 900 },
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
    const bytes = await sharp(input.sourceBytes)
      .rotate()
      .resize({
        width: spec.width,
        height: spec.height,
        fit: 'cover',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();

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
    };
  }
  return variants;
}

export function variantObjectKey(sourceObjectKey: string, variantKey: string) {
  const slashIndex = sourceObjectKey.lastIndexOf('/');
  const dir = slashIndex >= 0 ? sourceObjectKey.slice(0, slashIndex + 1) : '';
  const file = slashIndex >= 0 ? sourceObjectKey.slice(slashIndex + 1) : sourceObjectKey;
  const base = file.replace(/\.[^.]+$/, '') || 'image';
  return `${dir}${base}__${variantKey}.webp`;
}

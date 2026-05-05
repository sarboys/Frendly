import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import {
  buildPublicAssetUrl,
  createS3Client,
  createS3RequestOptions,
  getS3Config,
} from '@big-break/database';
import { createHash } from 'crypto';
import type { NormalizedExternalContentItem } from './content-source.types';

const DEFAULT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_IMAGE_TIMEOUT_MS = 15_000;
const IMAGE_MIRROR_PREFIX = 'external-content';

@Injectable()
export class ContentImageMirrorService {
  private s3: S3Client | null = null;

  async mirrorExternalImage(
    item: NormalizedExternalContentItem,
  ): Promise<NormalizedExternalContentItem> {
    const imageUrl = item.imageUrl?.trim();
    if (!imageUrl || !isHttpsUrl(imageUrl) || this.isOwnAssetUrl(imageUrl)) {
      return item;
    }

    try {
      const image = await this.downloadImage(imageUrl);
      if (!image) {
        return item;
      }

      const objectKey = this.objectKey(item, imageUrl, image.contentType);
      await this.putIfMissing(objectKey, image);
      return {
        ...item,
        imageUrl: buildPublicAssetUrl(objectKey),
      };
    } catch (caught) {
      console.warn('[content-import] image mirror failed', {
        sourceCode: item.sourceCode,
        sourceItemId: item.sourceItemId,
        reason: caught instanceof Error ? caught.message : 'unknown',
      });
      return item;
    }
  }

  private async downloadImage(url: string) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      positiveInt(process.env.CONTENT_IMPORT_IMAGE_TIMEOUT_MS, DEFAULT_IMAGE_TIMEOUT_MS),
    );
    timeout.unref?.();

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        return null;
      }

      const contentType = normalizedContentType(response.headers.get('content-type'));
      if (!contentType) {
        return null;
      }

      const maxBytes = positiveInt(
        process.env.CONTENT_IMPORT_IMAGE_MAX_BYTES,
        DEFAULT_IMAGE_MAX_BYTES,
      );
      const contentLength = integer(response.headers.get('content-length'));
      if (contentLength != null && contentLength > maxBytes) {
        return null;
      }

      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.byteLength === 0 || bytes.byteLength > maxBytes) {
        return null;
      }

      return { bytes, contentType };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async putIfMissing(
    objectKey: string,
    image: { bytes: Buffer; contentType: string },
  ) {
    const config = getS3Config();
    const s3 = this.s3Client();
    try {
      await s3.send(
        new HeadObjectCommand({
          Bucket: config.bucket,
          Key: objectKey,
        }),
        createS3RequestOptions(),
      );
      return;
    } catch {}

    await s3.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
        Body: image.bytes,
        ContentType: image.contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
      createS3RequestOptions(),
    );
  }

  private objectKey(
    item: NormalizedExternalContentItem,
    imageUrl: string,
    contentType: string,
  ) {
    const hash = createHash('sha1')
      .update(`${item.sourceCode}|${item.sourceItemId}|${imageUrl}`)
      .digest('hex')
      .slice(0, 16);
    const sourceItemId = safePathSegment(item.sourceItemId).slice(0, 80);
    return [
      IMAGE_MIRROR_PREFIX,
      safePathSegment(item.sourceCode),
      `${sourceItemId}-${hash}.${extensionFor(contentType)}`,
    ].join('/');
  }

  private isOwnAssetUrl(url: string) {
    try {
      const parsed = new URL(url);
      const config = getS3Config();
      return [
        config.cdnEndpoint,
        `${config.publicEndpoint}/${config.bucket}`,
      ].some((prefix) => url.startsWith(prefix) || parsed.origin === prefix);
    } catch {
      return false;
    }
  }

  private s3Client() {
    this.s3 ??= createS3Client();
    return this.s3;
  }
}

function isHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizedContentType(value: string | null) {
  const contentType = value?.split(';', 1)[0]?.trim().toLowerCase();
  return contentType?.startsWith('image/') ? contentType : null;
}

function extensionFor(contentType: string) {
  switch (contentType) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/avif':
      return 'avif';
    default:
      return 'jpg';
  }
}

function safePathSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function integer(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveInt(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

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
import {
  AFFICHE_IMAGE_VARIANT_SPECS,
  createImageVariants,
} from '../media/image-variants';

const DEFAULT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_IMAGE_TIMEOUT_MS = 15_000;
const DEFAULT_IMAGE_RETRY_COUNT = 2;
const DEFAULT_IMAGE_RETRY_DELAY_MS = 250;
const IMAGE_MIRROR_PREFIX = 'external-content';
const DEFAULT_IMAGE_USER_AGENT =
  'FrendlyContentImporter/1.0 (+https://frendly.tech)';

export interface MirrorImageInput {
  sourceCode: string;
  sourceItemId: string;
  imageUrl?: string | null;
}

type MirroredImageAsset = {
  imageUrl: string | null;
  imageVariants: Record<string, unknown>;
};

@Injectable()
export class ContentImageMirrorService {
  private s3: S3Client | null = null;

  async mirrorExternalImage(
    item: NormalizedExternalContentItem,
  ): Promise<NormalizedExternalContentItem> {
    const mirrored = await this.mirrorImageAsset(item);
    if (!mirrored.imageUrl || mirrored.imageUrl === item.imageUrl) {
      return item;
    }

    return {
      ...item,
      imageUrl: mirrored.imageUrl,
      imageVariants: mirrored.imageVariants,
    };
  }

  async mirrorImageUrl(input: MirrorImageInput): Promise<string | null> {
    return (await this.mirrorImageAsset(input)).imageUrl;
  }

  private async mirrorImageAsset(input: MirrorImageInput): Promise<MirroredImageAsset> {
    const imageUrl = input.imageUrl?.trim();
    if (!imageUrl || !isHttpsUrl(imageUrl) || this.isOwnAssetUrl(imageUrl)) {
      return { imageUrl: imageUrl ?? null, imageVariants: {} };
    }

    const fetchUrl = sourceImageUrl(imageUrl);
    try {
      const image = await this.downloadImage(fetchUrl);
      if (!image) {
        return { imageUrl, imageVariants: {} };
      }

      const objectKey = this.objectKey(input, fetchUrl, image.contentType);
      await this.putIfMissing(objectKey, image);
      return {
        imageUrl: buildPublicAssetUrl(objectKey),
        imageVariants: await this.tryCreateVariants(objectKey, image.bytes),
      };
    } catch (caught) {
      console.warn('[content-import] image mirror failed', {
        sourceCode: input.sourceCode,
        sourceItemId: input.sourceItemId,
        imageHost: imageHost(fetchUrl),
        reason: caught instanceof Error ? caught.message : 'unknown',
      });
      return { imageUrl, imageVariants: {} };
    }
  }

  private async tryCreateVariants(objectKey: string, bytes: Buffer) {
    try {
      return await createImageVariants({
        s3: this.s3Client(),
        sourceBytes: bytes,
        sourceObjectKey: objectKey,
        specs: AFFICHE_IMAGE_VARIANT_SPECS,
      });
    } catch (caught) {
      console.warn('[content-import] image variants failed', {
        objectKey,
        reason: caught instanceof Error ? caught.message : 'unknown',
      });
      return {};
    }
  }

  private async downloadImage(url: string) {
    const retries = positiveInt(
      process.env.CONTENT_IMPORT_IMAGE_RETRY_COUNT,
      DEFAULT_IMAGE_RETRY_COUNT,
    );
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const image = await this.downloadImageOnce(url);
        if (image) {
          return image;
        }
      } catch (caught) {
        lastError = caught;
      }

      if (attempt < retries) {
        await sleep(
          positiveInt(
            process.env.CONTENT_IMPORT_IMAGE_RETRY_DELAY_MS,
            DEFAULT_IMAGE_RETRY_DELAY_MS,
          ),
        );
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    return null;
  }

  private async downloadImageOnce(url: string) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      positiveInt(process.env.CONTENT_IMPORT_IMAGE_TIMEOUT_MS, DEFAULT_IMAGE_TIMEOUT_MS),
    );
    timeout.unref?.();

    try {
      const response = await fetch(url, {
        headers: {
          accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
          'user-agent':
            process.env.CONTENT_IMPORT_IMAGE_USER_AGENT ??
            DEFAULT_IMAGE_USER_AGENT,
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`image_fetch_http_${response.status}`);
      }

      const contentType = normalizedContentType(response.headers.get('content-type'));
      if (!contentType) {
        throw new Error('image_fetch_invalid_content_type');
      }

      const maxBytes = positiveInt(
        process.env.CONTENT_IMPORT_IMAGE_MAX_BYTES,
        DEFAULT_IMAGE_MAX_BYTES,
      );
      const contentLength = integer(response.headers.get('content-length'));
      if (contentLength != null && contentLength > maxBytes) {
        throw new Error('image_fetch_too_large');
      }

      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.byteLength === 0 || bytes.byteLength > maxBytes) {
        throw new Error(
          bytes.byteLength === 0 ? 'image_fetch_empty' : 'image_fetch_too_large',
        );
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
    item: MirrorImageInput,
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

function sourceImageUrl(value: string) {
  try {
    const parsed = new URL(value);
    if (
      parsed.hostname === 'api.live.mts.ru' &&
      parsed.pathname.includes('/image-scaling/')
    ) {
      const nested = parsed.searchParams.get('Url');
      if (nested && isHttpsUrl(nested)) {
        return nested;
      }
    }
  } catch {}

  return value;
}

function imageHost(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return 'invalid';
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

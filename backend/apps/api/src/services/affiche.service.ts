import { Injectable } from '@nestjs/common';
import type { AfficheEventDto, AfficheEventListDto } from '@big-break/contracts';
import {
  createPresignedDownload,
  decodeCursor,
  encodeCursor,
  objectKeyFromPublicAssetUrl,
} from '@big-break/database';
import { Prisma } from '@prisma/client';
import { ApiError } from '../common/api-error';
import { normalizeSearchQuery } from '../common/search-query';
import { PrismaService } from './prisma.service';

type AfficheCursor = {
  id: string;
  startsAt: Date | null;
};

const afficheEventSelect = {
  id: true,
  title: true,
  shortSummary: true,
  city: true,
  timezone: true,
  venueName: true,
  address: true,
  lat: true,
  lng: true,
  startsAt: true,
  endsAt: true,
  category: true,
  priceFrom: true,
  priceMode: true,
  currency: true,
  imageUrl: true,
  sourceProvider: true,
  sourceUrl: true,
  actionUrl: true,
  actionKind: true,
  isAffiliate: true,
  tags: true,
  source: {
    select: { code: true, name: true },
  },
} satisfies Prisma.ExternalContentItemSelect;

type AfficheEventRecord = Prisma.ExternalContentItemGetPayload<{
  select: typeof afficheEventSelect;
}>;

@Injectable()
export class AfficheService {
  constructor(private readonly prismaService: PrismaService) {}

  async listEvents(query: Record<string, unknown> = {}): Promise<AfficheEventListDto> {
    const limit = this.parseLimit(query.limit);
    const city = this.optionalText(query.city) ?? 'Москва';
    const cursor = await this.resolveCursor(this.optionalText(query.cursor));
    const where = this.buildWhere(query, city);
    const cursorWhere = this.buildCursorWhere(cursor);

    const items = await this.prismaService.client.externalContentItem.findMany({
      where: cursorWhere ? { AND: [where, cursorWhere] } : where,
      select: afficheEventSelect,
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });
    const page = items.slice(0, limit);
    const next = items.length > limit ? items[limit] : null;
    return {
      items: page.map((item: any) => this.mapEvent(item)),
      nextCursor: next ? this.encodeEventCursor(next) : null,
    };
  }

  async getEvent(eventId: string): Promise<AfficheEventDto> {
    const item = await this.prismaService.client.externalContentItem.findFirst({
      where: {
        id: eventId,
        contentKind: 'event',
        publicStatus: 'published',
        moderationStatus: { not: 'rejected' },
        priceMode: { in: ['free', 'paid'] },
      },
      select: afficheEventSelect,
    });
    if (!item) {
      throw new ApiError(404, 'affiche_event_not_found', 'Affiche event not found');
    }
    return this.mapEvent(item);
  }

  async getImageRedirect(objectKey: unknown) {
    const key = this.optionalText(objectKey);
    if (!key || !key.startsWith('external-content/')) {
      throw new ApiError(404, 'affiche_image_not_found', 'Affiche image not found');
    }

    const signed = await createPresignedDownload(key);
    return {
      redirectUrl: signed.url,
      cacheControl: 'public, max-age=300',
    };
  }

  private buildWhere(query: Record<string, unknown>, city: string): Prisma.ExternalContentItemWhereInput {
    const priceMode = this.parsePriceMode(query.priceMode);
    const dateRange = this.parseDateRange(query);
    const source = this.optionalText(query.source);
    const category = this.optionalText(query.category);
    const search = normalizeSearchQuery(this.optionalText(query.q) ?? undefined);
    const featured = this.parseBoolean(query.featured);

    return {
      city,
      contentKind: 'event',
      publicStatus: 'published',
      moderationStatus: { not: 'rejected' },
      priceMode: priceMode === 'any' ? { in: ['free', 'paid'] } : priceMode,
      ...(source ? { source: { code: source } } : {}),
      ...(category ? { category } : {}),
      ...(featured === true ? { imageUrl: { not: null } } : {}),
      ...(dateRange
        ? { startsAt: { gte: dateRange.from, lt: dateRange.to } }
        : { startsAt: { gte: new Date() } }),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { shortSummary: { contains: search, mode: 'insensitive' } },
              { venueName: { contains: search, mode: 'insensitive' } },
              { address: { contains: search, mode: 'insensitive' } },
              { category: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private parsePriceMode(value: unknown): 'free' | 'paid' | 'any' {
    const raw = this.optionalText(value);
    return raw === 'free' || raw === 'paid' || raw === 'any' ? raw : 'any';
  }

  private parseBoolean(value: unknown): boolean | null {
    const raw = this.optionalText(value);
    if (raw === 'true' || raw === '1') {
      return true;
    }
    if (raw === 'false' || raw === '0') {
      return false;
    }
    return null;
  }

  private parseDateRange(query: Record<string, unknown>) {
    const singleDate = this.optionalText(query.date);
    if (singleDate && singleDate !== 'any') {
      return oneDayRange(singleDate);
    }
    const from = this.optionalDate(query.dateFrom);
    const to = this.optionalDate(query.dateTo);
    if (!from && !to) {
      return null;
    }
    return {
      from: from ?? new Date(),
      to: to ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    };
  }

  private async resolveCursor(cursor?: string | null): Promise<AfficheCursor | null> {
    if (!cursor) {
      return null;
    }
    let cursorId: string | null = null;
    let startsAt: Date | null = null;
    try {
      const decoded = decodeCursor(cursor);
      cursorId = decoded?.value ?? null;
      startsAt = this.dateFromUnknown(decoded?.startsAt);
    } catch {
      cursorId = cursor;
    }
    if (!cursorId) {
      return null;
    }
    if (startsAt) {
      return { id: cursorId, startsAt };
    }
    const item = await this.prismaService.client.externalContentItem.findUnique({
      where: { id: cursorId },
      select: { id: true, startsAt: true },
    });
    return item ? { id: item.id, startsAt: item.startsAt } : null;
  }

  private buildCursorWhere(cursor: AfficheCursor | null): Prisma.ExternalContentItemWhereInput | null {
    if (!cursor) {
      return null;
    }
    if (!cursor.startsAt) {
      return { id: { gt: cursor.id } };
    }
    return {
      OR: [
        { startsAt: { gt: cursor.startsAt } },
        { startsAt: cursor.startsAt, id: { gt: cursor.id } },
      ],
    };
  }

  private encodeEventCursor(item: AfficheCursor) {
    return encodeCursor({
      value: item.id,
      startsAt: item.startsAt?.toISOString() ?? null,
    });
  }

  private mapEvent(item: AfficheEventRecord): AfficheEventDto {
    return {
      id: item.id,
      title: item.title,
      description: item.shortSummary ?? null,
      city: item.city,
      venue: item.venueName ?? null,
      address: item.address ?? null,
      lat: item.lat ?? null,
      lng: item.lng ?? null,
      startsAt: this.dateToIso(item.startsAt),
      endsAt: this.dateToIso(item.endsAt),
      dateLabel: this.dateLabel(item.startsAt, item.timezone),
      timeLabel: this.timeLabel(item.startsAt, item.timezone),
      category: item.category,
      priceFrom: item.priceFrom ?? null,
      priceMode: item.priceMode === 'free' || item.priceMode === 'paid' ? item.priceMode : 'unknown',
      currency: item.currency ?? null,
      imageUrl: this.mapImageUrl(item.imageUrl),
      provider: item.sourceProvider ?? item.source?.name ?? null,
      sourceCode: item.source?.code ?? null,
      actionUrl: item.actionUrl ?? item.sourceUrl ?? null,
      actionKind: item.actionKind ?? null,
      isAffiliate: item.isAffiliate === true,
      tags: Array.isArray(item.tags) ? item.tags.filter((tag: unknown): tag is string => typeof tag === 'string') : [],
    };
  }

  private mapImageUrl(imageUrl: string | null) {
    const trimmed = imageUrl?.trim();
    if (!trimmed) {
      return null;
    }

    const objectKey = objectKeyFromPublicAssetUrl(trimmed);
    if (!objectKey?.startsWith('external-content/')) {
      return trimmed;
    }

    return `/affiche/images?key=${encodeURIComponent(objectKey)}`;
  }

  private parseLimit(value: unknown) {
    const parsed = typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : 24;
    if (!Number.isFinite(parsed)) {
      return 24;
    }
    return Math.min(50, Math.max(1, Math.floor(parsed)));
  }

  private optionalDate(value: unknown) {
    const raw = this.optionalText(value);
    if (!raw) {
      return null;
    }
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private dateFromUnknown(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private optionalText(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private dateToIso(value: Date | null | undefined) {
    return value ? value.toISOString() : null;
  }

  private dateLabel(value: Date | null | undefined, timezone: string | null | undefined) {
    if (!value) {
      return null;
    }
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      timeZone: timezone ?? 'Europe/Moscow',
    }).format(value);
  }

  private timeLabel(value: Date | null | undefined, timezone: string | null | undefined) {
    if (!value) {
      return null;
    }
    return new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone ?? 'Europe/Moscow',
    }).format(value);
  }
}

function oneDayRange(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const from = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(from.getTime())) {
    return null;
  }
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 1);
  return { from, to };
}

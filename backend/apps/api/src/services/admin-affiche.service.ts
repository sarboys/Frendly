import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

@Injectable()
export class AdminAfficheService {
  constructor(private readonly prismaService: PrismaService) {}

  async listContentItems(query: Record<string, unknown> = {}) {
    const limit = this.parseLimit(query.limit);
    const rows = await this.prismaService.client.externalContentItem.findMany({
      where: this.buildContentItemWhere(query),
      select: this.contentItemSelect(),
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    return this.page(
      rows,
      limit,
      (row) => this.mapContentItem(row as any),
      (row) => ({ startsAt: row.startsAt?.toISOString() ?? null, id: row.id }),
    );
  }

  async getContentItem(itemId: string) {
    const item = await this.prismaService.client.externalContentItem.findFirst({
      where: { id: itemId, contentKind: 'event' },
      select: this.contentItemSelect(),
    });
    if (!item) {
      throw new ApiError(404, 'admin_affiche_item_not_found', 'Affiche item not found');
    }

    return this.mapContentItem(item as any);
  }

  async updateContentItem(itemId: string, body: Record<string, unknown>) {
    await this.ensureEventContentItem(itemId);
    const item = await this.prismaService.client.externalContentItem.update({
      where: { id: itemId },
      data: this.parseContentItemUpdate(body),
      select: this.contentItemSelect(),
    });

    return this.mapContentItem(item as any);
  }

  async contentItemAction(itemId: string, action: string) {
    await this.ensureEventContentItem(itemId);
    const data = contentActionData(action);
    if (!data) {
      throw new ApiError(400, 'admin_affiche_item_action_invalid', 'Affiche item action is invalid');
    }
    const item = await this.prismaService.client.externalContentItem.update({
      where: { id: itemId },
      data,
      select: this.contentItemSelect(),
    });

    return this.mapContentItem(item as any);
  }

  private parseLimit(value: unknown) {
    const text = this.optionalText(value);
    if (!text) {
      return DEFAULT_LIMIT;
    }

    const limit = Number(text);
    if (!Number.isInteger(limit) || limit < 1) {
      throw new ApiError(400, 'admin_invalid_limit', 'Limit is invalid');
    }

    return Math.min(limit, MAX_LIMIT);
  }

  private parseCursor(value: unknown) {
    const text = this.optionalText(value);
    if (!text) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(Buffer.from(text, 'base64url').toString('utf8'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Normalize every cursor parse failure into the same API error.
    }

    throw new ApiError(400, 'admin_invalid_cursor', 'Cursor is invalid');
  }

  private optionalText(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }

    const text = value.trim();
    return text === '' ? null : text;
  }

  private requiredText(value: unknown, code: string) {
    const text = this.optionalText(value);
    if (!text) {
      throw new ApiError(400, code, 'Required text is missing');
    }

    return text;
  }

  private parseDate(value: unknown, code = 'admin_invalid_date') {
    const text = this.optionalText(value);
    if (!text) {
      return null;
    }

    const date = new Date(text);
    if (Number.isNaN(date.getTime())) {
      throw new ApiError(400, code, 'Date is invalid');
    }

    return date;
  }

  private parseBoolean(value: unknown, code = 'admin_invalid_boolean') {
    if (typeof value === 'boolean') {
      return value;
    }

    const text = this.optionalText(value)?.toLowerCase();
    if (!text) {
      return null;
    }
    if (text === 'true' || text === '1') {
      return true;
    }
    if (text === 'false' || text === '0') {
      return false;
    }

    throw new ApiError(400, code, 'Boolean is invalid');
  }

  private page<T, R>(
    rows: T[],
    limit: number,
    map: (row: T) => R,
    cursorFor: (row: T) => Record<string, unknown>,
  ) {
    const pageRows = rows.slice(0, limit);
    const hasNext = rows.length > limit;
    const lastRow = pageRows[pageRows.length - 1];

    return {
      items: pageRows.map(map),
      nextCursor: hasNext && lastRow ? this.encodeCursor(cursorFor(lastRow)) : null,
    };
  }

  private encodeCursor(cursor: Record<string, unknown>) {
    return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
  }

  private buildContentItemWhere(query: Record<string, unknown>): Prisma.ExternalContentItemWhereInput {
    const and: Prisma.ExternalContentItemWhereInput[] = [{ contentKind: 'event' }];
    const search = this.optionalText(query.q);
    const source = this.optionalText(query.source);
    const hasCoords = this.parseBoolean(query.hasCoords);
    const dateFrom = this.parseDate(query.dateFrom, 'admin_affiche_date_from_invalid');
    const dateTo = this.parseDate(query.dateTo, 'admin_affiche_date_to_invalid');

    this.addTextFilter(and, query, 'city');
    this.addTextFilter(and, query, 'category');
    this.addTextFilter(and, query, 'priceMode');
    this.addTextFilter(and, query, 'publicStatus');
    this.addTextFilter(and, query, 'moderationStatus');
    if (source) {
      and.push({ source: { is: { code: source } } });
    }
    if (hasCoords === true) {
      and.push({ lat: { not: null }, lng: { not: null } });
    }
    if (hasCoords === false) {
      and.push({ OR: [{ lat: null }, { lng: null }] });
    }
    if (dateFrom || dateTo) {
      and.push({
        startsAt: {
          ...(dateFrom ? { gte: dateFrom } : {}),
          ...(dateTo ? { lte: dateTo } : {}),
        },
      });
    }
    if (search) {
      and.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { shortSummary: { contains: search, mode: 'insensitive' } },
          { venueName: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
          { category: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    and.push(this.contentCursorWhere(query.cursor));
    return { AND: and };
  }

  private addTextFilter(
    and: Prisma.ExternalContentItemWhereInput[],
    query: Record<string, unknown>,
    key: 'city' | 'category' | 'priceMode' | 'publicStatus' | 'moderationStatus',
  ) {
    const value = this.optionalText(query[key]);
    if (value) {
      and.push({ [key]: value });
    }
  }

  private contentItemSelect() {
    return {
      id: true,
      sourceId: true,
      sourceItemId: true,
      sourceUrl: true,
      contentKind: true,
      city: true,
      timezone: true,
      area: true,
      title: true,
      shortSummary: true,
      category: true,
      tags: true,
      address: true,
      lat: true,
      lng: true,
      startsAt: true,
      endsAt: true,
      priceFrom: true,
      currency: true,
      venueName: true,
      imageUrl: true,
      actionUrl: true,
      actionKind: true,
      priceMode: true,
      isAffiliate: true,
      sourceProvider: true,
      publicStatus: true,
      moderationStatus: true,
      importedAt: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true,
      source: { select: { code: true, name: true } },
    };
  }

  private mapContentItem(item: any) {
    return {
      source: 'imported',
      id: item.id,
      sourceId: item.sourceId,
      sourceCode: item.source?.code ?? null,
      sourceName: item.source?.name ?? null,
      sourceItemId: item.sourceItemId,
      sourceUrl: item.sourceUrl,
      contentKind: item.contentKind,
      city: item.city,
      timezone: item.timezone,
      area: item.area,
      title: item.title,
      shortSummary: item.shortSummary,
      category: item.category,
      tags: Array.isArray(item.tags) ? item.tags : [],
      address: item.address,
      lat: item.lat,
      lng: item.lng,
      startsAt: item.startsAt?.toISOString() ?? null,
      endsAt: item.endsAt?.toISOString() ?? null,
      priceFrom: item.priceFrom,
      currency: item.currency,
      venueName: item.venueName,
      imageUrl: item.imageUrl,
      actionUrl: item.actionUrl,
      actionKind: item.actionKind,
      priceMode: item.priceMode,
      isAffiliate: item.isAffiliate,
      sourceProvider: item.sourceProvider,
      publicStatus: item.publicStatus,
      moderationStatus: item.moderationStatus,
      hasCoords: item.lat != null && item.lng != null,
      importedAt: item.importedAt.toISOString(),
      expiresAt: item.expiresAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private parseContentItemUpdate(body: Record<string, unknown>) {
    const data: Record<string, unknown> = {};
    this.setRequiredText(data, body, 'title', 'admin_affiche_title_required');
    this.setNullableText(data, body, 'shortSummary');
    this.setRequiredText(data, body, 'category', 'admin_affiche_category_required');
    if (this.hasOwn(body, 'tags')) data.tags = this.parseStringArray(body.tags);
    this.setNullableText(data, body, 'address');
    if (this.hasOwn(body, 'lat')) data.lat = this.optionalNumber(body.lat);
    if (this.hasOwn(body, 'lng')) data.lng = this.optionalNumber(body.lng);
    this.setNullableDate(data, body, 'startsAt', 'admin_affiche_starts_at_invalid');
    this.setNullableDate(data, body, 'endsAt', 'admin_affiche_ends_at_invalid');
    if (this.hasOwn(body, 'priceFrom')) {
      data.priceFrom = body.priceFrom == null ? null : this.parseInt(body.priceFrom, 0, 1_000_000, 'admin_affiche_price_invalid');
    }
    this.setNullableText(data, body, 'currency');
    this.setNullableText(data, body, 'venueName');
    this.setNullableText(data, body, 'imageUrl');
    if (this.hasOwn(body, 'actionUrl')) {
      data.actionUrl = this.optionalSafeUrl(body.actionUrl, 'admin_affiche_action_url_invalid');
    }
    this.setNullableText(data, body, 'actionKind');
    this.setRequiredText(data, body, 'priceMode', 'admin_affiche_price_mode_required');
    this.setRequiredText(data, body, 'publicStatus', 'admin_affiche_public_status_required');
    this.setRequiredText(data, body, 'moderationStatus', 'admin_affiche_moderation_status_required');

    return data as Prisma.ExternalContentItemUpdateInput;
  }

  private async ensureEventContentItem(itemId: string) {
    const item = await this.prismaService.client.externalContentItem.findFirst({
      where: { id: itemId, contentKind: 'event' },
      select: { id: true },
    });
    if (!item) {
      throw new ApiError(404, 'admin_affiche_item_not_found', 'Affiche item not found');
    }
  }

  private contentCursorWhere(cursorValue: unknown) {
    const cursor = this.parseCursor(cursorValue);
    if (!cursor) return {};
    const startsAt = this.parseNullableCursorDate(cursor, 'startsAt');
    const id = this.requiredCursorText(cursor, 'id');
    if (!startsAt) {
      return { id: { lt: id } };
    }
    return { OR: [{ startsAt: { lt: startsAt } }, { startsAt, id: { lt: id } }] };
  }

  private requiredCursorDate(cursor: Record<string, unknown>, key: string) {
    const date = this.parseDate(cursor[key], 'admin_invalid_cursor');
    if (!date) throw new ApiError(400, 'admin_invalid_cursor', 'Cursor is invalid');
    return date;
  }

  private parseNullableCursorDate(cursor: Record<string, unknown>, key: string) {
    if (cursor[key] == null) return null;
    return this.requiredCursorDate(cursor, key);
  }

  private requiredCursorText(cursor: Record<string, unknown>, key: string) {
    const text = this.optionalText(cursor[key]);
    if (!text) throw new ApiError(400, 'admin_invalid_cursor', 'Cursor is invalid');
    return text;
  }

  private requiredDate(value: unknown, code: string) {
    const date = this.parseDate(value, code);
    if (!date) throw new ApiError(400, code, 'Date is invalid');
    return date;
  }

  private optionalSafeUrl(value: unknown, code: string) {
    if (value == null || value === '') return null;
    const text = this.requiredText(value, code);
    try {
      const url = new URL(text);
      if (url.protocol !== 'https:') throw new Error('unsafe');
      return url.toString();
    } catch {
      throw new ApiError(400, code, 'URL is invalid');
    }
  }

  private parseInt(value: unknown, min: number, max: number, code: string) {
    const parsed = typeof value === 'number' ? value : Number(value);
    const intValue = Math.trunc(parsed);
    if (!Number.isFinite(intValue) || intValue < min || intValue > max) {
      throw new ApiError(400, code, 'Number is invalid');
    }
    return intValue;
  }

  private optionalNumber(value: unknown) {
    if (value == null || value === '') return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) {
      throw new ApiError(400, 'admin_invalid_number', 'Number is invalid');
    }
    return parsed;
  }

  private parseStringArray(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim());
  }

  private setRequiredText(data: Record<string, unknown>, body: Record<string, unknown>, key: string, code: string) {
    if (this.hasOwn(body, key)) data[key] = this.requiredText(body[key], code);
  }

  private setNullableText(data: Record<string, unknown>, body: Record<string, unknown>, key: string) {
    if (this.hasOwn(body, key)) data[key] = this.optionalText(body[key]);
  }

  private setNullableDate(data: Record<string, unknown>, body: Record<string, unknown>, key: string, code: string) {
    if (!this.hasOwn(body, key)) return;
    data[key] = body[key] == null || body[key] === '' ? null : this.requiredDate(body[key], code);
  }

  private hasOwn(source: Record<string, unknown>, key: string) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }

}

function contentActionData(action: string) {
  switch (action) {
    case 'publish':
      return { publicStatus: 'published', moderationStatus: 'approved' };
    case 'hide':
      return { publicStatus: 'hidden', moderationStatus: 'pending' };
    case 'reject':
      return { publicStatus: 'hidden', moderationStatus: 'rejected' };
    case 'stale':
      return { publicStatus: 'stale' };
    case 'force-free':
      return { priceMode: 'free', priceFrom: 0, publicStatus: 'published' };
    case 'force-paid':
      return { priceMode: 'paid', publicStatus: 'published' };
    default:
      return null;
  }
}

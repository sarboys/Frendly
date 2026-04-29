import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AdminPartnerOfferAnalyticsDto } from '@big-break/contracts';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

type AnalyticsFilters = {
  fromText: string | null;
  toText: string | null;
  from: Date | null;
  toExclusive: Date | null;
  partnerId: string | null;
  venueId: string | null;
};

type SummaryRow = {
  activations: number | bigint | null;
  uniqueUsers: number | bigint | null;
};

type PartnerRow = {
  partnerId: string | null;
  partnerName: string | null;
  city: string | null;
  activations: number | bigint | null;
  uniqueUsers: number | bigint | null;
};

type RouteRow = {
  routeTemplateId: string | null;
  routeTitle: string | null;
  city: string | null;
  activations: number | bigint | null;
  uniqueUsers: number | bigint | null;
};

type DailyRow = {
  date: string | Date;
  activations: number | bigint | null;
  uniqueUsers: number | bigint | null;
};

@Injectable()
export class AdminEveningAnalyticsService {
  constructor(private readonly prismaService: PrismaService) {}

  async getPartnerOfferAnalytics(
    query: Record<string, unknown> = {},
  ): Promise<AdminPartnerOfferAnalyticsDto> {
    const filters = this.parseFilters(query);
    const client = this.prismaService.client;
    const summaryWhere = this.buildWhere(filters);
    const partnerWhere = this.buildWhere(filters, [
      Prisma.sql`e."partnerId" IS NOT NULL`,
    ]);
    const routeWhere = this.buildWhere(filters, [
      Prisma.sql`e."routeTemplateId" IS NOT NULL`,
    ]);

    const [summaryRows, partnerRows, routeRows, dailyRows] = await Promise.all([
      client.$queryRaw<SummaryRow[]>`
        SELECT
          COUNT(*)::int AS "activations",
          COUNT(DISTINCT e."userId")::int AS "uniqueUsers"
        FROM "EveningAnalyticsEvent" e
        ${summaryWhere}
      `,
      client.$queryRaw<PartnerRow[]>`
        SELECT
          e."partnerId" AS "partnerId",
          p."name" AS "partnerName",
          p."city" AS "city",
          COUNT(*)::int AS "activations",
          COUNT(DISTINCT e."userId")::int AS "uniqueUsers"
        FROM "EveningAnalyticsEvent" e
        LEFT JOIN "Partner" p ON p."id" = e."partnerId"
        ${partnerWhere}
        GROUP BY e."partnerId", p."name", p."city"
        ORDER BY COUNT(*) DESC, e."partnerId" ASC
        LIMIT 10
      `,
      client.$queryRaw<RouteRow[]>`
        SELECT
          e."routeTemplateId" AS "routeTemplateId",
          r."title" AS "routeTitle",
          COALESCE(t."city", e."city") AS "city",
          COUNT(*)::int AS "activations",
          COUNT(DISTINCT e."userId")::int AS "uniqueUsers"
        FROM "EveningAnalyticsEvent" e
        LEFT JOIN "EveningRouteTemplate" t ON t."id" = e."routeTemplateId"
        LEFT JOIN "EveningRoute" r ON r."id" = t."currentRouteId"
        ${routeWhere}
        GROUP BY e."routeTemplateId", r."title", t."city", e."city"
        ORDER BY COUNT(*) DESC, e."routeTemplateId" ASC
        LIMIT 10
      `,
      client.$queryRaw<DailyRow[]>`
        SELECT
          to_char(date_trunc('day', e."createdAt"), 'YYYY-MM-DD') AS "date",
          COUNT(*)::int AS "activations",
          COUNT(DISTINCT e."userId")::int AS "uniqueUsers"
        FROM "EveningAnalyticsEvent" e
        ${summaryWhere}
        GROUP BY date_trunc('day', e."createdAt")
        ORDER BY date_trunc('day', e."createdAt") ASC
      `,
    ]);

    const summary = summaryRows[0] ?? {
      activations: 0,
      uniqueUsers: 0,
    };

    return {
      filters: {
        from: filters.fromText,
        to: filters.toText,
        partnerId: filters.partnerId,
        venueId: filters.venueId,
      },
      activations: this.toNumber(summary.activations),
      uniqueUsers: this.toNumber(summary.uniqueUsers),
      topPartners: partnerRows.map((row) => ({
        partnerId: row.partnerId ?? '',
        partnerName: row.partnerName ?? 'Партнер без названия',
        city: row.city ?? null,
        activations: this.toNumber(row.activations),
        uniqueUsers: this.toNumber(row.uniqueUsers),
      })),
      topRoutes: routeRows.map((row) => ({
        routeTemplateId: row.routeTemplateId ?? '',
        routeTitle: row.routeTitle ?? 'Маршрут без названия',
        city: row.city ?? null,
        activations: this.toNumber(row.activations),
        uniqueUsers: this.toNumber(row.uniqueUsers),
      })),
      daily: dailyRows.map((row) => ({
        date: this.dateLabel(row.date),
        activations: this.toNumber(row.activations),
        uniqueUsers: this.toNumber(row.uniqueUsers),
      })),
    };
  }

  private buildWhere(filters: AnalyticsFilters, extra: Prisma.Sql[] = []) {
    const conditions = [
      Prisma.sql`e."name" = 'partner_offer_activated'`,
      ...extra,
    ];
    if (filters.from) {
      conditions.push(Prisma.sql`e."createdAt" >= ${filters.from}`);
    }
    if (filters.toExclusive) {
      conditions.push(Prisma.sql`e."createdAt" < ${filters.toExclusive}`);
    }
    if (filters.partnerId) {
      conditions.push(Prisma.sql`e."partnerId" = ${filters.partnerId}`);
    }
    if (filters.venueId) {
      conditions.push(Prisma.sql`e."venueId" = ${filters.venueId}`);
    }
    return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
  }

  private parseFilters(query: Record<string, unknown>): AnalyticsFilters {
    const fromText = this.optionalText(query.from);
    const toText = this.optionalText(query.to);
    const from = fromText ? this.parseDate(fromText, false) : null;
    const toExclusive = toText ? this.parseDate(toText, true) : null;
    if (from && toExclusive && from.getTime() >= toExclusive.getTime()) {
      throw new ApiError(
        400,
        'analytics_date_range_invalid',
        'Analytics date range is invalid',
      );
    }
    return {
      fromText,
      toText,
      from,
      toExclusive,
      partnerId: this.optionalText(query.partnerId),
      venueId: this.optionalText(query.venueId),
    };
  }

  private parseDate(value: string, endExclusive: boolean) {
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const date = new Date(dateOnly ? `${value}T00:00:00.000Z` : value);
    if (Number.isNaN(date.getTime())) {
      throw new ApiError(
        400,
        'analytics_date_invalid',
        'Analytics date filter is invalid',
      );
    }
    if (dateOnly && endExclusive) {
      date.setUTCDate(date.getUTCDate() + 1);
    }
    return date;
  }

  private optionalText(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private toNumber(value: number | bigint | null | undefined) {
    if (typeof value === 'bigint') {
      return Number(value);
    }
    return value ?? 0;
  }

  private dateLabel(value: string | Date) {
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    return value;
  }
}

import { Injectable } from '@nestjs/common';
import { Prisma, ReportStatus } from '@prisma/client';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const REPORT_STATUSES = ['open', 'in_review', 'resolved'] as const;
const TARGET_TYPES = ['user', 'event'] as const;

type AdminReportStatus = (typeof REPORT_STATUSES)[number];
type AdminReportTargetType = (typeof TARGET_TYPES)[number];

type AdminReportRow = {
  id: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  blockRequested: boolean;
  targetEventId: string | null;
  createdAt: Date;
  updatedAt: Date;
  reporter: AdminReportUserRow;
  targetUser: AdminReportUserRow;
  targetEvent: {
    id: string;
    title: string;
    city: string | null;
    place: string;
    startsAt: Date;
  } | null;
};

type AdminReportUserRow = {
  id: string;
  displayName: string;
  email: string | null;
  phoneNumber: string | null;
  profile: {
    city: string | null;
    avatarUrl: string | null;
  } | null;
};

@Injectable()
export class AdminReportsService {
  constructor(private readonly prismaService: PrismaService) {}

  async listReports(query: Record<string, unknown> = {}) {
    const limit = this.parseLimit(query.limit);
    const where = this.buildReportsWhere(query);
    const rows = await this.prismaService.client.userReport.findMany({
      where,
      select: this.reportSelect(),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    return this.page(
      rows as AdminReportRow[],
      limit,
      (row) => this.mapReport(row),
      (row) => ({ createdAt: row.createdAt.toISOString(), id: row.id }),
    );
  }

  async getReport(reportId: string) {
    const report = await this.prismaService.client.userReport.findUnique({
      where: { id: reportId },
      select: this.reportSelect(),
    });

    if (!report) {
      throw new ApiError(404, 'admin_report_not_found', 'Report not found');
    }

    return this.mapReport(report as AdminReportRow);
  }

  async updateReport(reportId: string, body: Record<string, unknown>) {
    const status = this.parseReportStatus(body.status);

    try {
      const report = await this.prismaService.client.userReport.update({
        where: { id: reportId },
        data: { status },
        select: this.reportSelect(),
      });

      return this.mapReport(report as AdminReportRow);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new ApiError(404, 'admin_report_not_found', 'Report not found');
      }
      throw error;
    }
  }

  private buildReportsWhere(query: Record<string, unknown>): Prisma.UserReportWhereInput {
    const and: Prisma.UserReportWhereInput[] = [this.createdAtCursorWhere(query.cursor)];
    const status = this.optionalReportStatus(query.status);
    const targetType = this.optionalTargetType(query.targetType);
    const q = this.optionalText(query.q);

    if (status) {
      and.push({ status });
    }

    if (targetType === 'event') {
      and.push({ targetEventId: { not: null } });
    } else if (targetType === 'user') {
      and.push({ targetEventId: null });
    }

    if (q) {
      and.push({
        OR: [
          { reason: { contains: q, mode: 'insensitive' } },
          { details: { contains: q, mode: 'insensitive' } },
          { reporter: { displayName: { contains: q, mode: 'insensitive' } } },
          { reporter: { email: { contains: q, mode: 'insensitive' } } },
          { targetUser: { displayName: { contains: q, mode: 'insensitive' } } },
          { targetUser: { email: { contains: q, mode: 'insensitive' } } },
          { targetEvent: { is: { title: { contains: q, mode: 'insensitive' } } } },
          { targetEvent: { is: { place: { contains: q, mode: 'insensitive' } } } },
        ],
      });
    }

    return { AND: and };
  }

  private reportSelect() {
    return {
      id: true,
      reason: true,
      details: true,
      status: true,
      blockRequested: true,
      targetEventId: true,
      createdAt: true,
      updatedAt: true,
      reporter: { select: this.userSelect() },
      targetUser: { select: this.userSelect() },
      targetEvent: {
        select: {
          id: true,
          title: true,
          city: true,
          place: true,
          startsAt: true,
        },
      },
    };
  }

  private userSelect() {
    return {
      id: true,
      displayName: true,
      email: true,
      phoneNumber: true,
      profile: {
        select: {
          city: true,
          avatarUrl: true,
        },
      },
    };
  }

  private mapReport(row: AdminReportRow) {
    return {
      id: row.id,
      targetType: this.mapTargetType(row),
      reason: row.reason,
      details: row.details,
      status: row.status,
      blockRequested: row.blockRequested,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      reporter: this.mapUser(row.reporter),
      targetUser: this.mapUser(row.targetUser),
      targetEvent: row.targetEvent
        ? {
            id: row.targetEvent.id,
            title: row.targetEvent.title,
            city: row.targetEvent.city,
            place: row.targetEvent.place,
            startsAt: row.targetEvent.startsAt.toISOString(),
          }
        : null,
    };
  }

  private mapTargetType(row: Pick<AdminReportRow, 'targetEventId'>): AdminReportTargetType {
    return row.targetEventId ? 'event' : 'user';
  }

  private mapUser(user: AdminReportUserRow) {
    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      city: user.profile?.city ?? null,
      avatarUrl: user.profile?.avatarUrl ?? null,
    };
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

  private optionalReportStatus(value: unknown): AdminReportStatus | null {
    const text = this.optionalText(value);
    if (!text) {
      return null;
    }

    return this.parseReportStatus(text);
  }

  private parseReportStatus(value: unknown): AdminReportStatus {
    const text = this.optionalText(value);
    if (text && REPORT_STATUSES.includes(text as AdminReportStatus)) {
      return text as AdminReportStatus;
    }

    throw new ApiError(400, 'admin_invalid_report_status', 'Report status is invalid');
  }

  private optionalTargetType(value: unknown): AdminReportTargetType | null {
    const text = this.optionalText(value);
    if (!text) {
      return null;
    }

    if (TARGET_TYPES.includes(text as AdminReportTargetType)) {
      return text as AdminReportTargetType;
    }

    throw new ApiError(400, 'admin_invalid_report_target_type', 'Report target type is invalid');
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

  private createdAtCursorWhere(cursorValue: unknown) {
    const cursor = this.parseCursor(cursorValue);
    if (!cursor) {
      return {};
    }

    const createdAt = this.requiredCursorDate(cursor, 'createdAt');
    const id = this.requiredCursorText(cursor, 'id');
    return {
      OR: [
        { createdAt: { lt: createdAt } },
        { createdAt, id: { lt: id } },
      ],
    };
  }

  private requiredCursorDate(cursor: Record<string, unknown>, key: string) {
    const date = this.parseDate(cursor[key], 'admin_invalid_cursor');
    if (!date) {
      throw new ApiError(400, 'admin_invalid_cursor', 'Cursor is invalid');
    }

    return date;
  }

  private requiredCursorText(cursor: Record<string, unknown>, key: string) {
    const text = this.optionalText(cursor[key]);
    if (!text) {
      throw new ApiError(400, 'admin_invalid_cursor', 'Cursor is invalid');
    }

    return text;
  }

  private parseDate(value: unknown, code: string) {
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

  private optionalText(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }

    const text = value.trim();
    return text === '' ? null : text;
  }

  private page<Row, Item>(
    rows: Row[],
    limit: number,
    map: (row: Row) => Item,
    cursor: (row: Row) => Record<string, unknown>,
  ) {
    const items = rows.slice(0, limit).map(map);
    const nextRow = rows.length > limit ? rows[limit] : null;
    return {
      items,
      nextCursor: nextRow
        ? Buffer.from(JSON.stringify(cursor(nextRow))).toString('base64url')
        : null,
    };
  }
}

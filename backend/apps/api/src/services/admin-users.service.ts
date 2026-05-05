import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trial', 'canceled'] as const;

type CurrentSubscription = {
  plan: string;
  status: string;
  startedAt: Date | null;
  renewsAt: Date | null;
  trialEndsAt: Date | null;
} | null;

type UserListRow = {
  id: string;
  displayName: string;
  email: string | null;
  phoneNumber: string | null;
  status: string;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
  profile: { city: string | null } | null;
  subscriptions: CurrentSubscription[];
  _count: {
    hostedEvents: number;
    eventParticipants: number;
    reportsReceived: number;
  };
};

type UserDetailRow = UserListRow & {
  suspendedAt: Date | null;
  suspensionReason: string | null;
  profile: {
    age: number | null;
    birthDate: Date | null;
    gender: string | null;
    city: string | null;
    area: string | null;
    bio: string | null;
    vibe: string | null;
    rating: number;
    meetupCount: number;
    avatarUrl: string | null;
    updatedAt: Date;
  } | null;
  settings: Record<string, unknown> | null;
  verification: {
    status: string;
    selfieDone: boolean;
    documentDone: boolean;
    reviewedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
};

type AdminProfileTextUpdate = {
  bio?: string | null;
  city?: string | null;
  avatarUrl?: string | null;
};

@Injectable()
export class AdminUsersService {
  constructor(private readonly prismaService: PrismaService) {}

  async listUsers(query: Record<string, unknown> = {}) {
    const limit = this.parseLimit(query.limit);
    const where = this.buildUserWhere(query);
    const rows = await this.prismaService.client.user.findMany({
      where,
      select: this.userListSelect(),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    return this.page(
      rows,
      limit,
      (row) => this.mapListUser(row as UserListRow),
      (row) => ({ createdAt: row.createdAt.toISOString(), id: row.id }),
    );
  }

  async getUser(userId: string) {
    const [user, activeSessionsCount, openReportsCount] = await Promise.all([
      this.prismaService.client.user.findUnique({
        where: { id: userId },
        select: this.userDetailSelect(),
      }),
      this.prismaService.client.session.count({
        where: { userId, revokedAt: null },
      }),
      this.prismaService.client.userReport.count({
        where: { targetUserId: userId, status: 'open' },
      }),
    ]);

    if (!user) {
      throw new ApiError(404, 'admin_user_not_found', 'User not found');
    }

    return this.mapDetailUser(user as UserDetailRow, {
      activeSessionsCount,
      openReportsCount,
    });
  }

  async updateProfile(userId: string, body: Record<string, unknown>) {
    await this.ensureUserExists(userId);
    const userData = await this.parseUserProfileUpdate(userId, body);
    const profileData = this.parseProfileUpdate(body);

    if (Object.keys(userData).length > 0 || Object.keys(profileData).length > 0) {
      await this.prismaService.client.$transaction(async (tx) => {
        if (Object.keys(userData).length > 0) {
          await tx.user.update({
            where: { id: userId },
            data: userData,
          });
        }

        if (Object.keys(profileData).length > 0) {
          await tx.profile.upsert({
            where: { userId },
            update: profileData,
            create: {
              userId,
              ...profileData,
            },
          });
        }
      });
    }

    return this.getUser(userId);
  }

  async verifyUser(userId: string) {
    await this.ensureUserExists(userId);
    const now = new Date();

    await this.prismaService.client.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { verified: true },
      });
      await tx.userVerification.upsert({
        where: { userId },
        update: {
          status: 'verified',
          selfieDone: true,
          documentDone: true,
          reviewedAt: now,
        },
        create: {
          userId,
          status: 'verified',
          selfieDone: true,
          documentDone: true,
          reviewedAt: now,
        },
      });
    });

    return this.getUser(userId);
  }

  async unverifyUser(userId: string) {
    await this.ensureUserExists(userId);
    const now = new Date();

    await this.prismaService.client.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { verified: false },
      });
      await tx.userVerification.upsert({
        where: { userId },
        update: {
          status: 'not_started',
          reviewedAt: now,
        },
        create: {
          userId,
          status: 'not_started',
          selfieDone: false,
          documentDone: false,
          reviewedAt: now,
        },
      });
    });

    return this.getUser(userId);
  }

  async suspendUser(userId: string, body: Record<string, unknown> = {}) {
    await this.ensureUserExists(userId);
    await this.prismaService.client.user.update({
      where: { id: userId },
      data: {
        status: 'suspended',
        suspendedAt: new Date(),
        suspensionReason: this.optionalText(body.reason),
      },
    });

    return this.getUser(userId);
  }

  async unsuspendUser(userId: string) {
    await this.ensureUserExists(userId);
    await this.prismaService.client.user.update({
      where: { id: userId },
      data: {
        status: 'active',
        suspendedAt: null,
        suspensionReason: null,
      },
    });

    return this.getUser(userId);
  }

  async revokeSessions(userId: string) {
    await this.ensureUserExists(userId);
    const result = await this.prismaService.client.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { revokedCount: result.count };
  }

  async listUserMeetups(userId: string, query: Record<string, unknown> = {}) {
    await this.ensureUserExists(userId);
    const limit = this.parseLimit(query.limit);
    const where: Prisma.EventWhereInput = {
      AND: [
        {
          OR: [
            { hostId: userId },
            { participants: { some: { userId } } },
          ],
        },
        this.startsAtCursorWhere(query.cursor),
      ],
    };
    const rows = await this.prismaService.client.event.findMany({
      where,
      select: {
        id: true,
        title: true,
        emoji: true,
        place: true,
        startsAt: true,
        canceledAt: true,
        hostId: true,
        capacity: true,
        liveState: {
          select: {
            status: true,
          },
        },
        _count: {
          select: {
            participants: true,
            joinRequests: true,
          },
        },
      },
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    return this.page(
      rows,
      limit,
      (row) => ({
        id: row.id,
        title: row.title,
        emoji: row.emoji,
        city: null,
        place: row.place,
        startsAt: row.startsAt.toISOString(),
        role: row.hostId === userId ? 'host' : 'participant',
        status: this.mapMeetupStatus(row),
        participantsCount: row._count.participants,
        joinRequestsCount: row._count.joinRequests,
        capacity: row.capacity,
      }),
      (row) => ({ startsAt: row.startsAt.toISOString(), id: row.id }),
    );
  }

  async listUserReports(userId: string, query: Record<string, unknown> = {}) {
    await this.ensureUserExists(userId);
    const limit = this.parseLimit(query.limit);
    const rows = await this.prismaService.client.userReport.findMany({
      where: {
        AND: [
          { targetUserId: userId },
          this.createdAtCursorWhere(query.cursor),
        ],
      },
      select: {
        id: true,
        reason: true,
        details: true,
        status: true,
        blockRequested: true,
        createdAt: true,
        updatedAt: true,
        reporter: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    return this.page(
      rows,
      limit,
      (row) => ({
        id: row.id,
        reason: row.reason,
        details: row.details,
        status: row.status,
        blockRequested: row.blockRequested,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        reporter: row.reporter,
      }),
      (row) => ({ createdAt: row.createdAt.toISOString(), id: row.id }),
    );
  }

  async listUserAudit(userId: string, query: Record<string, unknown> = {}) {
    await this.ensureUserExists(userId);
    const limit = this.parseLimit(query.limit);
    const rows = await this.prismaService.client.adminAuditEvent.findMany({
      where: {
        AND: [
          { path: { contains: `/admin/users/${userId}` } },
          this.createdAtCursorWhere(query.cursor),
        ],
      },
      select: {
        id: true,
        adminUserId: true,
        action: true,
        method: true,
        path: true,
        statusCode: true,
        requestId: true,
        ip: true,
        userAgent: true,
        createdAt: true,
        adminUser: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    return this.page(
      rows,
      limit,
      (row) => ({
        id: row.id,
        adminUserId: row.adminUserId,
        adminUser: row.adminUser,
        action: row.action,
        method: row.method,
        path: row.path,
        statusCode: row.statusCode,
        requestId: row.requestId,
        ip: row.ip,
        userAgent: row.userAgent,
        createdAt: row.createdAt.toISOString(),
      }),
      (row) => ({ createdAt: row.createdAt.toISOString(), id: row.id }),
    );
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

  private buildUserWhere(query: Record<string, unknown>): Prisma.UserWhereInput {
    const and: Prisma.UserWhereInput[] = [];
    const search = this.optionalText(query.q);
    const city = this.optionalText(query.city);
    const status = this.optionalText(query.status);
    const verified = this.parseBoolean(query.verified);
    const plan = this.optionalText(query.plan);
    const createdFrom = this.parseDate(query.createdFrom, 'admin_invalid_created_from');
    const createdTo = this.parseDate(query.createdTo, 'admin_invalid_created_to');

    if (search) {
      and.push({
        OR: [
          { displayName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phoneNumber: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    if (city) {
      and.push({ profile: { is: { city } } });
    }
    if (status) {
      and.push({ status });
    }
    if (verified != null) {
      and.push({ verified });
    }
    if (plan) {
      and.push(this.planWhere(plan));
    }
    if (createdFrom || createdTo) {
      and.push({
        createdAt: {
          ...(createdFrom ? { gte: createdFrom } : {}),
          ...(createdTo ? { lte: createdTo } : {}),
        },
      });
    }

    and.push(this.createdAtCursorWhere(query.cursor));
    return and.length === 1 ? and[0] ?? {} : { AND: and };
  }

  private planWhere(plan: string): Prisma.UserWhereInput {
    const now = new Date();
    const activeSubscriptionWhere = {
      subscriptions: {
        some: {
          status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES] },
          OR: [
            { renewsAt: { gt: now } },
            { trialEndsAt: { gt: now } },
          ],
        },
      },
    } satisfies Prisma.UserWhereInput;

    if (plan === 'plus') {
      return activeSubscriptionWhere;
    }
    if (plan === 'free') {
      return { NOT: activeSubscriptionWhere };
    }
    if (plan === 'afterdark') {
      return { id: '__admin_afterdark_plan_not_available__' };
    }

    throw new ApiError(400, 'admin_user_plan_invalid', 'Plan filter is invalid');
  }

  private userListSelect() {
    return {
      id: true,
      displayName: true,
      email: true,
      phoneNumber: true,
      status: true,
      verified: true,
      createdAt: true,
      updatedAt: true,
      profile: {
        select: {
          city: true,
        },
      },
      subscriptions: {
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        select: {
          plan: true,
          status: true,
          startedAt: true,
          renewsAt: true,
          trialEndsAt: true,
        },
      },
      _count: {
        select: {
          hostedEvents: true,
          eventParticipants: true,
          reportsReceived: true,
        },
      },
    };
  }

  private userDetailSelect() {
    return {
      ...this.userListSelect(),
      suspendedAt: true,
      suspensionReason: true,
      profile: {
        select: {
          age: true,
          birthDate: true,
          gender: true,
          city: true,
          area: true,
          bio: true,
          vibe: true,
          rating: true,
          meetupCount: true,
          avatarUrl: true,
          updatedAt: true,
        },
      },
      settings: {
        select: {
          allowLocation: true,
          allowPush: true,
          allowContacts: true,
          autoSharePlans: true,
          hideExactLocation: true,
          quietHours: true,
          showAge: true,
          discoverable: true,
          darkMode: true,
          afterDarkAgeConfirmedAt: true,
          afterDarkCodeAcceptedAt: true,
          updatedAt: true,
        },
      },
      verification: {
        select: {
          status: true,
          selfieDone: true,
          documentDone: true,
          reviewedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    };
  }

  private mapListUser(row: UserListRow) {
    return {
      id: row.id,
      displayName: row.displayName,
      email: row.email,
      phoneNumber: row.phoneNumber,
      city: row.profile?.city ?? null,
      status: row.status,
      verified: row.verified,
      plan: this.mapAdminPlan(row.subscriptions[0] ?? null),
      hostedMeetupsCount: row._count.hostedEvents,
      joinedMeetupsCount: row._count.eventParticipants,
      reportsCount: row._count.reportsReceived,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapDetailUser(
    row: UserDetailRow,
    counts: { activeSessionsCount: number; openReportsCount: number },
  ) {
    const latestSubscription = row.subscriptions[0] ?? null;

    return {
      ...this.mapListUser(row),
      suspendedAt: row.suspendedAt?.toISOString() ?? null,
      suspensionReason: row.suspensionReason,
      profile: row.profile
        ? {
            ...row.profile,
            birthDate: row.profile.birthDate?.toISOString().slice(0, 10) ?? null,
            updatedAt: row.profile.updatedAt.toISOString(),
          }
        : null,
      settings: this.mapSettings(row.settings),
      verification: row.verification
        ? {
            ...row.verification,
            reviewedAt: row.verification.reviewedAt?.toISOString() ?? null,
            createdAt: row.verification.createdAt.toISOString(),
            updatedAt: row.verification.updatedAt.toISOString(),
          }
        : null,
      subscription: this.mapSubscription(latestSubscription),
      counts: {
        hostedMeetups: row._count.hostedEvents,
        joinedMeetups: row._count.eventParticipants,
        openReports: counts.openReportsCount,
        activeSessions: counts.activeSessionsCount,
      },
    };
  }

  private mapSettings(settings: Record<string, unknown> | null) {
    if (!settings) {
      return null;
    }

    return Object.fromEntries(
      Object.entries(settings).map(([key, value]) => [
        key,
        value instanceof Date ? value.toISOString() : value,
      ]),
    );
  }

  private mapSubscription(subscription: CurrentSubscription) {
    if (!subscription) {
      return {
        plan: null,
        status: 'inactive',
        startedAt: null,
        renewsAt: null,
        trialEndsAt: null,
      };
    }

    return {
      plan: subscription.plan,
      status: this.resolveSubscriptionStatus(subscription),
      startedAt: subscription.startedAt?.toISOString() ?? null,
      renewsAt: subscription.renewsAt?.toISOString() ?? null,
      trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
    };
  }

  private mapAdminPlan(subscription: CurrentSubscription): 'free' | 'plus' | 'afterdark' {
    return this.isSubscriptionActive(subscription) ? 'plus' : 'free';
  }

  private resolveSubscriptionStatus(subscription: CurrentSubscription) {
    if (!subscription) {
      return 'inactive';
    }
    if (this.isSubscriptionActive(subscription)) {
      if (subscription.trialEndsAt && subscription.trialEndsAt.getTime() > Date.now()) {
        return 'trial';
      }
      return 'active';
    }

    return 'inactive';
  }

  private isSubscriptionActive(subscription: CurrentSubscription) {
    if (!subscription) {
      return false;
    }

    const now = Date.now();
    if (subscription.trialEndsAt && subscription.trialEndsAt.getTime() > now) {
      return true;
    }
    if (subscription.renewsAt && subscription.renewsAt.getTime() > now) {
      return subscription.status !== 'inactive';
    }

    return false;
  }

  private async parseUserProfileUpdate(userId: string, body: Record<string, unknown>) {
    const data: Prisma.UserUpdateInput = {};

    if (this.hasOwn(body, 'displayName')) {
      data.displayName = this.requiredText(
        body.displayName,
        'admin_user_display_name_required',
      );
    }
    if (this.hasOwn(body, 'email')) {
      const email = this.nullableEmail(body.email);
      if (email) {
        await this.ensureEmailAvailable(userId, email);
      }
      data.email = email;
    }
    if (this.hasOwn(body, 'phoneNumber')) {
      const phoneNumber = this.nullableText(body.phoneNumber);
      if (phoneNumber) {
        await this.ensurePhoneAvailable(userId, phoneNumber);
      }
      data.phoneNumber = phoneNumber;
    }

    return data;
  }

  private parseProfileUpdate(body: Record<string, unknown>) {
    const source = this.objectValue(body.profile) ?? body;
    const data: AdminProfileTextUpdate = {};

    this.setNullableText(data, source, 'bio');
    this.setNullableText(data, source, 'city');
    this.setNullableText(data, source, 'avatarUrl');

    return data;
  }

  private async ensureEmailAvailable(userId: string, email: string) {
    const duplicate = await this.prismaService.client.user.findFirst({
      where: {
        email,
        NOT: { id: userId },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ApiError(409, 'admin_user_email_exists', 'Email is already used');
    }
  }

  private async ensurePhoneAvailable(userId: string, phoneNumber: string) {
    const duplicate = await this.prismaService.client.user.findFirst({
      where: {
        phoneNumber,
        NOT: { id: userId },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ApiError(409, 'admin_user_phone_exists', 'Phone number is already used');
    }
  }

  private async ensureUserExists(userId: string) {
    const user = await this.prismaService.client.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new ApiError(404, 'admin_user_not_found', 'User not found');
    }
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

  private startsAtCursorWhere(cursorValue: unknown) {
    const cursor = this.parseCursor(cursorValue);
    if (!cursor) {
      return {};
    }

    const startsAt = this.requiredCursorDate(cursor, 'startsAt');
    const id = this.requiredCursorText(cursor, 'id');
    return {
      OR: [
        { startsAt: { lt: startsAt } },
        { startsAt, id: { lt: id } },
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

  private mapMeetupStatus(row: {
    startsAt: Date;
    canceledAt: Date | null;
    liveState: { status: string } | null;
  }) {
    if (row.canceledAt) {
      return 'cancelled';
    }
    if (row.liveState?.status === 'live') {
      return 'live';
    }
    return row.startsAt.getTime() < Date.now() ? 'past' : 'upcoming';
  }

  private nullableEmail(value: unknown) {
    const text = this.nullableText(value);
    return text ? text.toLowerCase() : null;
  }

  private nullableText(value: unknown) {
    if (value == null) {
      return null;
    }
    if (typeof value !== 'string') {
      throw new ApiError(400, 'admin_invalid_text', 'Text is invalid');
    }

    const text = value.trim();
    return text === '' ? null : text;
  }

  private setNullableText(
    data: AdminProfileTextUpdate,
    source: Record<string, unknown>,
    field: keyof AdminProfileTextUpdate,
  ) {
    if (this.hasOwn(source, field)) {
      data[field] = this.nullableText(source[field]);
    }
  }

  private objectValue(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private hasOwn(source: Record<string, unknown>, key: string) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }
}

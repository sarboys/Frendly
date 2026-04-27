import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

@Injectable()
export class SafetyService {
  constructor(private readonly prismaService: PrismaService) {}

  async getSafety(userId: string) {
    const [user, settings, contacts, blocksCount, activeReportsCount, activeReportsAgainstUserCount] = await Promise.all([
      this.prismaService.client.user.findUnique({
        where: { id: userId },
        include: { profile: true, verification: true },
      }),
      this.prismaService.client.userSettings.findUnique({
        where: { userId },
      }),
      this.prismaService.client.trustedContact.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prismaService.client.userBlock.count({
        where: { userId },
      }),
      this.prismaService.client.userReport.count({
        where: {
          reporterId: userId,
          status: {
            in: ['open', 'in_review'],
          },
        },
      }),
      this.prismaService.client.userReport.count({
        where: {
          targetUserId: userId,
          status: {
            in: ['open', 'in_review'],
          },
        },
      }),
    ]);

    const trustScore = this.calculateTrustScore({
      verified: user?.verification?.status == 'verified',
      meetupCount: user?.profile?.meetupCount ?? 0,
      contactsCount: contacts.length,
      reportsCount: activeReportsAgainstUserCount,
    });

    return {
      trustScore,
      settings: settings,
      trustedContacts: contacts,
      blockedUsersCount: blocksCount,
      reportsCount: activeReportsCount,
    };
  }

  async updateSafety(userId: string, body: Record<string, unknown>) {
    return this.prismaService.client.userSettings.update({
      where: { userId },
      data: {
        autoSharePlans:
            typeof body.autoSharePlans === 'boolean' ? body.autoSharePlans : undefined,
        hideExactLocation:
            typeof body.hideExactLocation === 'boolean' ? body.hideExactLocation : undefined,
      },
    });
  }

  async listTrustedContacts(userId: string) {
    return this.prismaService.client.trustedContact.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createTrustedContact(userId: string, body: Record<string, unknown>) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const phoneNumber = typeof body.phoneNumber === 'string' ? body.phoneNumber.trim() : '';
    const mode = body.mode === 'sos_only' ? 'sos_only' : 'all_plans';

    if (name.length === 0 || phoneNumber.length === 0) {
      throw new ApiError(400, 'invalid_trusted_contact', 'name and phoneNumber are required');
    }

    const existing = await this.prismaService.client.trustedContact.findFirst({
      where: {
        userId,
        phoneNumber,
      },
      select: { id: true },
    });

    if (existing) {
      throw new ApiError(409, 'trusted_contact_duplicate', 'Trusted contact already exists');
    }

    try {
      return await this.prismaService.client.trustedContact.create({
        data: {
          userId,
          name,
          phoneNumber,
          mode,
        },
      });
    } catch (error) {
      if (this.isTrustedContactDuplicateError(error)) {
        throw new ApiError(409, 'trusted_contact_duplicate', 'Trusted contact already exists');
      }
      throw error;
    }
  }

  async listReports(userId: string) {
    const reports = await this.prismaService.client.userReport.findMany({
      where: { reporterId: userId },
      include: {
        targetUser: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reports.map((report) => ({
      id: report.id,
      targetUserId: report.targetUserId,
      reason: report.reason,
      details: report.details,
      status: report.status,
      blockRequested: report.blockRequested,
      createdAt: report.createdAt.toISOString(),
    }));
  }

  async createReport(userId: string, body: Record<string, unknown>) {
    const targetUserId = typeof body.targetUserId === 'string' ? body.targetUserId : '';
    const reason = typeof body.reason === 'string' ? body.reason : '';
    const details = typeof body.details === 'string' ? body.details.trim() : '';
    const blockRequested = body.blockRequested === true;

    if (targetUserId.length === 0 || reason.length === 0) {
      throw new ApiError(400, 'invalid_report_payload', 'targetUserId and reason are required');
    }

    if (targetUserId === userId) {
      throw new ApiError(400, 'self_report_not_allowed', 'Cannot report yourself');
    }

    if (details.length > 500) {
      throw new ApiError(400, 'invalid_report_payload', 'details is too long');
    }

    const targetUser = await this.prismaService.client.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!targetUser) {
      throw new ApiError(404, 'user_not_found', 'Target user not found');
    }

    const existing = await this.prismaService.client.userReport.findFirst({
      where: {
        reporterId: userId,
        targetUserId,
        status: {
          in: ['open', 'in_review'],
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new ApiError(409, 'duplicate_report', 'Report already exists');
    }

    const report = await this.prismaService.client.$transaction(async (tx) => {
      const reportLockKey = this.buildReportLockKey(userId, targetUserId);
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(${reportLockKey}::bigint)
      `;

      const activeReport = await tx.userReport.findFirst({
        where: {
          reporterId: userId,
          targetUserId,
          status: {
            in: ['open', 'in_review'],
          },
        },
        select: { id: true },
      });

      if (activeReport) {
        throw new ApiError(409, 'duplicate_report', 'Report already exists');
      }

      const created = await tx.userReport.create({
        data: {
          reporterId: userId,
          targetUserId,
          reason,
          details,
          blockRequested,
        },
      });

      if (blockRequested) {
        await tx.userBlock.upsert({
          where: {
            userId_blockedUserId: {
              userId,
              blockedUserId: targetUserId,
            },
          },
          update: {},
          create: {
            userId,
            blockedUserId: targetUserId,
          },
        });
      }

      return created;
    });

    return {
      id: report.id,
      status: report.status,
      blockRequested: report.blockRequested,
    };
  }

  async listBlocks(userId: string) {
    const blocks = await this.prismaService.client.userBlock.findMany({
      where: { userId },
      include: {
        blockedUser: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return blocks.map((block) => ({
      id: block.id,
      blockedUserId: block.blockedUserId,
      blockedUser: {
        id: block.blockedUser.id,
        displayName: block.blockedUser.displayName,
      },
      createdAt: block.createdAt.toISOString(),
    }));
  }

  async createBlock(userId: string, body: Record<string, unknown>) {
    const targetUserId =
      typeof body.targetUserId === 'string' ? body.targetUserId : '';

    if (targetUserId.length === 0) {
      throw new ApiError(400, 'invalid_block_payload', 'targetUserId is required');
    }

    if (targetUserId === userId) {
      throw new ApiError(400, 'self_block_not_allowed', 'Cannot block yourself');
    }

    const targetUser = await this.prismaService.client.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!targetUser) {
      throw new ApiError(404, 'user_not_found', 'Target user not found');
    }

    const block = await this.prismaService.client.userBlock.upsert({
      where: {
        userId_blockedUserId: {
          userId,
          blockedUserId: targetUserId,
        },
      },
      update: {},
      create: {
        userId,
        blockedUserId: targetUserId,
      },
    });

    return {
      id: block.id,
      blockedUserId: block.blockedUserId,
      createdAt: block.createdAt.toISOString(),
    };
  }

  async createSos(userId: string, body: Record<string, unknown>) {
    const eventId = typeof body.eventId === 'string' ? body.eventId : null;
    if (eventId != null) {
      const event = await this.prismaService.client.event.findUnique({
        where: { id: eventId },
        select: { id: true },
      });

      if (!event) {
        throw new ApiError(404, 'event_not_found', 'Event not found');
      }

      const participant = await this.prismaService.client.eventParticipant.findUnique({
        where: {
          eventId_userId: {
            eventId,
            userId,
          },
        },
      });

      if (!participant) {
        throw new ApiError(403, 'event_forbidden', 'You are not a participant of this event');
      }
    }

    throw new ApiError(
      503,
      'sos_delivery_unavailable',
      'SOS delivery is unavailable',
    );
  }

  private calculateTrustScore(params: {
    verified: boolean;
    meetupCount: number;
    contactsCount: number;
    reportsCount: number;
  }) {
    var score = 45;
    if (params.verified) score += 25;
    score += Math.max(0, Math.min(20, params.meetupCount * 2));
    score += Math.max(0, Math.min(10, params.contactsCount * 4));
    score -= Math.max(0, Math.min(12, params.reportsCount * 3));
    return Math.max(0, Math.min(100, score));
  }

  private isTrustedContactDuplicateError(error: unknown) {
    if (error == null || typeof error !== 'object') {
      return false;
    }

    const maybeError = error as {
      code?: unknown;
      meta?: { target?: unknown };
    };

    if (maybeError.code !== 'P2002') {
      return false;
    }

    const target = maybeError.meta?.target;
    if (target == null) {
      return true;
    }
    if (Array.isArray(target)) {
      return target.includes('userId') && target.includes('phoneNumber');
    }
    return (
      typeof target === 'string' &&
      target.includes('userId') &&
      target.includes('phoneNumber')
    );
  }

  private buildReportLockKey(userId: string, targetUserId: string) {
    const digest = createHash('sha256')
      .update(userId)
      .update('\0')
      .update(targetUserId)
      .digest();
    let value = 0;
    for (let index = 0; index < 6; index += 1) {
      value = value * 256 + digest[index]!;
    }
    return value;
  }
}

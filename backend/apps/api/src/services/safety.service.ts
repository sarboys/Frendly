import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

@Injectable()
export class SafetyService {
  constructor(private readonly prismaService: PrismaService) {}

  async getSafety(userId: string) {
    const [user, settings, contacts, blocksCount, reportsCount] = await Promise.all([
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
        where: { reporterId: userId },
      }),
    ]);

    const trustScore = this.calculateTrustScore({
      verified: user?.verification?.status == 'verified',
      meetupCount: user?.profile?.meetupCount ?? 0,
      contactsCount: contacts.length,
      reportsCount,
    });

    return {
      trustScore,
      settings: settings,
      trustedContacts: contacts,
      blockedUsersCount: blocksCount,
      reportsCount,
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

    return this.prismaService.client.trustedContact.create({
      data: {
        userId,
        name,
        phoneNumber,
        mode,
      },
    });
  }

  async listReports(userId: string) {
    return this.prismaService.client.userReport.findMany({
      where: { reporterId: userId },
      include: {
        targetUser: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createReport(userId: string, body: Record<string, unknown>) {
    const targetUserId = typeof body.targetUserId === 'string' ? body.targetUserId : '';
    const reason = typeof body.reason === 'string' ? body.reason : '';
    const details = typeof body.details === 'string' ? body.details.trim() : '';
    const blockRequested = body.blockRequested === true;

    if (targetUserId.length === 0 || reason.length === 0) {
      throw new ApiError(400, 'invalid_report_payload', 'targetUserId and reason are required');
    }

    const report = await this.prismaService.client.$transaction(async (tx) => {
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
    return this.prismaService.client.userBlock.findMany({
      where: { userId },
      include: {
        blockedUser: {
          include: { profile: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSos(userId: string, body: Record<string, unknown>) {
    const eventId = typeof body.eventId === 'string' ? body.eventId : null;
    const contacts = await this.prismaService.client.trustedContact.count({
      where: { userId },
    });

    return {
      ok: true,
      eventId,
      notifiedContacts: contacts,
    };
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
}

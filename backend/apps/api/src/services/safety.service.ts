import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { OUTBOX_EVENT_TYPES } from '@big-break/database';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

type TrustedContactChannel = 'phone' | 'telegram' | 'email';

@Injectable()
export class SafetyService {
  constructor(private readonly prismaService: PrismaService) {}

  async getSafety(userId: string) {
    const [user, settings, contacts, blocksCount, activeReportsCount, activeReportsAgainstUserCount] = await Promise.all([
      this.prismaService.client.user.findUnique({
        where: { id: userId },
        select: {
          profile: {
            select: {
              meetupCount: true,
            },
          },
          verification: {
            select: {
              status: true,
            },
          },
        },
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
    const channel = this.normalizeContactChannel(body.channel);
    const value = this.normalizeContactValue(body);
    const mode = body.mode === 'sos_only' ? 'sos_only' : 'all_plans';

    if (name.length === 0 || value.length === 0) {
      throw new ApiError(400, 'invalid_trusted_contact', 'name and value are required');
    }

    const existing = await this.prismaService.client.trustedContact.findFirst({
      where: {
        userId,
        channel,
        value,
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
          channel,
          value,
          phoneNumber: value,
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

  async deleteTrustedContact(userId: string, contactId: string) {
    if (contactId.length === 0) {
      throw new ApiError(400, 'invalid_trusted_contact', 'contactId is required');
    }

    const result = await this.prismaService.client.trustedContact.deleteMany({
      where: {
        id: contactId,
        userId,
      },
    });

    if (result.count === 0) {
      throw new ApiError(404, 'trusted_contact_not_found', 'Trusted contact not found');
    }

    return {
      id: contactId,
      deleted: true,
    };
  }

  async listReports(userId: string) {
    const reports = await this.prismaService.client.userReport.findMany({
      where: { reporterId: userId },
      select: {
        id: true,
        targetUserId: true,
        reason: true,
        details: true,
        status: true,
        blockRequested: true,
        createdAt: true,
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

    const [targetUser, existing] = await Promise.all([
      this.prismaService.client.user.findUnique({
        where: { id: targetUserId },
        select: { id: true },
      }),
      this.prismaService.client.userReport.findFirst({
        where: {
          reporterId: userId,
          targetUserId,
          status: {
            in: ['open', 'in_review'],
          },
        },
        select: { id: true },
      }),
    ]);

    if (!targetUser) {
      throw new ApiError(404, 'user_not_found', 'Target user not found');
    }

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
      select: {
        id: true,
        blockedUserId: true,
        createdAt: true,
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
    let eventTitle: string | null = null;

    if (eventId != null) {
      const [event, participant] = await Promise.all([
        this.prismaService.client.event.findUnique({
          where: { id: eventId },
          select: { id: true, title: true },
        }),
        this.prismaService.client.eventParticipant.findUnique({
          where: {
            eventId_userId: {
              eventId,
              userId,
            },
          },
          select: {
            eventId: true,
            userId: true,
          },
        }),
      ]);

      if (!event) {
        throw new ApiError(404, 'event_not_found', 'Event not found');
      }

      eventTitle = event.title;

      if (!participant) {
        throw new ApiError(403, 'event_forbidden', 'You are not a participant of this event');
      }
    }

    const [user, contacts] = await Promise.all([
      this.prismaService.client.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          displayName: true,
          phoneNumber: true,
        },
      }),
      this.prismaService.client.trustedContact.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    if (contacts.length === 0) {
      throw new ApiError(409, 'sos_contacts_required', 'Trusted contacts are required');
    }

    const recipients = contacts.map((contact) => {
      const channel = this.normalizeContactChannel(contact.channel);
      const value =
        typeof contact.value === 'string' && contact.value.length > 0
          ? contact.value
          : contact.phoneNumber;
      return {
        id: contact.id,
        name: contact.name,
        channel,
        value,
        mode: contact.mode,
      };
    });
    const displayName = user?.displayName ?? 'Frendly';
    const messagePreview =
      eventTitle == null
        ? `SOS от ${displayName}. Нужна помощь.`
        : `SOS от ${displayName}. Я на встрече «${eventTitle}», нужна помощь.`;

    const alert = await this.prismaService.client.$transaction(async (tx) => {
      const created = await tx.safetySosAlert.create({
        data: {
          userId,
          eventId,
          recipients,
          recipientsCount: recipients.length,
          messagePreview,
          status: 'queued',
        },
      });

      await tx.outboxEvent.createMany({
        data: recipients.map((recipient) => ({
          type: OUTBOX_EVENT_TYPES.safetySosDelivery,
          payload: {
            sosAlertId: created.id,
            userId,
            eventId,
            contactId: recipient.id,
            name: recipient.name,
            channel: recipient.channel,
            value: recipient.value,
            messagePreview,
          },
        })),
      });

      return created;
    });

    return {
      id: alert.id,
      eventId: alert.eventId,
      notifiedContactsCount: alert.recipientsCount,
      status: alert.status,
      createdAt: alert.createdAt.toISOString(),
    };
  }

  private normalizeContactChannel(value: unknown): TrustedContactChannel {
    if (value === 'telegram' || value === 'email') {
      return value;
    }
    return 'phone';
  }

  private normalizeContactValue(body: Record<string, unknown>) {
    const value = typeof body.value === 'string' ? body.value.trim() : '';
    if (value.length > 0) {
      return value;
    }
    return typeof body.phoneNumber === 'string' ? body.phoneNumber.trim() : '';
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
      return (
        (target.includes('userId') && target.includes('phoneNumber')) ||
        (target.includes('userId') && target.includes('channel') && target.includes('value'))
      );
    }
    return (
      typeof target === 'string' &&
      target.includes('userId') &&
      (target.includes('phoneNumber') ||
        (target.includes('channel') && target.includes('value')))
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

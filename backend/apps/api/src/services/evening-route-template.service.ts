import { Injectable } from '@nestjs/common';
import { OUTBOX_EVENT_TYPES } from '@big-break/database';
import {
  CreateEveningRouteTemplateSessionResponseDto,
  EveningRouteTemplateDetailDto,
  EveningRouteTemplateSessionDto,
  EveningRouteTemplateSummaryDto,
} from '@big-break/contracts';
import { randomBytes } from 'crypto';
import { ApiError } from '../common/api-error';
import { EveningAnalyticsService } from './evening-analytics.service';
import { PrismaService } from './prisma.service';

const TEMPLATE_SESSION_PRIVACY = ['open', 'request', 'invite'] as const;
type TemplateSessionPrivacy = (typeof TEMPLATE_SESSION_PRIVACY)[number];

@Injectable()
export class EveningRouteTemplateService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly analytics: EveningAnalyticsService,
  ) {}

  async listRouteTemplates(params: Record<string, unknown> = {}) {
    const city = this.optionalText(params.city) ?? 'Москва';
    const templates =
      await this.prismaService.client.eveningRouteTemplate.findMany({
        where: {
          status: 'published',
          city,
          currentRouteId: { not: null },
        },
        include: this.templateSummaryInclude(),
        orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
        take: this.parseLimit(params.limit),
      });

    return {
      items: templates
        .filter((template: any) => template.status === 'published')
        .filter((template: any) => template.currentRoute != null)
        .map((template: any) => this.mapTemplateSummary(template)),
    };
  }

  async getRouteTemplate(userId: string, templateId: string) {
    const template =
      await this.prismaService.client.eveningRouteTemplate.findFirst({
        where: {
          id: templateId,
          status: 'published',
          currentRouteId: { not: null },
        },
        include: this.templateSummaryInclude(),
      });

    if (!template?.currentRoute) {
      throw new ApiError(
        404,
        'route_template_not_found',
        'Route template not found',
      );
    }

    await this.analytics.track({
      name: 'route_template_viewed',
      userId,
      routeTemplateId: template.id,
      routeId: template.currentRoute.id,
      city: template.city,
      metadata: { surface: 'route_template_detail' },
    });

    return this.mapTemplateDetail(template);
  }

  async listTemplateSessions(
    templateId: string,
    params: Record<string, unknown> = {},
  ) {
    const template =
      await this.prismaService.client.eveningRouteTemplate.findFirst({
        where: {
          id: templateId,
          status: 'published',
        },
        select: { id: true },
      });

    if (!template) {
      throw new ApiError(
        404,
        'route_template_not_found',
        'Route template not found',
      );
    }

    const sessions = await this.prismaService.client.eveningSession.findMany({
      where: {
        routeTemplateId: templateId,
        phase: { in: ['scheduled', 'live'] },
      },
      include: {
        participants: {
          where: { status: 'joined' },
          select: { userId: true },
        },
      },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: this.parseLimit(params.limit),
    });

    return {
      items: sessions.map((session: any) => this.mapTemplateSession(session)),
    };
  }

  async createSessionFromTemplate(
    userId: string,
    templateId: string,
    body: Record<string, unknown> = {},
  ): Promise<CreateEveningRouteTemplateSessionResponseDto> {
    const template =
      await this.prismaService.client.eveningRouteTemplate.findFirst({
        where: {
          id: templateId,
          status: 'published',
          currentRouteId: { not: null },
        },
        include: {
          currentRoute: {
            include: {
              steps: {
                orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              },
            },
          },
        },
      });

    if (!template) {
      throw new ApiError(
        404,
        'route_template_not_found',
        'Route template not found',
      );
    }
    if (!template.currentRoute) {
      throw new ApiError(
        409,
        'route_template_current_route_missing',
        'Route template current route is missing',
      );
    }

    const startsAt = this.parseFutureDate(body.startsAt);
    const privacy = this.parsePrivacy(body.privacy);
    const capacity = this.parseSessionCapacity(body.capacity);
    const hostNote = this.optionalText(body.hostNote);
    await this.assertCanCreateTemplateSession({
      userId,
      templateId: template.id,
      startsAt,
      timezone: template.timezone,
      privacy,
    });

    const route = template.currentRoute;
    const routeId = template.currentRouteId;
    if (!routeId) {
      throw new ApiError(
        409,
        'route_template_current_route_missing',
        'Route template current route is missing',
      );
    }
    const now = new Date();
    const result = await this.prismaService.client.$transaction(async (tx) => {
      const chat = await tx.chat.create({
        data: {
          kind: 'meetup',
          origin: 'meetup',
          title: route.title,
          emoji: route.steps[0]?.emoji ?? '✨',
          meetupPhase: 'soon',
          meetupMode: 'hybrid',
          currentStep: null,
          meetupStartsAt: startsAt,
          meetupEndsAt: null,
        },
      });

      const session = await tx.eveningSession.create({
        data: {
          routeId,
          routeTemplateId: template.id,
          hostUserId: userId,
          chatId: chat.id,
          phase: 'scheduled',
          privacy,
          mode: 'hybrid',
          capacity,
          startsAt,
          currentStep: null,
          inviteToken: privacy === 'invite' ? this.createInviteToken() : null,
        },
      });

      await tx.chatMember.upsert({
        where: {
          chatId_userId: {
            chatId: chat.id,
            userId,
          },
        },
        create: {
          chatId: chat.id,
          userId,
        },
        update: {},
      });

      await tx.eveningSessionParticipant.upsert({
        where: {
          sessionId_userId: {
            sessionId: session.id,
            userId,
          },
        },
        create: {
          sessionId: session.id,
          userId,
          role: 'host',
          status: 'joined',
          joinedAt: now,
        },
        update: {
          role: 'host',
          status: 'joined',
          joinedAt: now,
          leftAt: null,
        },
      });

      if (route.steps.length > 0) {
        await tx.eveningSessionStepState.createMany({
          data: route.steps.map((step: any) => ({
            sessionId: session.id,
            stepId: step.id,
            status: 'upcoming',
          })),
          skipDuplicates: true,
        });
      }

      await this.createSystemMessage(tx, {
        chatId: chat.id,
        senderId: userId,
        clientMessageId: `route-template-session:${session.id}:publish`,
        text:
          hostNote ??
          `Встреча опубликована · ${route.steps.length} шагов · ${this.privacyLabel(privacy)}`,
        actorUserId: userId,
      });

      return { chat, session };
    });

    await this.analytics.track({
      name: 'route_session_created',
      userId,
      routeTemplateId: template.id,
      routeId,
      sessionId: result.session.id,
      city: template.city,
      metadata: { privacy, capacity },
    });

    return {
      sessionId: result.session.id,
      routeId,
      routeTemplateId: template.id,
      chatId: result.chat.id,
      phase: 'scheduled',
      chatPhase: 'soon',
      privacy,
      inviteToken: privacy === 'invite' ? result.session.inviteToken : null,
      mode: 'hybrid',
      currentStep: null,
      totalSteps: route.steps.length,
      currentPlace: null,
      startsAt: startsAt.toISOString(),
      endsAt: null,
      joinedCount: 1,
      maxGuests: capacity,
    };
  }

  private templateSummaryInclude() {
    return {
      currentRoute: {
        include: {
          steps: {
            orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
          },
        },
      },
      sessions: {
        where: {
          phase: { in: ['scheduled', 'live'] },
        },
        include: {
          participants: {
            where: { status: 'joined' },
            select: { userId: true },
          },
        },
        orderBy: [{ startsAt: 'asc' as const }, { id: 'asc' as const }],
        take: 3,
      },
    };
  }

  private mapTemplateSummary(template: any): EveningRouteTemplateSummaryDto {
    const route = template.currentRoute;
    const steps = route?.steps ?? [];

    return {
      id: template.id,
      routeId: route.id,
      title: route.title,
      blurb: route.blurb,
      city: template.city,
      area: template.area ?? route.area ?? null,
      badgeLabel: route.badgeLabel ?? null,
      coverUrl: null,
      vibe: route.vibe,
      budget: route.budget,
      durationLabel: route.durationLabel,
      totalPriceFrom: route.totalPriceFrom,
      stepsPreview: steps.slice(0, 3).map((step: any) => ({
        title: step.title,
        venue: step.venue,
        emoji: step.emoji,
      })),
      partnerOffersPreview: this.mapPartnerOffersPreview(steps),
      nearestSessions: (template.sessions ?? [])
        .slice(0, 3)
        .map((session: any) => this.mapTemplateSession(session)),
    };
  }

  private mapTemplateDetail(template: any): EveningRouteTemplateDetailDto {
    const summary = this.mapTemplateSummary(template);
    const route = template.currentRoute;

    return {
      ...summary,
      totalSavings: route.totalSavings,
      goal: route.goal,
      mood: route.mood,
      format: route.format,
      recommendedFor: route.recommendedFor ?? null,
      steps: (route.steps ?? []).map((step: any) => ({
        id: step.id,
        time: step.timeLabel,
        endTime: step.endTimeLabel ?? null,
        kind: step.kind,
        title: step.title,
        venue: step.venue,
        address: step.address,
        emoji: step.emoji,
        distance: step.distanceLabel,
        walkMin: step.walkMin ?? null,
        perk: step.perk ?? null,
        perkShort: step.perkShort ?? null,
        ticketPrice: step.ticketPrice ?? null,
        ticketCommission: step.ticketCommission ?? null,
        sponsored: step.sponsored,
        premium: step.premium,
        partnerId: step.partnerId ?? null,
        description: step.description ?? null,
        vibeTag: step.vibeTag ?? null,
        lat: step.lat,
        lng: step.lng,
        hasShareable: step.perk != null || step.ticketPrice != null,
        state: {
          perkUsed: false,
          ticketBought: false,
          sentToChat: false,
          chatMessageId: null,
        },
        venueId: step.venueId ?? null,
        partnerOfferId: step.partnerOfferId ?? null,
        offerTitle: step.offerTitleSnapshot ?? null,
        offerDescription: step.offerDescriptionSnapshot ?? null,
        offerTerms: step.offerTermsSnapshot ?? null,
        offerShortLabel: step.offerShortLabelSnapshot ?? null,
      })),
    };
  }

  private mapPartnerOffersPreview(steps: any[]) {
    const offers = new Map<
      string,
      { partnerId: string; title: string; shortLabel: string | null }
    >();
    for (const step of steps) {
      const partnerId = step.partnerId;
      const title = step.offerTitleSnapshot ?? step.perk;
      if (!partnerId || !title) {
        continue;
      }
      const key = step.partnerOfferId ?? `${partnerId}:${title}`;
      if (!offers.has(key)) {
        offers.set(key, {
          partnerId,
          title,
          shortLabel: step.offerShortLabelSnapshot ?? step.perkShort ?? null,
        });
      }
    }

    return [...offers.values()].slice(0, 3);
  }

  private mapTemplateSession(session: any): EveningRouteTemplateSessionDto {
    return {
      sessionId: session.id,
      startsAt: this.dateToIso(session.startsAt) ?? '',
      joinedCount: (session.participants ?? []).length,
      capacity: session.capacity,
    };
  }

  private async assertCanCreateTemplateSession(params: {
    userId: string;
    templateId: string;
    startsAt: Date;
    timezone: string;
    privacy: TemplateSessionPrivacy;
  }) {
    const [activeHostCount, sameTemplateDayCount, user] = await Promise.all([
      this.prismaService.client.eveningSession.count({
        where: {
          hostUserId: params.userId,
          phase: { in: ['scheduled', 'live'] },
        },
      }),
      this.prismaService.client.eveningSession.count({
        where: {
          hostUserId: params.userId,
          routeTemplateId: params.templateId,
          startsAt: this.localDayRangeFilter(params.startsAt, params.timezone),
          phase: { not: 'canceled' },
        },
      }),
      this.prismaService.client.user.findUnique({
        where: { id: params.userId },
        select: { id: true, createdAt: true },
      }),
    ]);

    if (!user) {
      throw new ApiError(404, 'user_not_found', 'User not found');
    }
    if (activeHostCount >= 3) {
      throw new ApiError(
        409,
        'evening_host_active_limit_reached',
        'Too many active Evening sessions',
      );
    }
    if (sameTemplateDayCount > 0) {
      throw new ApiError(
        409,
        'route_template_daily_duplicate',
        'Route template session already exists for this local date',
      );
    }

    const isNewAccount =
      Date.now() - user.createdAt.getTime() < 24 * 60 * 60 * 1000;
    if (!isNewAccount || params.privacy !== 'open') {
      return;
    }

    const publicDayCount =
      await this.prismaService.client.eveningSession.count({
        where: {
          hostUserId: params.userId,
          routeTemplateId: { not: null },
          privacy: 'open',
          startsAt: this.localDayRangeFilter(params.startsAt, params.timezone),
          phase: { not: 'canceled' },
        },
      });
    if (publicDayCount >= 1) {
      throw new ApiError(
        409,
        'new_account_public_route_daily_limit',
        'New accounts can create only one public route session per day',
      );
    }
  }

  private localDayRangeFilter(startsAt: Date, timezone: string) {
    const offsetMs = timezone === 'Europe/Moscow' ? 3 * 60 * 60 * 1000 : 0;
    const local = new Date(startsAt.getTime() + offsetMs);
    const startUtc = new Date(
      Date.UTC(
        local.getUTCFullYear(),
        local.getUTCMonth(),
        local.getUTCDate(),
      ) - offsetMs,
    );
    const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);

    return {
      gte: startUtc,
      lt: endUtc,
    };
  }

  private parseFutureDate(value: unknown) {
    if (typeof value !== 'string') {
      throw new ApiError(400, 'starts_at_required', 'Start time is required');
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new ApiError(400, 'starts_at_invalid', 'Start time is invalid');
    }
    if (date.getTime() <= Date.now()) {
      throw new ApiError(400, 'starts_at_in_past', 'Start time is in the past');
    }
    return date;
  }

  private parsePrivacy(value: unknown): TemplateSessionPrivacy {
    if (value === 'request' || value === 'invite') {
      return value;
    }
    return 'open';
  }

  private parseSessionCapacity(value: unknown) {
    const parsed =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number.parseInt(value, 10)
          : 8;
    if (!Number.isFinite(parsed)) {
      return 8;
    }
    return Math.min(12, Math.max(2, Math.floor(parsed)));
  }

  private createInviteToken() {
    return randomBytes(16).toString('hex');
  }

  private privacyLabel(privacy: TemplateSessionPrivacy) {
    if (privacy === 'request') {
      return 'по заявке';
    }
    if (privacy === 'invite') {
      return 'по приглашениям';
    }
    return 'открытая';
  }

  private async createSystemMessage(
    tx: any,
    params: {
      chatId: string;
      senderId: string;
      clientMessageId: string;
      text: string;
      actorUserId: string;
    },
  ) {
    const existing = await tx.message.findUnique({
      where: {
        chatId_clientMessageId: {
          chatId: params.chatId,
          clientMessageId: params.clientMessageId,
        },
      },
      select: { id: true },
    });
    if (existing) {
      return existing;
    }

    const now = new Date();
    const message = await tx.message.create({
      data: {
        chatId: params.chatId,
        senderId: params.senderId,
        text: params.text,
        clientMessageId: params.clientMessageId,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });
    const createdAt =
      message.createdAt instanceof Date ? message.createdAt : now;
    const payload = {
      id: message.id,
      chatId: params.chatId,
      clientMessageId: params.clientMessageId,
      senderId: params.senderId,
      senderName: 'Frendly',
      senderAvatarUrl: null,
      text: params.text,
      createdAt: createdAt.toISOString(),
      kind: 'system',
      replyTo: null,
      attachments: [],
    };
    const realtimeEvent = await tx.realtimeEvent.create({
      data: {
        chatId: params.chatId,
        eventType: 'message.created',
        payload,
      },
    });

    await tx.outboxEvent.createMany({
      data: [
        {
          type: OUTBOX_EVENT_TYPES.realtimePublish,
          payload: {
            type: 'message.created',
            payload: {
              ...payload,
              eventId: realtimeEvent.id.toString(),
            },
          },
        },
        {
          type: OUTBOX_EVENT_TYPES.chatUnreadFanout,
          payload: {
            chatId: params.chatId,
            actorUserId: params.actorUserId,
          },
        },
      ],
    });

    return message;
  }

  private parseLimit(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.min(50, Math.max(1, Math.floor(value)));
    }
    if (typeof value === 'string') {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) {
        return Math.min(50, Math.max(1, parsed));
      }
    }
    return 20;
  }

  private optionalText(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private dateToIso(value: Date | null | undefined) {
    return value instanceof Date ? value.toISOString() : null;
  }
}

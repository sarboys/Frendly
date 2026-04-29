import { Injectable } from '@nestjs/common';
import {
  EveningRouteTemplateDetailDto,
  EveningRouteTemplateSessionDto,
  EveningRouteTemplateSummaryDto,
} from '@big-break/contracts';
import { ApiError } from '../common/api-error';
import { EveningAnalyticsService } from './evening-analytics.service';
import { PrismaService } from './prisma.service';

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

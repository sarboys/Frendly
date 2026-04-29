import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  AdminEveningRouteRevisionInput,
  AdminEveningRouteTemplateDto,
  EveningRouteTemplateDetailDto,
} from '@big-break/contracts';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

@Injectable()
export class AdminEveningRouteService {
  constructor(private readonly prismaService: PrismaService) {}

  async listTemplates(query: Record<string, unknown> = {}) {
    const city = this.optionalText(query.city);
    const status = this.optionalText(query.status);
    const templates =
      await this.prismaService.client.eveningRouteTemplate.findMany({
        where: {
          ...(city ? { city } : {}),
          ...(status ? { status } : {}),
        },
        include: this.templateInclude(),
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: this.parseLimit(query.limit),
      });

    return {
      items: templates.map((template: any) => this.mapTemplate(template)),
    };
  }

  async createTemplate(body: Record<string, unknown>) {
    const template =
      await this.prismaService.client.eveningRouteTemplate.create({
        data: {
          source: this.optionalText(body.source) ?? 'team',
          status: 'draft',
          city: this.requiredText(body.city, 'route_template_city_required'),
          timezone: this.optionalText(body.timezone) ?? 'Europe/Moscow',
          area: this.optionalText(body.area),
          centerLat:
            body.centerLat == null
              ? null
              : this.parseCoordinate(
                  body.centerLat,
                  -90,
                  90,
                  'route_template_center_lat_invalid',
                ),
          centerLng:
            body.centerLng == null
              ? null
              : this.parseCoordinate(
                  body.centerLng,
                  -180,
                  180,
                  'route_template_center_lng_invalid',
                ),
          radiusMeters: this.optionalInt(body.radiusMeters),
          scheduledPublishAt: this.optionalDate(body.scheduledPublishAt),
          createdByAdminId: this.optionalText(body.createdByAdminId),
          updatedByAdminId: this.optionalText(body.updatedByAdminId),
        },
        include: this.templateInclude(),
      });

    return this.mapTemplate(template);
  }

  async getTemplate(templateId: string) {
    const template =
      await this.prismaService.client.eveningRouteTemplate.findUnique({
        where: { id: templateId },
        include: this.templateInclude(),
      });

    if (!template) {
      throw new ApiError(
        404,
        'route_template_not_found',
        'Route template not found',
      );
    }

    return this.mapTemplate(template);
  }

  async updateTemplate(templateId: string, body: Record<string, unknown>) {
    const data: Record<string, unknown> = {};
    this.setOptionalText(data, body, 'city');
    this.setOptionalText(data, body, 'timezone');
    this.setNullableText(data, body, 'area');
    this.setNullableText(data, body, 'updatedByAdminId');
    if (body.centerLat !== undefined) {
      data.centerLat =
        body.centerLat == null
          ? null
          : this.parseCoordinate(
              body.centerLat,
              -90,
              90,
              'route_template_center_lat_invalid',
            );
    }
    if (body.centerLng !== undefined) {
      data.centerLng =
        body.centerLng == null
          ? null
          : this.parseCoordinate(
              body.centerLng,
              -180,
              180,
              'route_template_center_lng_invalid',
            );
    }
    if (body.radiusMeters !== undefined) {
      data.radiusMeters = this.optionalInt(body.radiusMeters);
    }
    if (body.scheduledPublishAt !== undefined) {
      data.scheduledPublishAt = this.optionalDate(body.scheduledPublishAt);
    }

    const template =
      await this.prismaService.client.eveningRouteTemplate.update({
        where: { id: templateId },
        data,
        include: this.templateInclude(),
      });

    return this.mapTemplate(template);
  }

  async publishTemplate(templateId: string) {
    const now = new Date();
    const template =
      await this.prismaService.client.eveningRouteTemplate.findUnique({
        where: { id: templateId },
        select: { id: true, currentRouteId: true },
      });
    if (!template) {
      throw new ApiError(
        404,
        'route_template_not_found',
        'Route template not found',
      );
    }
    if (!template.currentRouteId) {
      throw new ApiError(
        409,
        'route_template_current_route_missing',
        'Route template current route is missing',
      );
    }
    const currentRouteId = template.currentRouteId;

    const updated = await this.prismaService.client.$transaction(async (tx) => {
      await tx.eveningRoute.update({
        where: { id: currentRouteId },
        data: {
          status: 'published',
          isCurated: true,
          publishedAt: now,
          archivedAt: null,
        },
      });

      return tx.eveningRouteTemplate.update({
        where: { id: templateId },
        data: {
          status: 'published',
          publishedAt: now,
          archivedAt: null,
        },
        include: this.templateInclude(),
      });
    });

    return this.mapTemplate(updated);
  }

  async archiveTemplate(templateId: string) {
    const now = new Date();
    const updated = await this.prismaService.client.$transaction(async (tx) => {
      const template = await tx.eveningRouteTemplate.findUnique({
        where: { id: templateId },
        select: { id: true, currentRouteId: true },
      });
      if (!template) {
        throw new ApiError(
          404,
          'route_template_not_found',
          'Route template not found',
        );
      }
      if (template.currentRouteId) {
        await tx.eveningRoute.update({
          where: { id: template.currentRouteId },
          data: {
            status: 'archived',
            archivedAt: now,
          },
        });
      }

      return tx.eveningRouteTemplate.update({
        where: { id: templateId },
        data: {
          status: 'archived',
          archivedAt: now,
        },
        include: this.templateInclude(),
      });
    });

    return this.mapTemplate(updated);
  }

  async createRevision(
    templateId: string,
    body: Record<string, unknown>,
  ): Promise<AdminEveningRouteTemplateDto> {
    const input = this.parseRevisionInput(body);

    const template = await this.prismaService.client.$transaction(async (tx) => {
      const currentTemplate = await tx.eveningRouteTemplate.findUnique({
        where: { id: templateId },
        include: {
          currentRoute: {
            select: {
              id: true,
              version: true,
            },
          },
        },
      });
      if (!currentTemplate) {
        throw new ApiError(
          404,
          'route_template_not_found',
          'Route template not found',
        );
      }

      const routeId = this.createId('route');
      const status =
        currentTemplate.status === 'published' ? 'published' : 'draft';
      const publishedAt =
        currentTemplate.status === 'published' ? new Date() : null;
      const version = (currentTemplate.currentRoute?.version ?? 0) + 1;
      const steps = await this.buildStepSnapshots(tx, routeId, input.steps);

      await tx.eveningRoute.create({
        data: {
          id: routeId,
          templateId,
          version,
          source: 'team',
          status,
          city: currentTemplate.city,
          timezone: currentTemplate.timezone,
          centerLat: currentTemplate.centerLat,
          centerLng: currentTemplate.centerLng,
          radiusMeters: currentTemplate.radiusMeters,
          isCurated: true,
          badgeLabel: input.badgeLabel,
          title: input.title,
          vibe: input.vibe,
          blurb: input.blurb,
          totalPriceFrom: input.totalPriceFrom,
          totalSavings: input.totalSavings,
          durationLabel: input.durationLabel,
          area: input.area,
          goal: input.goal,
          mood: input.mood,
          budget: input.budget,
          format: input.format,
          premium: false,
          recommendedFor: input.recommendedFor,
          hostsCount: 0,
          publishedAt,
        },
      });

      await tx.eveningRouteStep.createMany({
        data: steps,
      });

      return tx.eveningRouteTemplate.update({
        where: { id: templateId },
        data: {
          area: input.area,
          currentRouteId: routeId,
          status: currentTemplate.status,
          publishedAt: currentTemplate.publishedAt,
        },
        include: this.templateInclude(),
      });
    });

    return this.mapTemplate(template);
  }

  private async buildStepSnapshots(
    tx: any,
    routeId: string,
    steps: AdminEveningRouteRevisionInput['steps'],
  ) {
    const rows = [];
    for (const [index, step] of steps.entries()) {
      const venue = step.venueId
        ? await tx.venue.findUnique({
            where: { id: step.venueId },
            select: {
              id: true,
              partnerId: true,
              name: true,
              address: true,
              lat: true,
              lng: true,
            },
          })
        : null;
      if (step.venueId && !venue) {
        throw new ApiError(404, 'venue_not_found', 'Venue not found');
      }

      const offer = step.partnerOfferId
        ? await tx.partnerOffer.findUnique({
            where: { id: step.partnerOfferId },
            select: {
              id: true,
              partnerId: true,
              venueId: true,
              title: true,
              description: true,
              terms: true,
              shortLabel: true,
              validFrom: true,
              validTo: true,
            },
          })
        : null;
      if (step.partnerOfferId && !offer) {
        throw new ApiError(404, 'partner_offer_not_found', 'Partner offer not found');
      }
      if (offer && venue && offer.venueId !== venue.id) {
        throw new ApiError(
          400,
          'partner_offer_venue_mismatch',
          'Partner offer belongs to another venue',
        );
      }

      const venueName = venue?.name ?? step.venue;
      const address = venue?.address ?? step.address;
      const lat = venue?.lat ?? step.lat;
      const lng = venue?.lng ?? step.lng;
      if (!venueName || !address || lat == null || lng == null) {
        throw new ApiError(
          400,
          'route_step_venue_required',
          'Route step venue data is required',
        );
      }

      rows.push({
        id: this.createId('step'),
        routeId,
        venueId: venue?.id ?? null,
        partnerOfferId: offer?.id ?? null,
        sortOrder: step.sortOrder ?? index + 1,
        timeLabel: step.timeLabel,
        endTimeLabel: step.endTimeLabel ?? null,
        kind: step.kind,
        title: step.title,
        venue: venueName,
        address,
        emoji: step.emoji ?? '✨',
        distanceLabel: step.distanceLabel ?? '',
        walkMin: step.walkMin ?? null,
        perk: offer?.title ?? null,
        perkShort: offer?.shortLabel ?? null,
        ticketPrice: null,
        ticketCommission: null,
        sponsored: offer != null,
        premium: false,
        partnerId: offer?.partnerId ?? venue?.partnerId ?? null,
        description: step.description ?? null,
        vibeTag: null,
        lat,
        lng,
        offerTitleSnapshot: offer?.title ?? null,
        offerDescriptionSnapshot: offer?.description ?? null,
        offerTermsSnapshot: offer?.terms ?? null,
        offerShortLabelSnapshot: offer?.shortLabel ?? null,
        offerValidFromSnapshot: offer?.validFrom ?? null,
        offerValidToSnapshot: offer?.validTo ?? null,
        venueNameSnapshot: venue?.name ?? null,
        venueAddressSnapshot: venue?.address ?? null,
        venueLatSnapshot: venue?.lat ?? null,
        venueLngSnapshot: venue?.lng ?? null,
      });
    }

    return rows;
  }

  private parseRevisionInput(
    body: Record<string, unknown>,
  ): AdminEveningRouteRevisionInput {
    const rawSteps = Array.isArray(body.steps) ? body.steps : [];
    if (rawSteps.length === 0) {
      throw new ApiError(400, 'route_steps_required', 'Route steps are required');
    }

    return {
      title: this.requiredText(body.title, 'route_title_required'),
      vibe: this.requiredText(body.vibe, 'route_vibe_required'),
      blurb: this.requiredText(body.blurb, 'route_blurb_required'),
      totalPriceFrom: this.requiredInt(
        body.totalPriceFrom,
        'route_total_price_invalid',
      ),
      totalSavings: this.optionalInt(body.totalSavings) ?? 0,
      durationLabel: this.requiredText(
        body.durationLabel,
        'route_duration_required',
      ),
      area: this.requiredText(body.area, 'route_area_required'),
      goal: this.requiredText(body.goal, 'route_goal_required'),
      mood: this.requiredText(body.mood, 'route_mood_required'),
      budget: this.requiredText(body.budget, 'route_budget_required'),
      format: this.optionalText(body.format),
      recommendedFor: this.optionalText(body.recommendedFor),
      badgeLabel: this.optionalText(body.badgeLabel),
      steps: rawSteps.map((item, index) =>
        this.parseRevisionStep(item, index),
      ),
    };
  }

  private parseRevisionStep(
    value: unknown,
    index: number,
  ): AdminEveningRouteRevisionInput['steps'][number] {
    if (!value || typeof value !== 'object') {
      throw new ApiError(400, 'route_step_invalid', 'Route step is invalid');
    }
    const body = value as Record<string, unknown>;

    return {
      sortOrder: this.optionalInt(body.sortOrder) ?? index + 1,
      timeLabel: this.requiredText(body.timeLabel, 'route_step_time_required'),
      endTimeLabel: this.optionalText(body.endTimeLabel),
      kind: this.requiredText(body.kind, 'route_step_kind_required'),
      title: this.requiredText(body.title, 'route_step_title_required'),
      venueId: this.optionalText(body.venueId),
      partnerOfferId: this.optionalText(body.partnerOfferId),
      venue: this.optionalText(body.venue),
      address: this.optionalText(body.address),
      description: this.optionalText(body.description),
      emoji: this.optionalText(body.emoji),
      distanceLabel: this.optionalText(body.distanceLabel),
      walkMin: this.optionalInt(body.walkMin),
      lat:
        body.lat == null
          ? null
          : this.parseCoordinate(body.lat, -90, 90, 'route_step_lat_invalid'),
      lng:
        body.lng == null
          ? null
          : this.parseCoordinate(body.lng, -180, 180, 'route_step_lng_invalid'),
    };
  }

  private templateInclude() {
    return {
      currentRoute: {
        include: {
          steps: {
            orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
          },
        },
      },
      revisions: {
        select: {
          id: true,
        },
      },
    };
  }

  private mapTemplate(template: any): AdminEveningRouteTemplateDto {
    return {
      id: template.id,
      source: template.source,
      status: template.status,
      city: template.city,
      timezone: template.timezone,
      area: template.area ?? null,
      centerLat: template.centerLat ?? null,
      centerLng: template.centerLng ?? null,
      radiusMeters: template.radiusMeters ?? null,
      currentRouteId: template.currentRouteId ?? null,
      scheduledPublishAt: this.dateToIso(template.scheduledPublishAt),
      publishedAt: this.dateToIso(template.publishedAt),
      archivedAt: this.dateToIso(template.archivedAt),
      createdAt: this.requiredDateToIso(template.createdAt),
      updatedAt: this.requiredDateToIso(template.updatedAt),
      currentRoute: template.currentRoute
        ? this.mapCurrentRoute(template, template.currentRoute)
        : null,
      revisionCount: (template.revisions ?? []).length,
    };
  }

  private mapCurrentRoute(
    template: any,
    route: any,
  ): EveningRouteTemplateDetailDto {
    const steps = route.steps ?? [];
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
      totalSavings: route.totalSavings ?? 0,
      mood: route.mood ?? '',
      premium: route.premium ?? false,
      hostsCount: route.hostsCount ?? 0,
      stepsPreview: steps.slice(0, 4).map((step: any) => ({
        title: step.title,
        venue: step.venue,
        emoji: step.emoji,
        time: step.timeLabel ?? null,
        kind: step.kind ?? null,
      })),
      partnerOffersPreview: [],
      nearestSessions: [],
      goal: route.goal,
      format: route.format ?? null,
      recommendedFor: route.recommendedFor ?? null,
      steps: steps.map((step: any) => ({
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

  private createId(prefix: string) {
    return `${prefix}_${randomBytes(12).toString('hex')}`;
  }

  private parseLimit(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.min(100, Math.max(1, Math.floor(value)));
    }
    if (typeof value === 'string') {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) {
        return Math.min(100, Math.max(1, parsed));
      }
    }
    return 50;
  }

  private optionalText(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private requiredText(value: unknown, code: string) {
    const text = this.optionalText(value);
    if (!text) {
      throw new ApiError(400, code, 'Required text is missing');
    }
    return text;
  }

  private optionalInt(value: unknown) {
    if (value == null || value === '') {
      return null;
    }
    const parsed =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number.parseInt(value, 10)
          : Number.NaN;
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new ApiError(400, 'number_invalid', 'Number is invalid');
    }
    return Math.floor(parsed);
  }

  private requiredInt(value: unknown, code: string) {
    const parsed = this.optionalInt(value);
    if (parsed == null) {
      throw new ApiError(400, code, 'Number is required');
    }
    return parsed;
  }

  private parseCoordinate(
    value: unknown,
    min: number,
    max: number,
    code: string,
  ) {
    const parsed =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number.parseFloat(value)
          : Number.NaN;
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      throw new ApiError(400, code, 'Coordinate is invalid');
    }
    return parsed;
  }

  private optionalDate(value: unknown) {
    if (value == null || value === '') {
      return null;
    }
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      throw new ApiError(400, 'date_invalid', 'Date is invalid');
    }
    return date;
  }

  private setOptionalText(
    data: Record<string, unknown>,
    body: Record<string, unknown>,
    key: string,
  ) {
    if (body[key] !== undefined) {
      data[key] = this.requiredText(body[key], `${key}_required`);
    }
  }

  private setNullableText(
    data: Record<string, unknown>,
    body: Record<string, unknown>,
    key: string,
  ) {
    if (body[key] !== undefined) {
      data[key] = this.optionalText(body[key]);
    }
  }

  private dateToIso(value: Date | null | undefined) {
    return value instanceof Date ? value.toISOString() : null;
  }

  private requiredDateToIso(value: Date | null | undefined) {
    return this.dateToIso(value) ?? '';
  }
}

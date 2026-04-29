import { Injectable } from '@nestjs/common';
import { PartnerOfferCodeDto, PublicPartnerOfferCodeActivationDto } from '@big-break/contracts';
import { createHash, createHmac, randomBytes } from 'crypto';
import { ApiError } from '../common/api-error';
import { EveningAnalyticsService } from './evening-analytics.service';
import { PrismaService } from './prisma.service';

const DEFAULT_PUBLIC_SITE_URL = 'https://frendly.tech';
const DEFAULT_TIMEZONE = 'Europe/Moscow';
const OFFER_CODE_LENGTH = 13;
const OFFER_CODE_ID_BYTES = 16;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export type OfferCodeActivationMeta = {
  ip?: string | null;
  userAgent?: string | null;
};

type OfferCodeStatus = 'issued' | 'activated' | 'expired';

export function computeOfferCodeExpiresAt(params: {
  startsAt: Date;
  timezone?: string | null;
}) {
  const timezone = params.timezone?.trim() || DEFAULT_TIMEZONE;
  const localDate = getZonedDateParts(params.startsAt, timezone);
  return zonedLocalTimeToUtc(
    {
      year: localDate.year,
      month: localDate.month,
      day: localDate.day + 1,
      hour: 6,
      minute: 0,
      second: 0,
      millisecond: 0,
    },
    timezone,
  );
}

@Injectable()
export class PartnerOfferCodeService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly analytics: EveningAnalyticsService,
  ) {}

  async issueCode(
    userId: string,
    sessionId: string,
    stepId: string,
    offerId: string,
  ): Promise<PartnerOfferCodeDto> {
    const context = await this.loadIssueContext(
      userId,
      sessionId,
      stepId,
      offerId,
    );
    const uniqueWhere = {
      userId_sessionId_partnerId_stepId_offerId: {
        userId,
        sessionId,
        partnerId: context.offer.partnerId,
        stepId,
        offerId,
      },
    };
    const existing =
      await this.prismaService.client.partnerOfferCode.findUnique({
        where: uniqueWhere,
        include: this.codeSummaryInclude(),
      });

    if (existing) {
      await this.trackIssued(existing, true);
      return this.mapCode(existing);
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const id = this.createCodeId();
      const code = this.codeForId(id);

      try {
        const created =
          await this.prismaService.client.partnerOfferCode.create({
            data: {
              id,
              codeHash: this.hashCode(code),
              userId,
              sessionId,
              routeId: context.session.routeId,
              routeTemplateId: context.session.routeTemplateId ?? null,
              stepId,
              partnerId: context.offer.partnerId,
              venueId: context.offer.venueId,
              offerId,
              status: 'issued',
              expiresAt: computeOfferCodeExpiresAt({
                startsAt: context.session.startsAt,
                timezone: context.session.route.timezone,
              }),
            },
            include: this.codeSummaryInclude(),
          });
        await this.trackIssued(created, false);
        return this.mapCode(created);
      } catch (error) {
        if (!this.isUniqueConstraintError(error)) {
          throw error;
        }

        const duplicate =
          await this.prismaService.client.partnerOfferCode.findUnique({
            where: uniqueWhere,
            include: this.codeSummaryInclude(),
          });
        if (duplicate) {
          await this.trackIssued(duplicate, true);
          return this.mapCode(duplicate);
        }
      }
    }

    throw new ApiError(
      503,
      'partner_offer_code_generation_failed',
      'Partner offer code could not be generated',
    );
  }

  async getCodeStatus(
    userId: string,
    codeId: string,
  ): Promise<PartnerOfferCodeDto> {
    const code = await this.prismaService.client.partnerOfferCode.findFirst({
      where: {
        id: codeId,
        userId,
      },
      include: this.codeSummaryInclude(),
    });

    if (!code) {
      throw new ApiError(
        404,
        'partner_offer_code_not_found',
        'Partner offer code not found',
      );
    }

    await this.analytics.track({
      name: 'partner_offer_code_viewed',
      userId,
      routeTemplateId: code.routeTemplateId ?? null,
      routeId: code.routeId,
      sessionId: code.sessionId,
      partnerId: code.partnerId,
      venueId: code.venueId,
      offerId: code.offerId,
      metadata: { status: this.resolveStatus(code) },
    });

    return this.mapCode(code);
  }

  async activateCode(
    code: string,
    requestMeta: OfferCodeActivationMeta = {},
  ): Promise<PublicPartnerOfferCodeActivationDto> {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      return this.mapPublicResult('not_found', null);
    }

    const record = await this.prismaService.client.partnerOfferCode.findUnique({
      where: {
        codeHash: this.hashCode(normalizedCode),
      },
      include: this.codeSummaryInclude(),
    });

    if (!record) {
      return this.mapPublicResult('not_found', null);
    }

    const status = this.resolveStatus(record);
    if (status === 'activated') {
      return this.mapPublicResult('already_activated', record);
    }
    if (status === 'expired') {
      await this.markExpired(record.id);
      return this.mapPublicResult('expired', record);
    }

    const now = new Date();
    const updated =
      await this.prismaService.client.partnerOfferCode.updateMany({
        where: {
          id: record.id,
          status: 'issued',
          activatedAt: null,
        },
        data: {
          status: 'activated',
          activatedAt: now,
          activatedIpHash: this.hashNullable(requestMeta.ip),
          activatedUserAgent: this.normalizeUserAgent(requestMeta.userAgent),
        },
      });

    if (updated.count === 0) {
      const latest =
        await this.prismaService.client.partnerOfferCode.findUnique({
          where: { id: record.id },
          include: this.codeSummaryInclude(),
        });
      return this.mapPublicResult(
        this.resolveStatus(latest) === 'activated'
          ? 'already_activated'
          : 'expired',
        latest ?? record,
      );
    }

    const activated = {
      ...record,
      status: 'activated',
      activatedAt: now,
    };
    await this.analytics.track({
      name: 'partner_offer_activated',
      userId: record.userId,
      routeTemplateId: record.routeTemplateId ?? null,
      routeId: record.routeId,
      sessionId: record.sessionId,
      partnerId: record.partnerId,
      venueId: record.venueId,
      offerId: record.offerId,
    });

    return this.mapPublicResult('activated', activated);
  }

  private async loadIssueContext(
    userId: string,
    sessionId: string,
    stepId: string,
    offerId: string,
  ) {
    const session = await this.prismaService.client.eveningSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        routeId: true,
        routeTemplateId: true,
        hostUserId: true,
        startsAt: true,
        participants: {
          where: {
            userId,
            status: 'joined',
          },
          select: { userId: true },
        },
        route: {
          select: {
            timezone: true,
          },
        },
      },
    });

    if (!session) {
      throw new ApiError(
        404,
        'evening_session_not_found',
        'Evening session not found',
      );
    }
    if (session.hostUserId !== userId && session.participants.length === 0) {
      throw new ApiError(
        403,
        'evening_session_membership_required',
        'Evening session membership required',
      );
    }
    if (!session.startsAt) {
      throw new ApiError(
        409,
        'evening_session_start_missing',
        'Evening session start time is missing',
      );
    }

    const step = await this.prismaService.client.eveningRouteStep.findFirst({
      where: {
        id: stepId,
        routeId: session.routeId,
      },
      include: {
        partnerOffer: {
          include: {
            partner: true,
            venue: true,
          },
        },
      },
    });

    if (!step) {
      throw new ApiError(
        404,
        'evening_step_not_found',
        'Evening route step not found',
      );
    }
    if (step.partnerOfferId !== offerId || !step.partnerOffer) {
      throw new ApiError(
        404,
        'partner_offer_not_found',
        'Partner offer not found for this step',
      );
    }

    return {
      session: {
        ...session,
        startsAt: session.startsAt,
      },
      step,
      offer: step.partnerOffer,
    };
  }

  private codeSummaryInclude() {
    return {
      offer: {
        select: {
          title: true,
        },
      },
      venue: {
        select: {
          name: true,
        },
      },
      partner: {
        select: {
          name: true,
        },
      },
      step: {
        select: {
          offerTitleSnapshot: true,
          venueNameSnapshot: true,
        },
      },
    };
  }

  private mapCode(code: any): PartnerOfferCodeDto {
    return {
      id: code.id,
      codeUrl: `${this.publicSiteUrl()}/code/${this.codeForId(code.id)}`,
      status: this.resolveStatus(code),
      expiresAt: code.expiresAt.toISOString(),
      activatedAt: code.activatedAt?.toISOString() ?? null,
      offerTitle: code.step?.offerTitleSnapshot ?? code.offer?.title ?? '',
      venueName: code.step?.venueNameSnapshot ?? code.venue?.name ?? '',
      partnerName: code.partner?.name ?? '',
    };
  }

  private mapPublicResult(
    status: PublicPartnerOfferCodeActivationDto['status'],
    code: any | null,
  ): PublicPartnerOfferCodeActivationDto {
    return {
      status,
      offerTitle: code?.step?.offerTitleSnapshot ?? code?.offer?.title ?? null,
      venueName: code?.step?.venueNameSnapshot ?? code?.venue?.name ?? null,
      partnerName: code?.partner?.name ?? null,
      activatedAt: code?.activatedAt?.toISOString() ?? null,
    };
  }

  private resolveStatus(code: any): OfferCodeStatus {
    if (!code) {
      return 'expired';
    }
    if (code.status === 'activated') {
      return 'activated';
    }
    if (code.status === 'expired' || code.expiresAt.getTime() <= Date.now()) {
      return 'expired';
    }
    return 'issued';
  }

  private async markExpired(codeId: string) {
    await this.prismaService.client.partnerOfferCode.updateMany({
      where: {
        id: codeId,
        status: 'issued',
        activatedAt: null,
      },
      data: {
        status: 'expired',
      },
    });
  }

  private async trackIssued(code: any, reused: boolean) {
    await this.analytics.track({
      name: 'partner_offer_code_issued',
      userId: code.userId,
      routeTemplateId: code.routeTemplateId ?? null,
      routeId: code.routeId,
      sessionId: code.sessionId,
      partnerId: code.partnerId,
      venueId: code.venueId,
      offerId: code.offerId,
      metadata: {
        reused,
        status: this.resolveStatus(code),
      },
    });
  }

  private createCodeId() {
    return randomBytes(OFFER_CODE_ID_BYTES).toString('hex');
  }

  private codeForId(codeId: string) {
    return base32Encode(
      createHmac('sha256', this.secret()).update(codeId).digest(),
    ).slice(0, OFFER_CODE_LENGTH);
  }

  private hashCode(code: string) {
    return createHash('sha256')
      .update(`${this.secret()}:${code.trim().toUpperCase()}`)
      .digest('hex');
  }

  private hashNullable(value: string | null | undefined) {
    const normalized = value?.trim();
    if (!normalized) {
      return null;
    }
    return createHash('sha256')
      .update(`${this.secret()}:activation:${normalized}`)
      .digest('hex');
  }

  private normalizeUserAgent(value: string | null | undefined) {
    const normalized = value?.trim();
    return normalized ? normalized.slice(0, 512) : null;
  }

  private secret() {
    const secret =
      process.env.PARTNER_OFFER_CODE_SECRET?.trim() ||
      process.env.JWT_ACCESS_SECRET?.trim() ||
      process.env.JWT_REFRESH_SECRET?.trim();
    if (secret) {
      return secret;
    }
    if (process.env.NODE_ENV === 'production') {
      throw new ApiError(
        500,
        'partner_offer_code_secret_missing',
        'Partner offer code secret is missing',
      );
    }
    return 'dev-partner-offer-code-secret';
  }

  private publicSiteUrl() {
    return (process.env.PUBLIC_SITE_URL ?? DEFAULT_PUBLIC_SITE_URL).replace(
      /\/+$/,
      '',
    );
  }

  private isUniqueConstraintError(error: unknown) {
    return (error as { code?: string }).code === 'P2002';
  }
}

function getZonedDateParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
  };
}

function getZonedDateTimeParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

function zonedLocalTimeToUtc(
  local: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    millisecond: number;
  },
  timezone: string,
) {
  const localAsUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
    local.millisecond,
  );
  let candidate = new Date(localAsUtc);

  for (let index = 0; index < 3; index += 1) {
    const parts = getZonedDateTimeParts(candidate, timezone);
    const zoneAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      local.millisecond,
    );
    candidate = new Date(localAsUtc - (zoneAsUtc - candidate.getTime()));
  }

  return candidate;
}

function base32Encode(buffer: Buffer) {
  let output = '';
  let value = 0;
  let bits = 0;

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

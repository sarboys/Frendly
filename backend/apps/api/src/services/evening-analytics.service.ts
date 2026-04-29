import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

export type EveningAnalyticsTrackParams = {
  name: string;
  userId?: string | null;
  routeTemplateId?: string | null;
  routeId?: string | null;
  sessionId?: string | null;
  partnerId?: string | null;
  venueId?: string | null;
  offerId?: string | null;
  city?: string | null;
  metadata?: Prisma.InputJsonValue | null;
};

@Injectable()
export class EveningAnalyticsService {
  private readonly logger = new Logger(EveningAnalyticsService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async track(params: EveningAnalyticsTrackParams): Promise<void> {
    try {
      await this.prismaService.client.eveningAnalyticsEvent.create({
        data: {
          name: params.name,
          userId: params.userId ?? null,
          routeTemplateId: params.routeTemplateId ?? null,
          routeId: params.routeId ?? null,
          sessionId: params.sessionId ?? null,
          partnerId: params.partnerId ?? null,
          venueId: params.venueId ?? null,
          offerId: params.offerId ?? null,
          city: params.city ?? null,
          metadata: this.toJsonValue(params.metadata),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to track evening analytics event: name=${params.name} reason=${message}`,
      );
    }
  }

  private toJsonValue(value: Prisma.InputJsonValue | null | undefined) {
    return value == null ? undefined : value;
  }
}

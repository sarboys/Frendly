import { randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

type ShareTargetType = 'event' | 'evening_session';

const SHARE_SLUG_ALPHABET =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SHARE_SLUG_LENGTH = 10;
const SHARE_CREATE_ATTEMPTS = 5;
const DEFAULT_PUBLIC_SITE_URL = 'https://frendly.tech';
const DEFAULT_DEEP_LINK_SCHEME = 'frendly';

@Injectable()
export class SharesService {
  constructor(private readonly prismaService: PrismaService) {}

  async createShare(userId: string, body: Record<string, unknown>) {
    const targetType = this.parseTargetType(body.targetType);
    const targetId = this.parseTargetId(body.targetId);

    await this.assertTargetCanBeShared(targetType, targetId);

    const existing = await this.prismaService.client.publicShare.findFirst({
      where: {
        targetType,
        targetId,
      },
      select: {
        slug: true,
      },
    });

    if (existing) {
      return this.mapShareLink(existing.slug, targetType, targetId);
    }

    for (let attempt = 0; attempt < SHARE_CREATE_ATTEMPTS; attempt += 1) {
      const slug = this.createSlug();
      try {
        const created = await this.prismaService.client.publicShare.create({
          data: {
            slug,
            targetType,
            targetId,
            eventId: targetType === 'event' ? targetId : undefined,
            eveningSessionId:
              targetType === 'evening_session' ? targetId : undefined,
            createdById: userId,
          },
          select: {
            slug: true,
          },
        });

        return this.mapShareLink(created.slug, targetType, targetId);
      } catch (error) {
        if (!this.isUniqueConflict(error)) {
          throw error;
        }

        const raced = await this.prismaService.client.publicShare.findFirst({
          where: {
            targetType,
            targetId,
          },
          select: {
            slug: true,
          },
        });

        if (raced) {
          return this.mapShareLink(raced.slug, targetType, targetId);
        }
      }
    }

    throw new ApiError(
      503,
      'share_slug_unavailable',
      'Could not create public share link',
    );
  }

  async getPublicShare(slug: string) {
    const normalizedSlug = this.parseSlug(slug);
    const share = await this.prismaService.client.publicShare.findUnique({
      where: {
        slug: normalizedSlug,
      },
      include: {
        event: {
          include: {
            host: {
              select: {
                id: true,
                displayName: true,
                verified: true,
                profile: {
                  select: {
                    avatarUrl: true,
                  },
                },
              },
            },
            participants: {
              select: {
                userId: true,
                user: {
                  select: {
                    id: true,
                    displayName: true,
                    profile: {
                      select: {
                        avatarUrl: true,
                      },
                    },
                  },
                },
              },
              orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
              take: 6,
            },
            _count: {
              select: {
                participants: true,
              },
            },
          },
        },
        eveningSession: {
          include: {
            host: {
              select: {
                id: true,
                displayName: true,
                profile: {
                  select: {
                    avatarUrl: true,
                  },
                },
              },
            },
            route: {
              include: {
                steps: {
                  orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
                },
              },
            },
            participants: {
              where: {
                status: 'joined',
              },
              include: {
                user: {
                  select: {
                    id: true,
                    displayName: true,
                    profile: {
                      select: {
                        avatarUrl: true,
                      },
                    },
                  },
                },
              },
              orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
              take: 6,
            },
            _count: {
              select: {
                participants: true,
              },
            },
          },
        },
      },
    });

    if (!share) {
      throw new ApiError(404, 'share_not_found', 'Share link not found');
    }

    if (share.targetType === 'event') {
      if (!share.event || !this.isPublicEvent(share.event)) {
        throw new ApiError(404, 'share_not_found', 'Share link not found');
      }

      return this.mapEventShare(normalizedSlug, share.event);
    }

    if (share.targetType === 'evening_session') {
      if (
        !share.eveningSession ||
        !this.isPublicEveningSession(share.eveningSession)
      ) {
        throw new ApiError(404, 'share_not_found', 'Share link not found');
      }

      return this.mapEveningSessionShare(normalizedSlug, share.eveningSession);
    }

    throw new ApiError(404, 'share_not_found', 'Share link not found');
  }

  private async assertTargetCanBeShared(
    targetType: ShareTargetType,
    targetId: string,
  ) {
    if (targetType === 'event') {
      const event = await this.prismaService.client.event.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          visibilityMode: true,
          isAfterDark: true,
        },
      });

      if (!event) {
        throw new ApiError(404, 'share_target_not_found', 'Share target not found');
      }

      if (!this.isPublicEvent(event)) {
        throw new ApiError(
          409,
          'share_target_not_public',
          'This event cannot be shared publicly',
        );
      }

      return;
    }

    const session = await this.prismaService.client.eveningSession.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        phase: true,
        privacy: true,
      },
    });

    if (!session) {
      throw new ApiError(404, 'share_target_not_found', 'Share target not found');
    }

    if (!this.isPublicEveningSession(session)) {
      throw new ApiError(
        409,
        'share_target_not_public',
        'This evening session cannot be shared publicly',
      );
    }
  }

  private mapEventShare(slug: string, event: any) {
    return {
      ...this.mapShareLink(slug, 'event', event.id),
      kind: 'event' as const,
      title: event.title,
      emoji: event.emoji,
      description: event.description,
      startsAt: this.dateToIso(event.startsAt),
      durationMinutes: event.durationMinutes,
      place: event.place,
      area: null,
      vibe: event.vibe,
      partnerName: event.partnerName ?? null,
      partnerOffer: event.partnerOffer ?? null,
      capacity: event.capacity,
      host: {
        name: event.host?.displayName ?? 'Организатор',
        avatarUrl: event.host?.profile?.avatarUrl ?? null,
        verified: event.host?.verified ?? false,
      },
      people: {
        count: event._count?.participants ?? event.participants?.length ?? 0,
        preview: (event.participants ?? []).map((participant: any) => ({
          name: participant.user?.displayName ?? 'Гость',
          avatarUrl: participant.user?.profile?.avatarUrl ?? null,
        })),
      },
      route: null,
    };
  }

  private mapEveningSessionShare(slug: string, session: any) {
    const route = session.route;
    const steps = route?.steps ?? [];

    return {
      ...this.mapShareLink(slug, 'evening_session', session.id),
      kind: 'evening_session' as const,
      title: route?.title ?? 'Маршрут Frendly',
      emoji: steps[0]?.emoji ?? '✨',
      description: route?.blurb ?? '',
      startsAt: this.dateToIso(session.startsAt),
      durationMinutes: null,
      place: route?.area ?? null,
      area: route?.area ?? null,
      vibe: route?.vibe ?? null,
      partnerName: null,
      partnerOffer: null,
      capacity: session.capacity,
      host: {
        name: session.host?.displayName ?? 'Организатор',
        avatarUrl: session.host?.profile?.avatarUrl ?? null,
        verified: false,
      },
      people: {
        count: session._count?.participants ?? session.participants?.length ?? 0,
        preview: (session.participants ?? []).map((participant: any) => ({
          name: participant.user?.displayName ?? 'Гость',
          avatarUrl: participant.user?.profile?.avatarUrl ?? null,
        })),
      },
      route: {
        area: route?.area ?? null,
        durationLabel: route?.durationLabel ?? null,
        totalPriceFrom: route?.totalPriceFrom ?? null,
        totalSavings: route?.totalSavings ?? null,
        steps: steps.map((step: any) => ({
          id: step.id,
          time: step.timeLabel,
          endTime: step.endTimeLabel ?? null,
          title: step.title,
          venue: step.venue,
          address: step.address,
          emoji: step.emoji,
          description: step.description ?? null,
          distance: step.distanceLabel ?? null,
          walkMin: step.walkMin ?? null,
          perk: step.perkShort ?? step.perk ?? null,
          lat: step.lat,
          lng: step.lng,
        })),
      },
    };
  }

  private mapShareLink(
    slug: string,
    targetType: ShareTargetType,
    targetId: string,
  ) {
    const siteUrl = this.publicSiteUrl();
    const deepLinkScheme = this.deepLinkScheme();
    const appPath =
      targetType === 'event'
        ? `/event/${targetId}`
        : `/evening-preview/${targetId}`;

    return {
      slug,
      targetType,
      targetId,
      appPath,
      url: `${siteUrl}/${slug}`,
      deepLink: `${deepLinkScheme}://${appPath}`,
    };
  }

  private parseTargetType(value: unknown): ShareTargetType {
    if (value === 'event' || value === 'evening_session') {
      return value;
    }

    throw new ApiError(
      400,
      'invalid_share_target_type',
      'Share target type is invalid',
    );
  }

  private parseTargetId(value: unknown) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    throw new ApiError(
      400,
      'invalid_share_target_id',
      'Share target id is invalid',
    );
  }

  private parseSlug(value: string) {
    const slug = value.trim();
    if (!/^[0-9A-Za-z]{6,32}$/.test(slug)) {
      throw new ApiError(404, 'share_not_found', 'Share link not found');
    }

    return slug;
  }

  private isPublicEvent(event: { visibilityMode: string; isAfterDark: boolean }) {
    return event.visibilityMode === 'public' && event.isAfterDark !== true;
  }

  private isPublicEveningSession(session: { privacy: string; phase: string }) {
    return session.privacy !== 'invite' && session.phase !== 'canceled';
  }

  private createSlug() {
    const bytes = randomBytes(SHARE_SLUG_LENGTH);
    let slug = '';
    for (const byte of bytes) {
      slug += SHARE_SLUG_ALPHABET[byte % SHARE_SLUG_ALPHABET.length];
    }

    return slug;
  }

  private isUniqueConflict(error: unknown) {
    return (error as { code?: string }).code === 'P2002';
  }

  private publicSiteUrl() {
    const raw = process.env.PUBLIC_SITE_URL ?? DEFAULT_PUBLIC_SITE_URL;
    return raw.replace(/\/+$/, '');
  }

  private deepLinkScheme() {
    return process.env.APP_DEEP_LINK_SCHEME ?? DEFAULT_DEEP_LINK_SCHEME;
  }

  private dateToIso(value: Date | string | null | undefined) {
    if (value == null) {
      return null;
    }

    return value instanceof Date ? value.toISOString() : value;
  }
}

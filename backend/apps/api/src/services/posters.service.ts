import { Injectable } from '@nestjs/common';
import { Poster, PosterCategory, Prisma } from '@prisma/client';
import { decodeCursor, encodeCursor } from '@big-break/database';
import { ApiError } from '../common/api-error';
import { mapMediaResource } from '../common/media-presenters';
import { normalizeSearchQuery } from '../common/search-query';
import { PrismaService } from './prisma.service';

@Injectable()
export class PostersService {
  constructor(private readonly prismaService: PrismaService) {}

  async listPosters(params: {
    city?: string;
    category?: string;
    q?: string;
    featured?: string;
    cursor?: string;
    limit?: number;
  }) {
    const city = params.city?.trim() || 'Москва';
    const category = this.parseCategory(params.category);
    const query = normalizeSearchQuery(params.q);
    const featuredOnly = params.featured === 'true';
    const take = this.normalizeLimit(params.limit);
    const cursorPoster = await this.resolveCursor(params.cursor);
    const where: Prisma.PosterWhereInput = {
      city,
      ...(category ? { category } : {}),
      ...(featuredOnly ? { isFeatured: true } : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { venue: { contains: query, mode: 'insensitive' } },
              { address: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
              { provider: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const cursorWhere = this.buildCursorWhere(cursorPoster);

    const posters = await this.prismaService.client.poster.findMany({
      where: cursorWhere == null
          ? where
          : {
              AND: [where, cursorWhere],
            },
      include: {
        coverAsset: true,
      },
      orderBy: [{ isFeatured: 'desc' }, { startsAt: 'asc' }, { id: 'asc' }],
      take: take + 1,
    });
    const hasMore = posters.length > take;
    const page = hasMore ? posters.slice(0, take) : posters;
    const mapped = page.map((poster) => this.mapPoster(poster));

    return {
      items: mapped,
      nextCursor:
        hasMore && page.length > 0
            ? encodeCursor({ value: page[page.length - 1]!.id })
            : null,
    };
  }

  async getPosterDetail(posterId: string) {
    const poster = await this.prismaService.client.poster.findUnique({
      where: { id: posterId },
      include: {
        coverAsset: true,
      },
    });

    if (!poster) {
      throw new ApiError(404, 'poster_not_found', 'Poster not found');
    }

    return this.mapPoster(poster);
  }

  private parseCategory(raw?: string): PosterCategory | undefined {
    switch (raw) {
      case 'concert':
      case 'sport':
      case 'exhibition':
      case 'theatre':
      case 'standup':
      case 'festival':
      case 'cinema':
        return raw;
      default:
        return undefined;
    }
  }

  private normalizeTags(tags: Poster['tags']) {
    return Array.isArray(tags) ? tags.filter((item): item is string => typeof item === 'string') : [];
  }

  private normalizeLimit(limit?: number) {
    if (limit == null || !Number.isFinite(limit)) {
      return 24;
    }

    return Math.max(1, Math.min(Math.trunc(limit), 50));
  }

  private async resolveCursor(cursor?: string) {
    if (!cursor) {
      return null;
    }

    let cursorId: string | null = null;
    try {
      cursorId = decodeCursor(cursor)?.value ?? null;
    } catch {
      cursorId = cursor;
    }

    if (!cursorId) {
      return null;
    }

    return this.prismaService.client.poster.findUnique({
      where: { id: cursorId },
      select: {
        id: true,
        isFeatured: true,
        startsAt: true,
      },
    });
  }

  private buildCursorWhere(
    cursorPoster:
      | {
          id: string;
          isFeatured: boolean;
          startsAt: Date;
        }
      | null,
  ): Prisma.PosterWhereInput | null {
    if (!cursorPoster) {
      return null;
    }

    if (cursorPoster.isFeatured) {
      return {
        OR: [
          { isFeatured: false },
          {
            isFeatured: true,
            startsAt: {
              gt: cursorPoster.startsAt,
            },
          },
          {
            isFeatured: true,
            startsAt: cursorPoster.startsAt,
            id: {
              gt: cursorPoster.id,
            },
          },
        ],
      };
    }

    return {
      OR: [
        {
          isFeatured: false,
          startsAt: {
            gt: cursorPoster.startsAt,
          },
        },
        {
          isFeatured: false,
          startsAt: cursorPoster.startsAt,
          id: {
            gt: cursorPoster.id,
          },
        },
      ],
    };
  }

  private mapPoster(
    poster: Poster & {
      coverAsset?: {
        id: string;
        kind: string;
        mimeType: string;
        byteSize: number;
        durationMs: number | null;
        publicUrl: string | null;
      } | null;
    },
  ) {
    const cover = poster.coverAsset == null
      ? null
      : mapMediaResource(
          poster.coverAsset as Parameters<typeof mapMediaResource>[0],
          {
            visibility: 'public',
            url: poster.coverAsset.publicUrl,
            downloadUrl: poster.coverAsset.publicUrl,
          },
        );

    return {
      id: poster.id,
      category: poster.category,
      title: poster.title,
      emoji: poster.emoji,
      startsAt: poster.startsAt.toISOString(),
      date: poster.dateLabel,
      time: poster.timeLabel,
      venue: poster.venue,
      address: poster.address,
      distance: `${poster.distanceKm.toFixed(1)} км`,
      priceFrom: poster.priceFrom,
      ticketUrl: poster.ticketUrl,
      provider: poster.provider,
      tone: poster.tone,
      tags: this.normalizeTags(poster.tags),
      description: poster.description,
      isFeatured: poster.isFeatured,
      cover,
    };
  }
}

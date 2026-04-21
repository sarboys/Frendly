import { Injectable } from '@nestjs/common';
import { Poster, PosterCategory } from '@prisma/client';
import { ApiError } from '../common/api-error';
import { paginateArray } from '../common/pagination';
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
    const query = params.q?.trim().toLowerCase();
    const featuredOnly = params.featured === 'true';

    const posters = await this.prismaService.client.poster.findMany({
      where: {
        city,
        ...(category ? { category } : {}),
        ...(featuredOnly ? { isFeatured: true } : {}),
      },
      orderBy: [{ isFeatured: 'desc' }, { startsAt: 'asc' }, { id: 'asc' }],
    });

    const filtered = query
      ? posters.filter((poster) => this.buildHaystack(poster).includes(query))
      : posters;

    const mapped = filtered.map((poster) => this.mapPoster(poster));
    return paginateArray(mapped, params.limit ?? 24, (item) => item.id, params.cursor);
  }

  async getPosterDetail(posterId: string) {
    const poster = await this.prismaService.client.poster.findUnique({
      where: { id: posterId },
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

  private buildHaystack(poster: Poster) {
    return [
      poster.title,
      poster.venue,
      poster.address,
      poster.description,
      ...this.normalizeTags(poster.tags),
    ]
      .join(' ')
      .toLowerCase();
  }

  private normalizeTags(tags: Poster['tags']) {
    return Array.isArray(tags) ? tags.filter((item): item is string => typeof item === 'string') : [];
  }

  private mapPoster(poster: Poster) {
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
    };
  }
}

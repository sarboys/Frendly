import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

export type EveningRouteAiCandidateBrief = {
  city: string;
  categories?: string[];
  tags?: string[];
  requiredVenueIds?: string[];
  excludedVenueIds?: string[];
};

export type EveningRouteAiCandidateOffer = {
  id: string;
  partnerId: string;
  venueId: string;
  title: string;
  description: string;
  terms: string | null;
  shortLabel: string | null;
};

export type EveningRouteAiCandidateVenue = {
  id: string;
  partnerId: string | null;
  city: string;
  area: string | null;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  category: string;
  tags: string[];
  averageCheck: number | null;
  openingHours: unknown | null;
  offers: EveningRouteAiCandidateOffer[];
};

const TRUSTED_LEVELS = ['verified', 'partner_claimed'];
const CANDIDATE_LIMIT = 40;
const RAW_CANDIDATE_LIMIT = 160;

@Injectable()
export class EveningRouteAiCandidatesService {
  constructor(private readonly prismaService: PrismaService) {}

  async selectCandidates(
    brief: EveningRouteAiCandidateBrief,
  ): Promise<EveningRouteAiCandidateVenue[]> {
    const city = brief.city.trim();
    const requiredIds = new Set(normalizeList(brief.requiredVenueIds));
    const excludedIds = new Set(normalizeList(brief.excludedVenueIds));
    const categories = new Set(normalizeList(brief.categories));
    const tags = new Set(normalizeList(brief.tags));

    const venues = await this.prismaService.client.venue.findMany({
      where: {
        city,
        status: 'open',
        moderationStatus: 'approved',
        trustLevel: { in: TRUSTED_LEVELS },
        ...(excludedIds.size > 0 ? { id: { notIn: [...excludedIds] } } : {}),
      },
      include: {
        offers: {
          where: { status: 'active' },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        },
      },
      orderBy: [{ partnerId: 'desc' }, { name: 'asc' }, { id: 'asc' }],
      take: RAW_CANDIDATE_LIMIT,
    });

    const filtered = venues
      .map((venue: any) => this.mapVenue(venue))
      .filter((venue) => matchesCategoryAndTags(venue, categories, tags))
      .sort((left, right) => {
        const leftRequired = requiredIds.has(left.id) ? 0 : 1;
        const rightRequired = requiredIds.has(right.id) ? 0 : 1;
        if (leftRequired !== rightRequired) {
          return leftRequired - rightRequired;
        }
        return left.name.localeCompare(right.name, 'ru');
      });

    return filtered.slice(0, CANDIDATE_LIMIT);
  }

  private mapVenue(venue: any): EveningRouteAiCandidateVenue {
    return {
      id: venue.id,
      partnerId: venue.partnerId ?? null,
      city: venue.city,
      area: venue.area ?? null,
      name: venue.name,
      address: venue.address,
      lat: typeof venue.lat === 'number' ? venue.lat : null,
      lng: typeof venue.lng === 'number' ? venue.lng : null,
      category: venue.category,
      tags: normalizeList(venue.tags),
      averageCheck: venue.averageCheck ?? null,
      openingHours: venue.openingHours ?? null,
      offers: (venue.offers ?? []).map((offer: any) => ({
        id: offer.id,
        partnerId: offer.partnerId,
        venueId: offer.venueId,
        title: offer.title,
        description: offer.description,
        terms: offer.terms ?? null,
        shortLabel: offer.shortLabel ?? null,
      })),
    };
  }
}

function matchesCategoryAndTags(
  venue: EveningRouteAiCandidateVenue,
  categories: Set<string>,
  tags: Set<string>,
) {
  if (categories.size > 0 && !categories.has(normalizeToken(venue.category))) {
    return false;
  }
  if (tags.size === 0) {
    return true;
  }
  const venueTags = new Set(venue.tags.map(normalizeToken));
  return [...tags].some((tag) => venueTags.has(tag));
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === 'string' ? normalizeToken(item) : ''))
    .filter((item) => item.length > 0);
}

function normalizeToken(value: string) {
  return value.trim().toLowerCase();
}

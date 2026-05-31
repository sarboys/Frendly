import { Injectable, Optional } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { AfficheService } from './affiche.service';
import { AfterDarkService } from './after-dark.service';
import { EveningRouteTemplateService } from './evening-route-template.service';
import { EventsService } from './events.service';
import { RedisCacheService } from './redis-cache.service';

@Injectable()
export class SearchService {
  private readonly pendingSearchLoads = new Map<string, Promise<any>>();

  constructor(
    private readonly eventsService: EventsService,
    private readonly afterDarkService: AfterDarkService,
    private readonly routeTemplateService: EveningRouteTemplateService,
    private readonly afficheService: AfficheService,
    @Optional() private readonly redisCache?: RedisCacheService,
  ) {}

  async groupedSearch(userId: string, query: Record<string, unknown>) {
    const cacheKey = this.searchCacheKey(userId, query);
    const cached = await this.redisCache?.getJson(cacheKey);
    if (cached != null) {
      return cached;
    }

    const pending = this.pendingSearchLoads.get(cacheKey);
    if (pending != null) {
      return pending;
    }

    const loading = this.loadFreshGroupedSearch(userId, query)
      .then(async (response) => {
        await this.redisCache?.setJson(cacheKey, response, 30);
        return response;
      })
      .finally(() => {
        this.pendingSearchLoads.delete(cacheKey);
      });
    this.pendingSearchLoads.set(cacheKey, loading);

    return loading;
  }

  private async loadFreshGroupedSearch(userId: string, query: Record<string, unknown>) {
    const q = this.optionalText(query.q);
    const date = this.optionalText(query.date);
    const meetupsLimit = this.parseLimit(query.meetupsLimit, 4, 20);
    const eveningsLimit = this.parseLimit(query.eveningsLimit, 3, 20);
    const routesLimit = this.parseLimit(query.routesLimit, 3, 20);
    const afficheLimit = this.parseLimit(query.afficheLimit, 6, 24);

    const [meetups, evenings, routes, affiche] = await Promise.all([
      this.eventsService.listEvents(userId, {
        filter: 'nearby',
        q,
        lifestyle: this.optionalText(query.lifestyle),
        price: this.optionalText(query.price),
        gender: this.optionalText(query.gender),
        access: this.optionalText(query.access),
        date,
        limit: meetupsLimit,
      }),
      this.safeAfterDarkList(userId, {
        q,
        date,
        limit: eveningsLimit,
      }),
      this.routeTemplateService.listRouteTemplates(
        {
          city: this.optionalText(query.city) ?? 'Москва',
          q,
          limit: routesLimit,
        },
        userId,
      ),
      this.afficheService.listEvents({
        city: this.optionalText(query.city) ?? 'Москва',
        q,
        date,
        priceMode: this.optionalText(query.priceMode) ?? 'any',
        limit: afficheLimit,
      }),
    ]);

    return {
      meetups: meetups.items,
      evenings: evenings.items,
      routes: routes.items,
      affiche: affiche.items,
      nextCursors: {
        meetups: meetups.nextCursor ?? null,
        evenings: evenings.nextCursor ?? null,
        affiche: affiche.nextCursor ?? null,
      },
    };
  }

  private searchCacheKey(userId: string, query: Record<string, unknown>) {
    const fields = [
      'q',
      'date',
      'city',
      'lifestyle',
      'price',
      'gender',
      'access',
      'priceMode',
      'meetupsLimit',
      'eveningsLimit',
      'routesLimit',
      'afficheLimit',
    ];
    return `search:grouped:v1:${userId}:${fields
      .map((field) => `${field}=${this.optionalText(query[field]) ?? ''}`)
      .join('&')}`;
  }

  private async safeAfterDarkList(
    userId: string,
    params: { q?: string; date?: string; limit: number },
  ) {
    try {
      return await this.afterDarkService.listEvents(userId, params);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'after_dark_locked') {
        return {
          items: [],
          nextCursor: null,
        };
      }
      throw error;
    }
  }

  private optionalText(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : undefined;
  }

  private parseLimit(value: unknown, fallback: number, max: number) {
    const raw = typeof value === 'string' ? Number(value) : value;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      return fallback;
    }
    return Math.max(1, Math.min(Math.trunc(raw), max));
  }
}

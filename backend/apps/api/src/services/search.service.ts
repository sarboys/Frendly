import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { AfterDarkService } from './after-dark.service';
import { EveningRouteTemplateService } from './evening-route-template.service';
import { EventsService } from './events.service';
import { PostersService } from './posters.service';

@Injectable()
export class SearchService {
  constructor(
    private readonly eventsService: EventsService,
    private readonly afterDarkService: AfterDarkService,
    private readonly routeTemplateService: EveningRouteTemplateService,
    private readonly postersService: PostersService,
  ) {}

  async groupedSearch(userId: string, query: Record<string, unknown>) {
    const q = this.optionalText(query.q);
    const date = this.optionalText(query.date);
    const meetupsLimit = this.parseLimit(query.meetupsLimit, 4, 20);
    const eveningsLimit = this.parseLimit(query.eveningsLimit, 3, 20);
    const routesLimit = this.parseLimit(query.routesLimit, 3, 20);
    const postersLimit = this.parseLimit(query.postersLimit, 6, 24);

    const [meetups, evenings, routes, posters] = await Promise.all([
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
      this.postersService.listPosters({
        city: this.optionalText(query.city) ?? 'Москва',
        q,
        date,
        limit: postersLimit,
      }),
    ]);

    return {
      meetups: meetups.items,
      evenings: evenings.items,
      routes: routes.items,
      posters: posters.items,
      nextCursors: {
        meetups: meetups.nextCursor ?? null,
        evenings: evenings.nextCursor ?? null,
        posters: posters.nextCursor ?? null,
      },
    };
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

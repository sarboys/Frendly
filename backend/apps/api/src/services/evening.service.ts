import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OUTBOX_EVENT_TYPES } from '@big-break/database';
import { ApiError } from '../common/api-error';
import { mapMessage } from '../common/presenters';
import { PrismaService } from './prisma.service';

const EVENING_GOALS = [
  { key: 'newfriends', emoji: '👋', label: 'Новые друзья', blurb: 'Маршрут с группой' },
  { key: 'date', emoji: '💞', label: 'Свидание', blurb: 'Для двоих' },
  { key: 'company', emoji: '🥂', label: 'С моей компанией', blurb: 'С друзьями' },
  { key: 'quiet', emoji: '🌙', label: 'Тихий вечер', blurb: 'Сам(а) с собой' },
  { key: 'afterdark', emoji: '🔮', label: 'After Dark', blurb: '18+ закрытое' },
] as const;

const EVENING_MOODS = [
  { key: 'chill', emoji: '🌿', label: 'Спокойно', blurb: 'Уютно, без шума' },
  { key: 'social', emoji: '✨', label: 'Знакомства', blurb: 'Хочу новых людей' },
  { key: 'date', emoji: '🌹', label: 'Свидание', blurb: 'Камерно для двоих' },
  { key: 'wild', emoji: '🔥', label: 'Огонь', blurb: 'Танцы и драйв' },
  { key: 'afterdark', emoji: '🌙', label: 'After Dark', blurb: '18+ и приватно' },
] as const;

const EVENING_BUDGETS = [
  { key: 'free', label: 'Бесплатно', range: 'до 500 ₽' },
  { key: 'low', label: 'Лайт', range: '500-1500 ₽' },
  { key: 'mid', label: 'Средне', range: '1500-3000 ₽' },
  { key: 'high', label: 'Не считаю', range: '3000+ ₽' },
] as const;

const EVENING_FORMATS = [
  { key: 'bar', emoji: '🍷', label: 'Бары и вино' },
  { key: 'show', emoji: '🎤', label: 'Стендап / концерт' },
  { key: 'active', emoji: '🏃', label: 'Активно' },
  { key: 'culture', emoji: '🎨', label: 'Культура' },
  { key: 'mixed', emoji: '🎲', label: 'Смешать все' },
] as const;

const EVENING_AREAS = [
  { key: 'center', emoji: '🏛️', label: 'Центр' },
  { key: 'patriki', emoji: '🦢', label: 'Патриаршие' },
  { key: 'chistye', emoji: '🌳', label: 'Чистые пруды' },
  { key: 'gorky', emoji: '🎡', label: 'Парк Горького' },
  { key: 'kursk', emoji: '🚉', label: 'Курская' },
  { key: 'any', emoji: '🗺️', label: 'Не важно' },
] as const;

type EveningRouteWithSteps = Prisma.EveningRouteGetPayload<{
  include: {
    steps: true;
  };
}>;

type EveningStepWithRoute = Prisma.EveningRouteStepGetPayload<{
  include: {
    route: {
      select: {
        id: true;
        premium: true;
        chatId: true;
      };
    };
  };
}>;

type StepActionRecord = {
  stepId: string;
  perkUsedAt: Date | null;
  ticketBoughtAt: Date | null;
  sentToChatAt: Date | null;
  chatMessageId: string | null;
};

@Injectable()
export class EveningService {
  constructor(private readonly prismaService: PrismaService) {}

  getOptions() {
    return {
      goals: EVENING_GOALS,
      moods: EVENING_MOODS,
      budgets: EVENING_BUDGETS,
      formats: EVENING_FORMATS,
      areas: EVENING_AREAS,
    };
  }

  async resolveRoute(userId: string, body: Record<string, unknown>) {
    const goal = this.parseOption(body.goal, EVENING_GOALS, 'invalid_evening_goal');
    const mood = this.parseOption(body.mood, EVENING_MOODS, 'invalid_evening_mood');
    const budget = this.parseOption(body.budget, EVENING_BUDGETS, 'invalid_evening_budget');
    const format = this.parseOption(body.format, EVENING_FORMATS, 'invalid_evening_format');
    this.parseOption(body.area, EVENING_AREAS, 'invalid_evening_area');

    const routes = await this.findRouteCandidates({ goal, mood, budget, format });
    const selected = this.pickBestRoute(routes, { goal, mood, budget, format });

    if (!selected) {
      throw new ApiError(404, 'evening_route_not_found', 'Evening route not found');
    }

    return this.mapRouteForUser(userId, selected);
  }

  async getRoute(userId: string, routeId: string) {
    const route = await this.prismaService.client.eveningRoute.findUnique({
      where: { id: routeId },
      include: {
        steps: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
      },
    });

    if (!route) {
      throw new ApiError(404, 'evening_route_not_found', 'Evening route not found');
    }

    return this.mapRouteForUser(userId, route);
  }

  async markPerkUsed(userId: string, routeId: string, stepId: string) {
    const step = await this.loadStep(routeId, stepId);

    if (!step.perk) {
      throw new ApiError(409, 'evening_perk_not_available', 'Perk is not available for this step');
    }

    await this.assertRouteUnlocked(userId, step.route);

    const now = new Date();
    const action = await this.prismaService.client.userEveningStepAction.upsert({
      where: {
        userId_stepId: {
          userId,
          stepId,
        },
      },
      create: {
        userId,
        routeId,
        stepId,
        perkUsedAt: now,
      },
      update: {
        perkUsedAt: now,
      },
    });

    return this.mapActionResponse(stepId, action);
  }

  async markTicketBought(userId: string, routeId: string, stepId: string) {
    const step = await this.loadStep(routeId, stepId);

    if (step.ticketPrice == null) {
      throw new ApiError(409, 'evening_ticket_not_available', 'Ticket is not available for this step');
    }

    await this.assertRouteUnlocked(userId, step.route);

    const now = new Date();
    const action = await this.prismaService.client.userEveningStepAction.upsert({
      where: {
        userId_stepId: {
          userId,
          stepId,
        },
      },
      create: {
        userId,
        routeId,
        stepId,
        ticketBoughtAt: now,
      },
      update: {
        ticketBoughtAt: now,
      },
    });

    return this.mapActionResponse(stepId, action);
  }

  async shareStepToChat(userId: string, routeId: string, stepId: string) {
    const step = await this.loadStep(routeId, stepId);

    if (!step.perk && step.ticketPrice == null) {
      throw new ApiError(409, 'evening_share_not_available', 'Step cannot be shared to chat');
    }

    await this.assertRouteUnlocked(userId, step.route);

    const chatId = step.route.chatId;
    if (!chatId) {
      throw new ApiError(409, 'evening_route_chat_missing', 'Evening route chat is missing');
    }

    const previewText = this.buildSharePreview(step);
    const clientMessageId = `evening-share:${userId}:${stepId}`;
    const now = new Date();

    const result = await this.prismaService.client.$transaction(async (tx) => {
      const existingAction = await tx.userEveningStepAction.findUnique({
        where: {
          userId_stepId: {
            userId,
            stepId,
          },
        },
        select: {
          sentToChatAt: true,
          chatMessageId: true,
        },
      });

      if (existingAction?.sentToChatAt && existingAction.chatMessageId) {
        return {
          messageId: existingAction.chatMessageId,
          sentToChatAt: existingAction.sentToChatAt,
          alreadySent: true,
        };
      }

      await tx.chatMember.upsert({
        where: {
          chatId_userId: {
            chatId,
            userId,
          },
        },
        create: {
          chatId,
          userId,
        },
        update: {},
      });

      const message = await tx.message.create({
        data: {
          chatId,
          senderId: userId,
          text: previewText,
          clientMessageId,
        },
        include: {
          sender: {
            include: {
              profile: {
                select: {
                  avatarUrl: true,
                },
              },
            },
          },
          replyTo: {
            include: {
              sender: true,
              attachments: {
                include: {
                  mediaAsset: true,
                },
              },
            },
          },
          attachments: {
            include: {
              mediaAsset: true,
            },
          },
        },
      });

      await tx.chat.update({
        where: { id: chatId },
        data: { updatedAt: now },
      });

      const mappedMessage = mapMessage(message);
      const realtimeEvent = await tx.realtimeEvent.create({
        data: {
          chatId,
          eventType: 'message.created',
          payload: mappedMessage,
        },
      });
      const payload = {
        ...mappedMessage,
        eventId: realtimeEvent.id.toString(),
      };

      await tx.userEveningStepAction.upsert({
        where: {
          userId_stepId: {
            userId,
            stepId,
          },
        },
        create: {
          userId,
          routeId,
          stepId,
          sentToChatAt: now,
          chatMessageId: message.id,
        },
        update: {
          sentToChatAt: now,
          chatMessageId: message.id,
        },
      });

      await tx.outboxEvent.createMany({
        data: [
          {
            type: OUTBOX_EVENT_TYPES.realtimePublish,
            payload: {
              type: 'message.created',
              payload,
            },
          },
          {
            type: OUTBOX_EVENT_TYPES.chatUnreadFanout,
            payload: {
              chatId,
              actorUserId: userId,
            },
          },
        ],
      });

      return {
        messageId: message.id,
        sentToChatAt: now,
        alreadySent: false,
      };
    });

    return {
      stepId,
      sentToChat: true,
      sentToChatAt: result.sentToChatAt.toISOString(),
      chatId,
      messageId: result.messageId,
      previewText,
      alreadySent: result.alreadySent,
    };
  }

  async launchRoute(
    userId: string,
    routeId: string,
    body: Record<string, unknown> = {},
  ) {
    const route = await this.prismaService.client.eveningRoute.findUnique({
      where: { id: routeId },
      include: {
        steps: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
      },
    });

    if (!route) {
      throw new ApiError(404, 'evening_route_not_found', 'Evening route not found');
    }

    await this.assertRouteUnlocked(userId, route);

    const mode = this.parseLaunchMode(body.mode);
    const startDelayMin = this.parseStartDelay(body.startDelayMin);
    const startsAt = new Date(Date.now() + startDelayMin * 60000);

    const chatId = await this.prismaService.client.$transaction(async (tx) => {
      let activeChatId = route.chatId;

      if (!activeChatId) {
        const chat = await tx.chat.create({
          data: {
            kind: 'meetup',
            origin: 'meetup',
            title: route.title,
            emoji: '✨',
            meetupPhase: 'live',
            meetupMode: mode,
            currentStep: 1,
            meetupStartsAt: startsAt,
            meetupEndsAt: null,
          },
        });

        await tx.eveningRoute.update({
          where: { id: route.id },
          data: { chatId: chat.id },
        });

        activeChatId = chat.id;
      } else {
        await tx.chat.update({
          where: { id: activeChatId },
          data: {
            meetupPhase: 'live',
            meetupMode: mode,
            currentStep: 1,
            meetupStartsAt: startsAt,
            meetupEndsAt: null,
          },
        });
      }

      await tx.chatMember.upsert({
        where: {
          chatId_userId: {
            chatId: activeChatId,
            userId,
          },
        },
        create: {
          chatId: activeChatId,
          userId,
        },
        update: {},
      });

      return activeChatId;
    });

    return {
      routeId: route.id,
      chatId,
      phase: 'live',
      mode,
      currentStep: 1,
      totalSteps: route.steps.length,
      currentPlace: route.steps[0]?.venue ?? null,
      startsAt: startsAt.toISOString(),
      endsAt: null,
    };
  }

  async finishRoute(userId: string, routeId: string) {
    const route = await this.prismaService.client.eveningRoute.findUnique({
      where: { id: routeId },
      select: {
        id: true,
        premium: true,
        chatId: true,
      },
    });

    if (!route) {
      throw new ApiError(404, 'evening_route_not_found', 'Evening route not found');
    }
    if (!route.chatId) {
      throw new ApiError(409, 'evening_route_chat_missing', 'Evening route chat is missing');
    }

    await this.assertRouteUnlocked(userId, route);

    const finishedAt = new Date();
    await this.prismaService.client.chat.update({
      where: { id: route.chatId },
      data: {
        meetupPhase: 'done',
        currentStep: null,
        meetupEndsAt: finishedAt,
      },
    });

    return {
      routeId: route.id,
      chatId: route.chatId,
      phase: 'done',
      finishedAt: finishedAt.toISOString(),
    };
  }

  private async findRouteCandidates(params: {
    goal: string | null;
    mood: string | null;
    budget: string | null;
    format: string | null;
  }): Promise<EveningRouteWithSteps[]> {
    const or: Prisma.EveningRouteWhereInput[] = [];
    if (params.goal) {
      or.push({ goal: params.goal });
    }
    if (params.mood) {
      or.push({ mood: params.mood });
    }
    if (params.budget) {
      or.push({ budget: params.budget });
    }
    if (params.format) {
      or.push({ format: params.format });
    }

    const routes = await this.prismaService.client.eveningRoute.findMany({
      where: or.length > 0 ? { OR: or } : {},
      include: {
        steps: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
      },
      orderBy: [{ premium: 'asc' }, { id: 'asc' }],
      take: 20,
    }) as EveningRouteWithSteps[];

    if (routes.length > 0) {
      return routes;
    }

    return this.prismaService.client.eveningRoute.findMany({
      include: {
        steps: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
      },
      orderBy: [{ premium: 'asc' }, { id: 'asc' }],
      take: 1,
    }) as Promise<EveningRouteWithSteps[]>;
  }

  private pickBestRoute(
    routes: EveningRouteWithSteps[],
    params: {
      goal: string | null;
      mood: string | null;
      budget: string | null;
      format: string | null;
    },
  ) {
    return [...routes].sort((left, right) => {
      const scoreDelta = this.scoreRoute(right, params) - this.scoreRoute(left, params);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      if (left.premium !== right.premium) {
        return left.premium ? 1 : -1;
      }

      return left.id.localeCompare(right.id);
    })[0] ?? null;
  }

  private scoreRoute(
    route: EveningRouteWithSteps,
    params: {
      goal: string | null;
      mood: string | null;
      budget: string | null;
      format: string | null;
    },
  ) {
    return (
      (params.goal && route.goal === params.goal ? 4 : 0) +
      (params.mood && route.mood === params.mood ? 3 : 0) +
      (params.budget && route.budget === params.budget ? 2 : 0) +
      (params.format && route.format === params.format ? 1 : 0)
    );
  }

  private async mapRouteForUser(userId: string, route: EveningRouteWithSteps) {
    const actions = await this.prismaService.client.userEveningStepAction.findMany({
      where: {
        userId,
        routeId: route.id,
      },
      select: {
        stepId: true,
        perkUsedAt: true,
        ticketBoughtAt: true,
        sentToChatAt: true,
        chatMessageId: true,
      },
    });
    const actionByStepId = new Map(actions.map((action) => [action.stepId, action]));
    const locked = route.premium && !(await this.hasPremiumAccess(userId));

    return {
      id: route.id,
      title: route.title,
      vibe: route.vibe,
      blurb: route.blurb,
      totalPriceFrom: route.totalPriceFrom,
      totalSavings: route.totalSavings,
      durationLabel: route.durationLabel,
      area: route.area,
      goal: route.goal,
      mood: route.mood,
      budget: route.budget,
      format: route.format,
      premium: route.premium,
      locked,
      recommendedFor: route.recommendedFor,
      hostsCount: route.hostsCount,
      chatId: route.chatId,
      steps: route.steps.map((step) => this.mapStep(step, actionByStepId.get(step.id) ?? null)),
      userState: this.mapUserState(actions),
    };
  }

  private mapStep(
    step: EveningRouteWithSteps['steps'][number],
    action: StepActionRecord | null,
  ) {
    return {
      id: step.id,
      time: step.timeLabel,
      endTime: step.endTimeLabel,
      kind: step.kind,
      title: step.title,
      venue: step.venue,
      address: step.address,
      emoji: step.emoji,
      distance: step.distanceLabel,
      walkMin: step.walkMin,
      perk: step.perk,
      perkShort: step.perkShort,
      ticketPrice: step.ticketPrice,
      ticketCommission: step.ticketCommission,
      sponsored: step.sponsored,
      premium: step.premium,
      partnerId: step.partnerId,
      description: step.description,
      vibeTag: step.vibeTag,
      lat: step.lat,
      lng: step.lng,
      hasShareable: step.perk != null || step.ticketPrice != null,
      state: {
        perkUsed: action?.perkUsedAt != null,
        ticketBought: action?.ticketBoughtAt != null,
        sentToChat: action?.sentToChatAt != null,
        chatMessageId: action?.chatMessageId ?? null,
      },
    };
  }

  private mapUserState(actions: StepActionRecord[]) {
    return {
      usedPerkStepIds: actions
        .filter((action) => action.perkUsedAt != null)
        .map((action) => action.stepId),
      boughtTicketStepIds: actions
        .filter((action) => action.ticketBoughtAt != null)
        .map((action) => action.stepId),
      sentToChatStepIds: actions
        .filter((action) => action.sentToChatAt != null)
        .map((action) => action.stepId),
    };
  }

  private async loadStep(routeId: string, stepId: string): Promise<EveningStepWithRoute> {
    const step = await this.prismaService.client.eveningRouteStep.findFirst({
      where: {
        id: stepId,
        routeId,
      },
      include: {
        route: {
          select: {
            id: true,
            premium: true,
            chatId: true,
          },
        },
      },
    });

    if (!step) {
      throw new ApiError(404, 'evening_step_not_found', 'Evening route step not found');
    }

    return step;
  }

  private buildSharePreview(step: Pick<
    EveningStepWithRoute,
    'timeLabel' | 'endTimeLabel' | 'ticketPrice' | 'title' | 'perk' | 'perkShort' | 'venue'
  >) {
    const time = step.endTimeLabel
      ? `${step.timeLabel} - ${step.endTimeLabel}`
      : step.timeLabel;
    const what = step.ticketPrice != null
      ? `🎟 Билет ${step.ticketPrice} ₽ · ${step.title}`
      : `✨ Перк: ${step.perkShort ?? step.perk} · ${step.venue}`;

    return `${time} · ${what}`;
  }

  private mapActionResponse(
    stepId: string,
    action: {
      perkUsedAt: Date | null;
      ticketBoughtAt: Date | null;
      sentToChatAt: Date | null;
      chatMessageId: string | null;
    },
  ) {
    return {
      stepId,
      perkUsed: action.perkUsedAt != null,
      perkUsedAt: action.perkUsedAt?.toISOString() ?? null,
      ticketBought: action.ticketBoughtAt != null,
      ticketBoughtAt: action.ticketBoughtAt?.toISOString() ?? null,
      sentToChat: action.sentToChatAt != null,
      sentToChatAt: action.sentToChatAt?.toISOString() ?? null,
      chatMessageId: action.chatMessageId ?? null,
    };
  }

  private parseOption<T extends ReadonlyArray<{ key: string }>>(
    value: unknown,
    options: T,
    errorCode: string,
  ) {
    if (value == null || value === '') {
      return null;
    }

    if (typeof value !== 'string' || !options.some((option) => option.key === value)) {
      throw new ApiError(400, errorCode, 'Evening option is invalid');
    }

    return value;
  }

  private async assertRouteUnlocked(
    userId: string,
    route: Pick<EveningStepWithRoute['route'], 'id' | 'premium'>,
  ) {
    if (!route.premium) {
      return;
    }

    const hasPremium = await this.hasPremiumAccess(userId);
    if (!hasPremium) {
      throw new ApiError(403, 'evening_plus_required', 'Frendly Plus is required for this evening route');
    }
  }

  private parseLaunchMode(value: unknown) {
    if (value === 'auto' || value === 'manual' || value === 'hybrid') {
      return value;
    }
    return 'hybrid';
  }

  private parseStartDelay(value: unknown) {
    if (value === 15 || value === '15') {
      return 15;
    }
    if (value === 30 || value === '30') {
      return 30;
    }
    return 0;
  }

  private async hasPremiumAccess(userId: string) {
    const subscription = await this.prismaService.client.userSubscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        status: true,
        renewsAt: true,
        trialEndsAt: true,
      },
    });

    if (!subscription) {
      return false;
    }

    const now = Date.now();
    if (subscription.trialEndsAt && subscription.trialEndsAt.getTime() > now) {
      return true;
    }

    return (
      (subscription.status === 'active' || subscription.status === 'trial') &&
      subscription.renewsAt != null &&
      subscription.renewsAt.getTime() > now
    );
  }
}

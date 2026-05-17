import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OUTBOX_EVENT_TYPES } from '@big-break/database';
import { randomBytes } from 'crypto';
import { ApiError } from '../common/api-error';
import { mapMessage } from '../common/presenters';
import { EveningAnalyticsService } from './evening-analytics.service';
import { PrismaService } from './prisma.service';

const EVENING_PRIVACY = ['open', 'request', 'invite'] as const;
const EVENING_SESSION_PUBLIC_PHASES = ['scheduled', 'live'] as const;

type EveningPrivacy = (typeof EVENING_PRIVACY)[number];

const eveningRouteStepSelect = {
  id: true,
  timeLabel: true,
  endTimeLabel: true,
  kind: true,
  title: true,
  venue: true,
  address: true,
  emoji: true,
  distanceLabel: true,
  walkMin: true,
  perk: true,
  perkShort: true,
  ticketPrice: true,
  ticketCommission: true,
  ticketUrl: true,
  ticketSourceCode: true,
  ticketProvider: true,
  sponsored: true,
  premium: true,
  partnerId: true,
  venueId: true,
  partnerOfferId: true,
  offerTitleSnapshot: true,
  offerDescriptionSnapshot: true,
  offerTermsSnapshot: true,
  offerShortLabelSnapshot: true,
  description: true,
  vibeTag: true,
  lat: true,
  lng: true,
} satisfies Prisma.EveningRouteStepSelect;

const eveningRouteWithStepsSelect = {
  id: true,
  title: true,
  vibe: true,
  blurb: true,
  totalPriceFrom: true,
  totalSavings: true,
  durationLabel: true,
  area: true,
  goal: true,
  mood: true,
  budget: true,
  format: true,
  premium: true,
  recommendedFor: true,
  hostsCount: true,
  chatId: true,
  city: true,
  isCurated: true,
  badgeLabel: true,
  steps: {
    select: eveningRouteStepSelect,
    orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
  },
} satisfies Prisma.EveningRouteSelect;

type EveningRouteWithSteps = Prisma.EveningRouteGetPayload<{
  select: typeof eveningRouteWithStepsSelect;
}>;

type EveningRouteStepForResponse = Prisma.EveningRouteStepGetPayload<{
  select: typeof eveningRouteStepSelect;
}>;

type EveningStepWithRoute = {
  id: string;
  timeLabel: string;
  endTimeLabel: string | null;
  ticketPrice: number | null;
  title: string;
  perk: string | null;
  perkShort: string | null;
  venue: string;
  route: {
    id: string;
    premium: boolean;
    chatId: string | null;
  };
};

type StepActionRecord = {
  stepId: string;
  perkUsedAt: Date | null;
  ticketBoughtAt: Date | null;
  sentToChatAt: Date | null;
  chatMessageId: string | null;
};

type TomestoStepBackfill = {
  url: string;
  price: number | null;
  provider: string | null;
};

const eveningMessageMediaAssetSelect = {
  id: true,
  kind: true,
  status: true,
  mimeType: true,
  byteSize: true,
  durationMs: true,
  originalFileName: true,
  publicUrl: true,
  waveform: true,
} satisfies Prisma.MediaAssetSelect;

const eveningMessageSelect = {
  id: true,
  chatId: true,
  senderId: true,
  text: true,
  clientMessageId: true,
  createdAt: true,
  sender: {
    select: {
      displayName: true,
      profile: {
        select: {
          avatarUrl: true,
        },
      },
    },
  },
  attachments: {
    select: {
      mediaAsset: {
        select: eveningMessageMediaAssetSelect,
      },
    },
  },
} satisfies Prisma.MessageSelect;

@Injectable()
export class EveningService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly analytics?: EveningAnalyticsService,
  ) {}

  async getRoute(userId: string, routeId: string) {
    const route = await this.prismaService.client.eveningRoute.findUnique({
      where: { id: routeId },
      select: eveningRouteWithStepsSelect,
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
      select: {
        perkUsedAt: true,
        ticketBoughtAt: true,
        sentToChatAt: true,
        chatMessageId: true,
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
      select: {
        perkUsedAt: true,
        ticketBoughtAt: true,
        sentToChatAt: true,
        chatMessageId: true,
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
        select: eveningMessageSelect,
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
    const route = await this.loadEveningRouteTemplate(routeId);

    if (!route) {
      throw new ApiError(404, 'evening_route_not_found', 'Evening route not found');
    }

    await this.assertRouteUnlocked(userId, route);

    const mode = this.parseLaunchMode(body.mode);
    const startDelayMin = this.parseStartDelay(body.startDelayMin);
    const privacy = this.parsePrivacy(body.privacy);
    const capacity = this.parseCapacity(body.maxGuests ?? body.capacity);
    const startsAt = new Date(Date.now() + startDelayMin * 60000);
    const now = new Date();

    const result = await this.prismaService.client.$transaction(async (tx) => {
      const chat = await tx.chat.create({
        data: {
          kind: 'meetup',
          origin: 'meetup',
          title: route.title,
          emoji: route.steps[0]?.emoji ?? '✨',
          meetupPhase: 'soon',
          meetupMode: mode,
          currentStep: null,
          meetupStartsAt: startsAt,
          meetupEndsAt: null,
        },
      });

      const session = await tx.eveningSession.create({
        data: {
          routeId: route.id,
          hostUserId: userId,
          chatId: chat.id,
          phase: 'scheduled',
          privacy,
          mode,
          capacity,
          startsAt,
          currentStep: null,
          inviteToken: privacy === 'invite' ? this.createInviteToken() : null,
        },
      });

      await tx.chatMember.upsert({
        where: {
          chatId_userId: {
            chatId: chat.id,
            userId,
          },
        },
        create: {
          chatId: chat.id,
          userId,
        },
        update: {},
      });

      await tx.eveningSessionParticipant.upsert({
        where: {
          sessionId_userId: {
            sessionId: session.id,
            userId,
          },
        },
        create: {
          sessionId: session.id,
          userId,
          role: 'host',
          status: 'joined',
          joinedAt: now,
        },
        update: {
          role: 'host',
          status: 'joined',
          joinedAt: now,
          leftAt: null,
        },
      });

      if (route.steps.length > 0) {
        await tx.eveningSessionStepState.createMany({
          data: route.steps.map((step) => ({
            sessionId: session.id,
            stepId: step.id,
            status: 'upcoming',
          })),
          skipDuplicates: true,
        });
      }

      await this.createSystemMessage(tx, {
        chatId: chat.id,
        senderId: userId,
        clientMessageId: `evening-session:${session.id}:publish`,
        text: `Вечер опубликован · ${route.steps.length} шагов · ${this.privacyLabel(privacy)}. Live запустишь из чата`,
        actorUserId: userId,
      });

      return { chat, session };
    });

    return {
      sessionId: result.session.id,
      routeId: route.id,
      chatId: result.chat.id,
      phase: 'scheduled',
      chatPhase: 'soon',
      privacy,
      inviteToken: privacy === 'invite' ? result.session.inviteToken : null,
      mode,
      currentStep: null,
      totalSteps: route.steps.length,
      currentPlace: null,
      startsAt: startsAt.toISOString(),
      endsAt: null,
      joinedCount: 1,
      maxGuests: capacity,
    };
  }

  async listSessions(userId: string, params: Record<string, unknown> = {}) {
    const limit = this.normalizeSessionLimit(params.limit);
    const city = this.optionalText(params.city);
    const where: Prisma.EveningSessionWhereInput = {
      phase: {
        in: [...EVENING_SESSION_PUBLIC_PHASES],
      },
    };
    if (city) {
      where.route = {
        is: {
          city,
        },
      };
    }
    const sessions = await this.prismaService.client.eveningSession.findMany({
      where,
      include: this.sessionInclude(userId, { currentUserRequestOnly: true }),
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });

    return {
      items: sessions.map((session) => this.mapSession(session, userId)),
    };
  }

  async getSession(userId: string, sessionId: string) {
    const session = await this.prismaService.client.eveningSession.findUnique({
      where: { id: sessionId },
      include: this.sessionInclude(userId, { currentUserRequestOnly: true }),
    });

    if (!session) {
      throw new ApiError(404, 'evening_session_not_found', 'Evening session not found');
    }

    if (session.hostUserId !== userId) {
      return this.mapSession(session, userId);
    }

    const pendingRequests =
      await this.prismaService.client.eveningSessionJoinRequest.findMany({
        where: {
          sessionId: session.id,
          status: 'requested',
        },
        select: {
          id: true,
          userId: true,
          status: true,
          note: true,
          createdAt: true,
          user: {
            select: {
              displayName: true,
            },
          },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });

    return this.mapSession(
      {
        ...session,
        joinRequests: pendingRequests,
      },
      userId,
    );
  }

  async startSession(userId: string, sessionId: string) {
    const session = await this.prismaService.client.eveningSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        routeId: true,
        chatId: true,
        hostUserId: true,
        phase: true,
        currentStep: true,
        startsAt: true,
        route: {
          select: {
            steps: {
              select: {
                id: true,
                venue: true,
                endTimeLabel: true,
              },
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            },
          },
        },
      },
    });

    if (!session) {
      throw new ApiError(404, 'evening_session_not_found', 'Evening session not found');
    }
    this.assertSessionHost(userId, session);
    if (session.phase === 'done' || session.phase === 'canceled') {
      throw new ApiError(409, 'evening_session_finished', 'Evening session is finished');
    }
    if (session.phase === 'live') {
      const currentStep =
        this.normalizeSessionCurrentStep(
          session.currentStep,
          session.route.steps.length,
        ) ?? 1;
      return {
        sessionId: session.id,
        routeId: session.routeId,
        chatId: session.chatId,
        phase: 'live',
        currentStep,
        totalSteps: session.route.steps.length,
        currentPlace: session.route.steps[currentStep - 1]?.venue ?? null,
        startsAt: (session.startsAt ?? new Date()).toISOString(),
      };
    }

    const now = new Date();
    await this.prismaService.client.$transaction(async (tx) => {
      await tx.eveningSession.update({
        where: { id: session.id },
        data: {
          phase: 'live',
          startedAt: now,
          currentStep: 1,
        },
      });

      await tx.chat.update({
        where: { id: session.chatId },
        data: {
          meetupPhase: 'live',
          currentStep: 1,
          meetupStartsAt: session.startsAt ?? now,
          meetupEndsAt: null,
        },
      });

      if (session.route.steps[0]) {
        await tx.eveningSessionStepState.updateMany({
          where: {
            sessionId: session.id,
            stepId: session.route.steps[0].id,
          },
          data: {
            status: 'current',
            startedAt: now,
          },
        });
      }

      await this.createSystemMessage(tx, {
        chatId: session.chatId,
        senderId: userId,
        clientMessageId: `evening-session:${session.id}:start`,
        text: `Live запущен · шаг 1/${session.route.steps.length}`,
        actorUserId: userId,
      });
      await this.createChatUpdatedEvent(tx, {
        chatId: session.chatId,
        sessionId: session.id,
        routeId: session.routeId,
        phase: 'live',
        currentStep: 1,
        totalSteps: session.route.steps.length,
        currentPlace: session.route.steps[0]?.venue ?? null,
        endTime: session.route.steps[0]?.endTimeLabel ?? null,
      });
    });

    return {
      sessionId: session.id,
      routeId: session.routeId,
      chatId: session.chatId,
      phase: 'live',
      currentStep: 1,
      totalSteps: session.route.steps.length,
      currentPlace: session.route.steps[0]?.venue ?? null,
      startsAt: (session.startsAt ?? now).toISOString(),
    };
  }

  async joinSession(
    userId: string,
    sessionId: string,
    body: Record<string, unknown> = {},
  ) {
    const session = await this.prismaService.client.eveningSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        routeTemplateId: true,
        routeId: true,
        chatId: true,
        hostUserId: true,
        phase: true,
        currentStep: true,
        privacy: true,
        inviteToken: true,
        route: {
          select: {
            title: true,
            city: true,
            steps: {
              select: {
                id: true,
              },
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            },
          },
        },
      },
    });

    if (!session) {
      throw new ApiError(404, 'evening_session_not_found', 'Evening session not found');
    }
    if (session.phase === 'done' || session.phase === 'canceled') {
      throw new ApiError(409, 'evening_session_closed', 'Evening session is closed');
    }

    const privacy = this.parsePrivacy(session.privacy);
    const existingParticipant =
      await this.prismaService.client.eveningSessionParticipant.findUnique({
        where: {
          sessionId_userId: {
            sessionId: session.id,
            userId,
          },
        },
        select: {
          status: true,
        },
      });
    if (existingParticipant?.status === 'joined') {
      await this.prismaService.client.chatMember.upsert({
        where: {
          chatId_userId: {
            chatId: session.chatId,
            userId,
          },
        },
        create: {
          chatId: session.chatId,
          userId,
        },
        update: {},
      });

      return {
        status: 'joined',
        sessionId: session.id,
        routeId: session.routeId,
        chatId: session.chatId,
        phase: session.phase,
        currentStep: session.currentStep,
        totalSteps: session.route.steps.length,
      };
    }

    if (privacy === 'request') {
      const note = this.optionalText(body.note);
      const request = await this.prismaService.client.$transaction(async (tx) => {
        const existingRequest = await tx.eveningSessionJoinRequest.findUnique({
          where: {
            sessionId_userId: {
              sessionId: session.id,
              userId,
            },
          },
          select: {
            id: true,
            status: true,
          },
        });

        if (existingRequest && existingRequest.status !== 'requested') {
          throw new ApiError(
            409,
            'evening_join_request_already_reviewed',
            'Evening join request is already reviewed',
          );
        }

        const next = existingRequest
          ? await tx.eveningSessionJoinRequest.update({
              where: { id: existingRequest.id },
              data: { note },
              select: {
                id: true,
                status: true,
              },
            })
          : await tx.eveningSessionJoinRequest.create({
              data: {
                sessionId: session.id,
                userId,
                status: 'requested',
                note,
              },
              select: {
                id: true,
                status: true,
              },
            });

        if (next.status !== 'requested') {
          throw new ApiError(
            409,
            'evening_join_request_already_reviewed',
            'Evening join request is already reviewed',
          );
        }

        await this.createEveningNotification(tx, {
          userId: session.hostUserId,
          actorUserId: userId,
          kind: 'event_joined',
          title: 'Новая заявка',
          body: `Новая заявка на вечер «${session.route.title}»`,
          chatId: session.chatId,
          requestId: next.id,
          dedupeKey: `evening_join_request:${session.id}:${userId}`,
          payload: {
            sessionId: session.id,
            routeId: session.routeId,
            chatId: session.chatId,
            requestId: next.id,
            status: 'requested',
            userId,
          },
        });

        return next;
      });

      return {
        status: request.status,
        requestId: request.id,
        chatId: null,
      };
    }

    if (privacy === 'invite' && body.inviteToken !== session.inviteToken) {
      throw new ApiError(403, 'evening_invite_required', 'Invite is required');
    }

    const now = new Date();
    const user = await this.prismaService.client.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });
    await this.prismaService.client.$transaction(async (tx) => {
      await this.assertSessionCapacityAvailableForUpdate(tx, session.id);

      await tx.eveningSessionParticipant.upsert({
        where: {
          sessionId_userId: {
            sessionId: session.id,
            userId,
          },
        },
        create: {
          sessionId: session.id,
          userId,
          role: 'guest',
          status: 'joined',
          joinedAt: now,
        },
        update: {
          status: 'joined',
          joinedAt: now,
          leftAt: null,
        },
      });

      await tx.chatMember.upsert({
        where: {
          chatId_userId: {
            chatId: session.chatId,
            userId,
          },
        },
        create: {
          chatId: session.chatId,
          userId,
        },
        update: {},
      });

      await tx.chat.update({
        where: { id: session.chatId },
        data: { updatedAt: now },
      });

      if (session.phase === 'live') {
        await this.createSystemMessage(tx, {
          chatId: session.chatId,
          senderId: userId,
          clientMessageId: `evening-session:${session.id}:join:${userId}`,
          text: `${user?.displayName ?? 'Гость'} присоединился · шаг ${session.currentStep ?? 1}/${session.route.steps.length}`,
          actorUserId: userId,
        });
      }
    });

    await this.analytics?.track({
      name: 'route_session_joined',
      userId,
      routeTemplateId: session.routeTemplateId ?? null,
      routeId: session.routeId,
      sessionId: session.id,
      city: session.route.city ?? null,
      metadata: { privacy },
    });

    return {
      status: 'joined',
      sessionId: session.id,
      routeId: session.routeId,
      chatId: session.chatId,
      phase: session.phase,
      currentStep: session.currentStep,
      totalSteps: session.route.steps.length,
    };
  }

  async approveJoinRequest(userId: string, sessionId: string, requestId: string) {
    const session = await this.loadSessionWithRoute(sessionId);
    this.assertSessionHost(userId, session);

    const request = await this.prismaService.client.eveningSessionJoinRequest.findFirst({
      where: {
        id: requestId,
        sessionId: session.id,
        status: 'requested',
      },
      select: {
        id: true,
        userId: true,
        user: {
          select: {
            displayName: true,
          },
        },
      },
    });

    if (!request) {
      throw new ApiError(404, 'evening_join_request_not_found', 'Evening join request not found');
    }

    const now = new Date();
    await this.prismaService.client.$transaction(async (tx) => {
      await this.assertSessionCapacityAvailableForUpdate(tx, session.id);

      const reviewed = await tx.eveningSessionJoinRequest.updateMany({
        where: {
          id: request.id,
          sessionId: session.id,
          status: 'requested',
        },
        data: {
          status: 'approved',
          reviewedById: userId,
          reviewedAt: now,
        },
      });
      if (reviewed.count === 0) {
        throw new ApiError(
          409,
          'evening_join_request_already_reviewed',
          'Evening join request is already reviewed',
        );
      }

      await tx.eveningSessionParticipant.upsert({
        where: {
          sessionId_userId: {
            sessionId: session.id,
            userId: request.userId,
          },
        },
        create: {
          sessionId: session.id,
          userId: request.userId,
          role: 'guest',
          status: 'joined',
          joinedAt: now,
        },
        update: {
          status: 'joined',
          joinedAt: now,
          leftAt: null,
        },
      });

      await tx.chatMember.upsert({
        where: {
          chatId_userId: {
            chatId: session.chatId,
            userId: request.userId,
          },
        },
        create: {
          chatId: session.chatId,
          userId: request.userId,
        },
        update: {},
      });

      await tx.chat.update({
        where: { id: session.chatId },
        data: { updatedAt: now },
      });

      await this.createSystemMessage(tx, {
        chatId: session.chatId,
        senderId: userId,
        clientMessageId: `evening-session:${session.id}:approve:${request.id}`,
        text: `${request.user?.displayName ?? 'Гость'} в команде вечера`,
        actorUserId: userId,
      });

      await this.createEveningNotification(tx, {
        userId: request.userId,
        actorUserId: userId,
        kind: 'event_invite',
        title: 'Заявка принята',
        body: `Ты в вечере «${session.route.title}»`,
        chatId: session.chatId,
        requestId: request.id,
        dedupeKey: `evening_join_request_approved:${session.id}:${request.id}`,
        payload: {
          sessionId: session.id,
          routeId: session.routeId,
          chatId: session.chatId,
          requestId: request.id,
          status: 'approved',
        },
      });
    });

    await this.analytics?.track({
      name: 'route_session_joined',
      userId: request.userId,
      routeTemplateId: session.routeTemplateId ?? null,
      routeId: session.routeId,
      sessionId: session.id,
      city: session.route.city ?? null,
      metadata: {
        privacy: 'request',
        approvedByUserId: userId,
      },
    });

    return {
      status: 'approved',
      sessionId: session.id,
      requestId: request.id,
      userId: request.userId,
      chatId: session.chatId,
    };
  }

  async rejectJoinRequest(userId: string, sessionId: string, requestId: string) {
    const session = await this.prismaService.client.eveningSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        routeId: true,
        chatId: true,
        hostUserId: true,
        route: {
          select: {
            title: true,
          },
        },
      },
    });

    if (!session) {
      throw new ApiError(404, 'evening_session_not_found', 'Evening session not found');
    }
    this.assertSessionHost(userId, session);

    const request = await this.prismaService.client.eveningSessionJoinRequest.findFirst({
      where: {
        id: requestId,
        sessionId: session.id,
        status: 'requested',
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!request) {
      throw new ApiError(404, 'evening_join_request_not_found', 'Evening join request not found');
    }

    await this.prismaService.client.$transaction(async (tx) => {
      const reviewed = await tx.eveningSessionJoinRequest.updateMany({
        where: {
          id: request.id,
          sessionId: session.id,
          status: 'requested',
        },
        data: {
          status: 'rejected',
          reviewedById: userId,
          reviewedAt: new Date(),
        },
      });
      if (reviewed.count === 0) {
        throw new ApiError(
          409,
          'evening_join_request_already_reviewed',
          'Evening join request is already reviewed',
        );
      }

      await this.createEveningNotification(tx, {
        userId: request.userId,
        actorUserId: userId,
        kind: 'event_invite',
        title: 'Заявка отклонена',
        body: `Заявка на вечер «${session.route.title}» отклонена`,
        requestId: request.id,
        dedupeKey: `evening_join_request_rejected:${session.id}:${request.id}`,
        payload: {
          sessionId: session.id,
          routeId: session.routeId,
          chatId: session.chatId,
          requestId: request.id,
          status: 'rejected',
        },
      });
    });

    return {
      status: 'rejected',
      sessionId: session.id,
      requestId: request.id,
      userId: request.userId,
    };
  }

  async checkInStep(userId: string, sessionId: string, stepId: string) {
    const session = await this.loadSessionWithRoute(sessionId);
    if (session.phase === 'done' || session.phase === 'canceled') {
      throw new ApiError(409, 'evening_session_closed', 'Evening session is closed');
    }
    if (session.phase !== 'live') {
      throw new ApiError(409, 'evening_session_not_live', 'Evening session is not live');
    }
    const step = this.findSessionStep(session, stepId);
    const currentStep = this.normalizeSessionCurrentStep(
      session.currentStep,
      session.route.steps.length,
    );
    const currentStepId =
      currentStep == null ? null : session.route.steps[currentStep - 1]?.id ?? null;
    if (currentStepId !== stepId) {
      throw new ApiError(409, 'evening_step_not_current', 'Evening step is not current');
    }
    await this.assertJoinedParticipant(userId, session.id);
    const user = await this.prismaService.client.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });

    const now = new Date();
    const checkIn = await this.prismaService.client.$transaction(async (tx) => {
      const record = await tx.eveningStepCheckIn.upsert({
        where: {
          sessionId_stepId_userId: {
            sessionId: session.id,
            stepId,
            userId,
          },
        },
        create: {
          sessionId: session.id,
          stepId,
          userId,
          checkedInAt: now,
        },
        update: {},
        select: {
          checkedInAt: true,
        },
      });

      await this.createSystemMessage(tx, {
        chatId: session.chatId,
        senderId: userId,
        clientMessageId: `evening-session:${session.id}:checkin:${stepId}:${userId}`,
        text: `${user?.displayName ?? 'Гость'} на месте · ${step.venue}`,
        actorUserId: userId,
      });

      return record;
    });

    return {
      sessionId: session.id,
      stepId,
      checkedIn: true,
      checkedInAt: this.dateToIso(checkIn.checkedInAt),
    };
  }

  async advanceStep(userId: string, sessionId: string, stepId: string) {
    return this.moveToNextStep(userId, sessionId, stepId, 'done');
  }

  async skipStep(userId: string, sessionId: string, stepId: string) {
    return this.moveToNextStep(userId, sessionId, stepId, 'skipped');
  }

  async finishSession(userId: string, sessionId: string) {
    const session = await this.prismaService.client.eveningSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        routeId: true,
        chatId: true,
        hostUserId: true,
        route: {
          select: {
            steps: {
              select: {
                id: true,
              },
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            },
          },
        },
      },
    });

    if (!session) {
      throw new ApiError(404, 'evening_session_not_found', 'Evening session not found');
    }
    this.assertSessionHost(userId, session);

    const now = new Date();
    await this.prismaService.client.$transaction(async (tx) => {
      await tx.eveningSession.update({
        where: { id: session.id },
        data: {
          phase: 'done',
          endedAt: now,
          currentStep: null,
        },
      });
      await tx.chat.update({
        where: { id: session.chatId },
        data: {
          meetupPhase: 'done',
          currentStep: null,
          meetupEndsAt: now,
        },
      });
      await this.createSystemMessage(tx, {
        chatId: session.chatId,
        senderId: userId,
        clientMessageId: `evening-session:${session.id}:finish`,
        text: 'Вечер завершен',
        actorUserId: userId,
      });
      await this.createChatUpdatedEvent(tx, {
        chatId: session.chatId,
        sessionId: session.id,
        routeId: session.routeId,
        phase: 'done',
        currentStep: null,
        totalSteps: session.route.steps.length,
        currentPlace: null,
        endTime: this.dateToIso(now),
      });
    });

    return {
      sessionId: session.id,
      chatId: session.chatId,
      phase: 'done',
      finishedAt: now.toISOString(),
    };
  }

  async getAfterParty(userId: string, sessionId: string) {
    const session = await this.prismaService.client.eveningSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        routeId: true,
        phase: true,
        hostUserId: true,
        route: {
          select: {
            title: true,
          },
        },
        participants: {
          where: { status: 'joined' },
          select: { userId: true },
        },
        afterPartyFeedbacks: {
          select: {
            userId: true,
            rating: true,
            reaction: true,
            comment: true,
          },
        },
        afterPartyPhotos: {
          select: {
            id: true,
            userId: true,
            mediaAssetId: true,
            createdAt: true,
            mediaAsset: {
              select: {
                id: true,
                publicUrl: true,
              },
            },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        },
      },
    });

    if (!session) {
      throw new ApiError(404, 'evening_session_not_found', 'Evening session not found');
    }
    this.assertSessionParticipantOrHost(userId, session);

    return this.mapAfterParty(session, userId);
  }

  async saveAfterPartyFeedback(
    userId: string,
    sessionId: string,
    body: Record<string, unknown> = {},
  ) {
    const session = await this.prismaService.client.eveningSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        phase: true,
      },
    });

    if (!session) {
      throw new ApiError(404, 'evening_session_not_found', 'Evening session not found');
    }
    if (session.phase !== 'done') {
      throw new ApiError(409, 'evening_after_party_not_ready', 'Evening after party is not ready');
    }
    await this.assertJoinedParticipant(userId, session.id);

    const rating = this.parseRating(body.rating);
    const reaction = this.optionalText(body.reaction);
    const comment = this.optionalText(body.comment);
    const feedback = await this.prismaService.client.eveningAfterPartyFeedback.upsert({
      where: {
        sessionId_userId: {
          sessionId: session.id,
          userId,
        },
      },
      create: {
        sessionId: session.id,
        userId,
        rating,
        reaction,
        comment,
      },
      update: {
        rating,
        reaction,
        comment,
      },
      select: {
        id: true,
        rating: true,
        reaction: true,
        comment: true,
      },
    });

    return {
      sessionId: session.id,
      feedbackId: feedback.id,
      rating: feedback.rating,
      reaction: feedback.reaction,
      comment: feedback.comment,
    };
  }

  async addAfterPartyPhoto(
    userId: string,
    sessionId: string,
    body: Record<string, unknown> = {},
  ) {
    const assetId = this.requiredText(body.assetId, 'evening_after_party_photo_required');
    const session = await this.prismaService.client.eveningSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        phase: true,
      },
    });

    if (!session) {
      throw new ApiError(404, 'evening_session_not_found', 'Evening session not found');
    }
    if (session.phase !== 'done') {
      throw new ApiError(409, 'evening_after_party_not_ready', 'Evening after party is not ready');
    }
    await this.assertJoinedParticipant(userId, session.id);

    const asset = await this.prismaService.client.mediaAsset.findFirst({
      where: {
        id: assetId,
        ownerId: userId,
        status: 'ready',
      },
      select: {
        id: true,
        publicUrl: true,
      },
    });

    if (!asset) {
      throw new ApiError(404, 'media_asset_not_found', 'Media asset not found');
    }

    const photo = await this.prismaService.client.eveningAfterPartyPhoto.upsert({
      where: {
        sessionId_mediaAssetId: {
          sessionId: session.id,
          mediaAssetId: asset.id,
        },
      },
      create: {
        sessionId: session.id,
        userId,
        mediaAssetId: asset.id,
      },
      update: {},
      select: {
        id: true,
      },
    });

    return {
      sessionId: session.id,
      photoId: photo.id,
      mediaAssetId: asset.id,
      url: asset.publicUrl,
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

  private async loadEveningRouteTemplate(routeId: string) {
    return this.prismaService.client.eveningRoute.findUnique({
      where: { id: routeId },
      select: eveningRouteWithStepsSelect,
    });
  }

  private async mapRouteForUser(userId: string, route: EveningRouteWithSteps) {
    const [actions, tomestoBackfills] = await Promise.all([
      this.prismaService.client.userEveningStepAction.findMany({
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
      }),
      this.loadTomestoStepBackfills(route.steps, route.city),
    ]);
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
      steps: route.steps.map((step) =>
        this.mapStep(
          step,
          actionByStepId.get(step.id) ?? null,
          null,
          tomestoBackfills.get(step.id) ?? null,
        ),
      ),
      userState: this.mapUserState(actions),
    };
  }

  private mapStep(
    step: EveningRouteStepForResponse,
    action: StepActionRecord | null,
    sessionState?: {
      status?: string | null;
      checkedIn?: boolean;
      startedAt?: Date | null;
      finishedAt?: Date | null;
      skippedAt?: Date | null;
    } | null,
    tomestoBackfill?: TomestoStepBackfill | null,
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
      ticketPrice: step.ticketPrice ?? tomestoBackfill?.price ?? null,
      ticketCommission: step.ticketCommission,
      ticketUrl: step.ticketUrl ?? tomestoBackfill?.url ?? null,
      ticketSourceCode: step.ticketSourceCode ?? null,
      ticketProvider: step.ticketProvider ?? tomestoBackfill?.provider ?? null,
      sponsored: step.sponsored,
      premium: step.premium,
      partnerId: step.partnerId,
      venueId: step.venueId ?? null,
      partnerOfferId: step.partnerOfferId ?? null,
      offerTitle: step.offerTitleSnapshot ?? null,
      offerDescription: step.offerDescriptionSnapshot ?? null,
      offerTerms: step.offerTermsSnapshot ?? null,
      offerShortLabel: step.offerShortLabelSnapshot ?? null,
      description: step.description,
      vibeTag: step.vibeTag,
      lat: step.lat,
      lng: step.lng,
      status: sessionState?.status ?? null,
      checkedIn: sessionState?.checkedIn ?? false,
      startedAt: this.dateToIso(sessionState?.startedAt ?? null),
      finishedAt: this.dateToIso(sessionState?.finishedAt ?? null),
      skippedAt: this.dateToIso(sessionState?.skippedAt ?? null),
      hasShareable:
        step.perk != null ||
        step.ticketPrice != null ||
        tomestoBackfill?.url != null,
      state: {
        perkUsed: action?.perkUsedAt != null,
        ticketBought: action?.ticketBoughtAt != null,
        sentToChat: action?.sentToChatAt != null,
        chatMessageId: action?.chatMessageId ?? null,
      },
    };
  }

  private async loadTomestoStepBackfills(
    steps: EveningRouteStepForResponse[],
    city: string,
  ) {
    const missing = steps.filter(
      (step) =>
        step.ticketSourceCode === 'tomesto' &&
        (step.ticketUrl == null || step.ticketUrl.trim().length === 0),
    );
    if (missing.length === 0) {
      return new Map<string, TomestoStepBackfill>();
    }

    const terms = [
      ...new Set(
        missing
          .flatMap((step) => [step.venue, step.title, step.address])
          .map((value) => value.trim())
          .filter((value) => value.length >= 2),
      ),
    ];
    if (terms.length === 0) {
      return new Map<string, TomestoStepBackfill>();
    }

    const places = await this.prismaService.client.externalContentItem.findMany({
      where: {
        source: { code: 'tomesto' },
        contentKind: 'place',
        publicStatus: 'published',
        city,
        OR: terms.flatMap((term) => [
          { title: { contains: term, mode: 'insensitive' as const } },
          { venueName: { contains: term, mode: 'insensitive' as const } },
          { address: { contains: term, mode: 'insensitive' as const } },
        ]),
      },
      select: {
        title: true,
        venueName: true,
        address: true,
        actionUrl: true,
        sourceUrl: true,
        priceFrom: true,
        sourceProvider: true,
      },
      take: Math.min(100, terms.length * 6),
    });

    const result = new Map<string, TomestoStepBackfill>();
    for (const step of missing) {
      const place = this.findTomestoPlaceForStep(step, places);
      const url = place?.actionUrl ?? place?.sourceUrl ?? null;
      if (!url) {
        continue;
      }
      result.set(step.id, {
        url,
        price: place?.priceFrom ?? null,
        provider: place?.sourceProvider ?? 'Tomesto',
      });
    }
    return result;
  }

  private findTomestoPlaceForStep(
    step: EveningRouteStepForResponse,
    places: Array<{
      title: string;
      venueName: string | null;
      address: string | null;
      actionUrl: string | null;
      sourceUrl: string | null;
      priceFrom: number | null;
      sourceProvider: string | null;
    }>,
  ) {
    const stepNames = [
      this.normalizeMatchText(step.venue),
      this.normalizeMatchText(step.title),
    ].filter(Boolean);
    const stepAddress = this.normalizeMatchText(step.address);

    return places.find((place) => {
      const placeNames = [
        this.normalizeMatchText(place.title),
        this.normalizeMatchText(place.venueName ?? ''),
      ].filter(Boolean);
      const nameMatches = stepNames.some((stepName) =>
        placeNames.some(
          (placeName) =>
            stepName.includes(placeName) || placeName.includes(stepName),
        ),
      );
      if (!nameMatches) {
        return false;
      }

      const placeAddress = this.normalizeMatchText(place.address ?? '');
      return (
        stepAddress.length === 0 ||
        placeAddress.length === 0 ||
        stepAddress.includes(placeAddress) ||
        placeAddress.includes(stepAddress)
      );
    });
  }

  private normalizeMatchText(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^a-zа-я0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
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

  private sessionInclude(
    userId: string,
    options: { currentUserRequestOnly?: boolean } = {},
  ) {
    return {
      route: {
        select: eveningRouteWithStepsSelect,
      },
      host: {
        select: {
          id: true,
          displayName: true,
        },
      },
      participants: {
        select: {
          userId: true,
          role: true,
          status: true,
          user: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
        orderBy: [{ joinedAt: 'asc' as const }, { id: 'asc' as const }],
      },
      stepStates: {
        select: {
          stepId: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          skippedAt: true,
        },
      },
      checkIns: {
        where: {
          userId,
        },
        select: {
          stepId: true,
        },
      },
      joinRequests: {
        where: {
          status: 'requested',
          ...(options.currentUserRequestOnly ? { userId } : {}),
        },
        select: {
          id: true,
          userId: true,
          status: true,
          note: true,
          createdAt: true,
          user: {
            select: {
              displayName: true,
            },
          },
        },
      },
    };
  }

  private mapSession(session: any, userId: string) {
    const route = session.route;
    const steps = route?.steps ?? [];
    const joinedParticipants = (session.participants ?? []).filter(
      (participant: any) => participant.status === 'joined',
    );
    const stateByStepId = new Map(
      (session.stepStates ?? []).map((state: any) => [state.stepId, state]),
    );
    const checkedInStepIds = new Set(
      (session.checkIns ?? []).map((checkIn: any) => checkIn.stepId),
    );
    const currentStep =
      session.phase === 'live'
        ? this.normalizeSessionCurrentStep(session.currentStep, steps.length)
        : null;
    const current =
      currentStep == null ? null : steps[Math.max(0, currentStep - 1)] ?? null;
    const mapStep = current ?? steps[0] ?? null;

    return {
      id: session.id,
      sessionId: session.id,
      routeId: session.routeId,
      routeTemplateId: session.routeTemplateId ?? null,
      chatId: session.chatId,
      phase: session.phase,
      chatPhase: this.sessionPhaseToChatPhase(session.phase),
      privacy: this.parsePrivacy(session.privacy),
      mode: this.parseLaunchMode(session.mode),
      title: route?.title ?? '',
      vibe: route?.vibe ?? '',
      emoji: steps[0]?.emoji ?? '✨',
      area: route?.area ?? null,
      isCurated: route?.isCurated ?? false,
      badgeLabel: route?.badgeLabel ?? null,
      hostUserId: session.hostUserId,
      hostName: session.host?.displayName ?? null,
      inviteToken:
        session.hostUserId === userId ? session.inviteToken ?? null : null,
      joinedCount: joinedParticipants.length,
      maxGuests: session.capacity,
      currentStep,
      totalSteps: steps.length,
      currentPlace: current?.venue ?? null,
      lat: mapStep?.lat ?? null,
      lng: mapStep?.lng ?? null,
      endTime: current?.endTimeLabel ?? this.dateToIso(session.endedAt),
      startsAt: this.dateToIso(session.startsAt),
      startedAt: this.dateToIso(session.startedAt),
      endedAt: this.dateToIso(session.endedAt),
      isJoined: joinedParticipants.some(
        (participant: any) => participant.userId === userId,
      ),
      isRequested: (session.joinRequests ?? []).some(
        (request: any) =>
          request.userId === userId && request.status === 'requested',
      ),
      participants: joinedParticipants.map((participant: any) => ({
        userId: participant.userId,
        name: participant.user?.displayName ?? 'Гость',
        role: participant.role,
        status: participant.status,
      })),
      steps: steps.map((step: EveningRouteStepForResponse) => {
        const state = stateByStepId.get(step.id) as any;
        return this.mapStep(step, null, {
          status: state?.status ?? null,
          checkedIn: checkedInStepIds.has(step.id),
          startedAt: state?.startedAt ?? null,
          finishedAt: state?.finishedAt ?? null,
          skippedAt: state?.skippedAt ?? null,
        });
      }),
      pendingRequests:
        session.hostUserId === userId
          ? (session.joinRequests ?? []).map((request: any) => ({
              id: request.id,
              userId: request.userId,
              name: request.user?.displayName ?? 'Гость',
              status: request.status,
              note: request.note,
              createdAt: this.dateToIso(request.createdAt),
            }))
          : [],
    };
  }

  private async loadSessionWithRoute(sessionId: string) {
    const session = await this.prismaService.client.eveningSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        routeTemplateId: true,
        routeId: true,
        chatId: true,
        hostUserId: true,
        phase: true,
        currentStep: true,
        route: {
          select: {
            title: true,
            city: true,
            steps: {
              select: {
                id: true,
                venue: true,
                endTimeLabel: true,
              },
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            },
          },
        },
      },
    });

    if (!session) {
      throw new ApiError(404, 'evening_session_not_found', 'Evening session not found');
    }

    return session;
  }

  private async assertSessionCapacityAvailableForUpdate(
    tx: Prisma.TransactionClient,
    sessionId: string,
  ) {
    const sessions = await tx.$queryRaw<Array<{ capacity: number | bigint }>>`
      SELECT "capacity"
      FROM "EveningSession"
      WHERE "id" = ${sessionId}
      FOR UPDATE
    `;
    const session = sessions[0];
    if (!session) {
      throw new ApiError(404, 'evening_session_not_found', 'Evening session not found');
    }

    const capacity =
      typeof session.capacity === 'bigint'
        ? Number(session.capacity)
        : session.capacity;
    const joinedCount = await tx.eveningSessionParticipant.count({
      where: {
        sessionId,
        status: 'joined',
      },
    });
    if (joinedCount >= capacity) {
      throw new ApiError(409, 'evening_session_full', 'Evening session is full');
    }
  }

  private findSessionStep(session: any, stepId: string) {
    const step = session.route.steps.find(
      (item: { id: string }) => item.id === stepId,
    );
    if (!step) {
      throw new ApiError(404, 'evening_step_not_found', 'Evening route step not found');
    }
    return step;
  }

  private async assertJoinedParticipant(userId: string, sessionId: string) {
    const participant = await this.prismaService.client.eveningSessionParticipant.findUnique({
      where: {
        sessionId_userId: {
          sessionId,
          userId,
        },
      },
      select: {
        status: true,
      },
    });

    if (participant?.status !== 'joined') {
      throw new ApiError(403, 'evening_session_membership_required', 'Evening session membership required');
    }
  }

  private assertSessionParticipantOrHost(userId: string, session: any) {
    if (session.hostUserId === userId) {
      return;
    }
    const isParticipant = (session.participants ?? []).some(
      (participant: { userId: string }) => participant.userId === userId,
    );
    if (!isParticipant) {
      throw new ApiError(403, 'evening_session_membership_required', 'Evening session membership required');
    }
  }

  private async moveToNextStep(
    userId: string,
    sessionId: string,
    stepId: string,
    status: 'done' | 'skipped',
  ) {
    const session = await this.loadSessionWithRoute(sessionId);
    this.assertSessionHost(userId, session);
    if (session.phase !== 'live') {
      throw new ApiError(409, 'evening_session_not_live', 'Evening session is not live');
    }

    const currentIndex = session.route.steps.findIndex(
      (step: { id: string }) => step.id === stepId,
    );
    if (currentIndex < 0) {
      throw new ApiError(404, 'evening_step_not_found', 'Evening route step not found');
    }

    const nextStep = session.route.steps[currentIndex + 1];
    if (!nextStep) {
      throw new ApiError(409, 'evening_step_next_missing', 'No next evening step');
    }

    const now = new Date();
    const nextStepNumber = currentIndex + 2;
    await this.prismaService.client.$transaction(async (tx) => {
      await tx.eveningSession.update({
        where: { id: session.id },
        data: { currentStep: nextStepNumber },
      });

      await tx.chat.update({
        where: { id: session.chatId },
        data: { currentStep: nextStepNumber },
      });

      await tx.eveningSessionStepState.updateMany({
        where: {
          sessionId: session.id,
          stepId,
        },
        data: {
          status,
          finishedAt: status === 'done' ? now : null,
          skippedAt: status === 'skipped' ? now : null,
        },
      });

      await tx.eveningSessionStepState.upsert({
        where: {
          sessionId_stepId: {
            sessionId: session.id,
            stepId: nextStep.id,
          },
        },
        create: {
          sessionId: session.id,
          stepId: nextStep.id,
          status: 'current',
          startedAt: now,
        },
        update: {
          status: 'current',
          startedAt: now,
          finishedAt: null,
          skippedAt: null,
        },
      });

      await this.createSystemMessage(tx, {
        chatId: session.chatId,
        senderId: userId,
        clientMessageId: `evening-session:${session.id}:step:${nextStep.id}`,
        text: `Следующий шаг · ${nextStepNumber}/${session.route.steps.length} · ${nextStep.venue}`,
        actorUserId: userId,
      });
      await this.createChatUpdatedEvent(tx, {
        chatId: session.chatId,
        sessionId: session.id,
        routeId: session.routeId,
        phase: 'live',
        currentStep: nextStepNumber,
        totalSteps: session.route.steps.length,
        currentPlace: nextStep.venue,
        endTime: nextStep.endTimeLabel,
      });
    });

    return {
      sessionId: session.id,
      currentStep: nextStepNumber,
      totalSteps: session.route.steps.length,
      currentPlace: nextStep.venue,
      status: 'current',
    };
  }

  private mapAfterParty(session: any, userId: string) {
    const feedbacks = session.afterPartyFeedbacks ?? [];
    const ratingSum = feedbacks.reduce(
      (sum: number, feedback: { rating: number }) => sum + feedback.rating,
      0,
    );
    const myFeedback = feedbacks.find(
      (feedback: { userId: string }) => feedback.userId === userId,
    );

    return {
      sessionId: session.id,
      routeId: session.routeId,
      title: session.route?.title ?? '',
      phase: session.phase,
      participantsCount: (session.participants ?? []).length,
      ratingAverage:
        feedbacks.length === 0 ? null : Math.round((ratingSum / feedbacks.length) * 10) / 10,
      ratingsCount: feedbacks.length,
      myFeedback: myFeedback
        ? {
            rating: myFeedback.rating,
            reaction: myFeedback.reaction,
            comment: myFeedback.comment,
          }
        : null,
      photos: (session.afterPartyPhotos ?? []).map((photo: any) => ({
        id: photo.id,
        userId: photo.userId,
        mediaAssetId: photo.mediaAssetId,
        url: photo.mediaAsset?.publicUrl ?? null,
        createdAt: this.dateToIso(photo.createdAt),
      })),
    };
  }

  private dateToIso(value: Date | null | undefined) {
    return value instanceof Date ? value.toISOString() : null;
  }

  private createId(prefix: string) {
    return `${prefix}_${randomBytes(12).toString('hex')}`;
  }

  private sessionPhaseToChatPhase(value: string | null | undefined) {
    if (value === 'live') {
      return 'live';
    }
    if (value === 'done' || value === 'canceled') {
      return 'done';
    }
    return 'soon';
  }

  private normalizeSessionCurrentStep(value: number | null | undefined, totalSteps: number) {
    if (totalSteps <= 0) {
      return null;
    }
    if (value == null || value < 1) {
      return 1;
    }
    return Math.min(value, totalSteps);
  }

  private parsePrivacy(value: unknown): EveningPrivacy {
    if (value === 'request' || value === 'invite') {
      return value;
    }
    return 'open';
  }

  private parseCapacity(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.min(50, Math.max(1, Math.floor(value)));
    }
    if (typeof value === 'string') {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) {
        return Math.min(50, Math.max(1, parsed));
      }
    }
    return 10;
  }

  private normalizeSessionLimit(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.min(50, Math.max(1, Math.floor(value)));
    }
    if (typeof value === 'string') {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) {
        return Math.min(50, Math.max(1, parsed));
      }
    }
    return 20;
  }

  private optionalText(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed.slice(0, 280) : null;
  }

  private requiredText(value: unknown, errorCode: string) {
    const text = this.optionalText(value);
    if (!text) {
      throw new ApiError(400, errorCode, 'Required text value is missing');
    }
    return text;
  }

  private parseRating(value: unknown) {
    const rating =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number.parseInt(value, 10)
          : Number.NaN;
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      throw new ApiError(400, 'evening_after_party_rating_invalid', 'Rating is invalid');
    }
    return Math.floor(rating);
  }

  private createInviteToken() {
    return randomBytes(16).toString('hex');
  }

  private privacyLabel(privacy: EveningPrivacy) {
    if (privacy === 'request') {
      return 'по заявке';
    }
    if (privacy === 'invite') {
      return 'по приглашениям';
    }
    return 'открытый';
  }

  private assertSessionHost(
    userId: string,
    session: { hostUserId?: string | null },
  ) {
    if (session.hostUserId !== userId) {
      throw new ApiError(403, 'evening_session_host_required', 'Evening session host required');
    }
  }

  private async createEveningNotification(
    tx: any,
    params: {
      userId: string;
      actorUserId: string;
      kind: 'event_joined' | 'event_invite';
      title: string;
      body: string;
      dedupeKey: string;
      payload: Record<string, unknown>;
      chatId?: string | null;
      requestId?: string | null;
    },
  ) {
    const existing = await tx.notification.findUnique({
      where: { dedupeKey: params.dedupeKey },
      select: { id: true },
    });
    if (existing) {
      return existing;
    }

    const notification = await tx.notification.create({
      data: {
        userId: params.userId,
        actorUserId: params.actorUserId,
        kind: params.kind,
        title: params.title,
        body: params.body,
        chatId: params.chatId ?? null,
        requestId: params.requestId ?? null,
        dedupeKey: params.dedupeKey,
        payload: params.payload,
      },
      select: {
        id: true,
      },
    });

    await tx.outboxEvent.createMany({
      data: [
        {
          type: OUTBOX_EVENT_TYPES.pushDispatch,
          payload: {
            userId: params.userId,
            notificationId: notification.id,
          },
        },
        {
          type: OUTBOX_EVENT_TYPES.notificationCreate,
          payload: {
            notificationId: notification.id,
          },
        },
      ],
    });

    return notification;
  }

  private async createSystemMessage(
    tx: any,
    params: {
      chatId: string;
      senderId: string;
      clientMessageId: string;
      text: string;
      actorUserId: string;
    },
  ) {
    const existing = await tx.message.findUnique({
      where: {
        chatId_clientMessageId: {
          chatId: params.chatId,
          clientMessageId: params.clientMessageId,
        },
      },
      select: { id: true },
    });
    if (existing) {
      return existing;
    }

    const now = new Date();
    const message = await tx.message.create({
      data: {
        chatId: params.chatId,
        senderId: params.senderId,
        text: params.text,
        clientMessageId: params.clientMessageId,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });
    const createdAt =
      message.createdAt instanceof Date ? message.createdAt : now;
    const payload = {
      id: message.id,
      chatId: params.chatId,
      clientMessageId: params.clientMessageId,
      senderId: params.senderId,
      senderName: 'Frendly',
      senderAvatarUrl: null,
      text: params.text,
      createdAt: createdAt.toISOString(),
      kind: 'system',
      replyTo: null,
      attachments: [],
    };
    const realtimeEvent = await tx.realtimeEvent.create({
      data: {
        chatId: params.chatId,
        eventType: 'message.created',
        payload,
      },
    });

    await tx.outboxEvent.createMany({
      data: [
        {
          type: OUTBOX_EVENT_TYPES.realtimePublish,
          payload: {
            type: 'message.created',
            payload: {
              ...payload,
              eventId: realtimeEvent.id.toString(),
            },
          },
        },
        {
          type: OUTBOX_EVENT_TYPES.chatUnreadFanout,
          payload: {
            chatId: params.chatId,
            actorUserId: params.actorUserId,
          },
        },
      ],
    });

    return message;
  }

  private async createChatUpdatedEvent(
    tx: any,
    payload: {
      chatId: string;
      sessionId: string;
      routeId: string;
      phase: string;
      currentStep: number | null;
      totalSteps: number;
      currentPlace: string | null;
      endTime: string | null;
    },
  ) {
    await tx.outboxEvent.createMany({
      data: [
        {
          type: OUTBOX_EVENT_TYPES.realtimePublish,
          payload: {
            type: 'chat.updated',
            payload,
          },
        },
      ],
    });
  }

  private async loadStep(routeId: string, stepId: string): Promise<EveningStepWithRoute> {
    const step = await this.prismaService.client.eveningRouteStep.findFirst({
      where: {
        id: stepId,
        routeId,
      },
      select: {
        id: true,
        timeLabel: true,
        endTimeLabel: true,
        ticketPrice: true,
        title: true,
        perk: true,
        perkShort: true,
        venue: true,
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


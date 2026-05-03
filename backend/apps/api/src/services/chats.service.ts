import {
  buildMessagePreview,
  decodeCursor,
  encodeCursor,
  getBlockedUserIds as loadBlockedUserIds,
} from '@big-break/database';
import { ChatKind, Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { formatEventTime, formatRelativeTime, mapMessage } from '../common/presenters';
import { PrismaService } from './prisma.service';

const CHAT_MEMBER_PREVIEW_LIMIT = 8;

interface ChatListCursor {
  id: string;
  updatedAt: Date;
}

interface MessageCursor {
  id: string;
  createdAt: Date;
}

@Injectable()
export class ChatsService {
  constructor(private readonly prismaService: PrismaService) {}

  async listChats(userId: string, kind: 'meetup' | 'direct', params: { cursor?: string; limit?: number }) {
    const blockedUserIds = await this.getBlockedUserIds(userId);
    const take = this.normalizeChatListLimit(params.limit);
    const cursorChat = await this.resolveChatListCursor(params.cursor);

    const chats = await this.prismaService.client.chat.findMany({
      where: {
        kind: kind === 'meetup' ? ChatKind.meetup : ChatKind.direct,
        members: {
          some: {
            userId,
          },
        },
        ...(cursorChat == null
            ? {}
            : {
                OR: [
                  {
                    updatedAt: {
                      lt: cursorChat.updatedAt,
                    },
                  },
                  {
                    updatedAt: cursorChat.updatedAt,
                    id: {
                      lt: cursorChat.id,
                    },
                  },
                ],
              }),
      },
      include: {
        event: {
          select: {
            id: true,
            hostId: true,
            startsAt: true,
            durationMinutes: true,
            isAfterDark: true,
            afterDarkGlow: true,
            sourcePoster: {
              select: {
                ticketUrl: true,
              },
            },
            liveState: {
              select: {
                status: true,
              },
            },
          },
        },
        sourceEvent: {
          select: {
            title: true,
            hostId: true,
            isAfterDark: true,
            afterDarkGlow: true,
          },
        },
        members: {
          where: {
            userId: {
              notIn: [...blockedUserIds],
            },
          },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                online: true,
              },
            },
          },
          orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
          take: CHAT_MEMBER_PREVIEW_LIMIT,
        },
        messages: {
          where: {
            senderId: {
              notIn: [...blockedUserIds],
            },
          },
          include: {
            sender: true,
            attachments: {
              include: {
                mediaAsset: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        eveningRoute: {
          select: {
            id: true,
            steps: {
              select: {
                sortOrder: true,
                venue: true,
                endTimeLabel: true,
              },
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            },
          },
        },
        eveningSession: {
          select: {
            id: true,
            phase: true,
            privacy: true,
            mode: true,
            capacity: true,
            currentStep: true,
            startsAt: true,
            endedAt: true,
            host: {
              select: {
                id: true,
                displayName: true,
              },
            },
            _count: {
              select: {
                participants: {
                  where: {
                    status: 'joined',
                  },
                },
              },
            },
            route: {
              select: {
                id: true,
                area: true,
                steps: {
                  select: {
                    sortOrder: true,
                    venue: true,
                    endTimeLabel: true,
                  },
                  orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
                },
              },
            },
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });
    const hasMore = chats.length > take;
    const page = hasMore ? chats.slice(0, take) : chats;
    const unreadByChatId = await this.getUnreadCountsByChat(
      userId,
      page.map((chat) => chat.id),
      blockedUserIds,
    );

    const items = (
      await Promise.all(
      page.map(async (chat) => {
        const lastMessage = chat.messages[0] ?? null;
        const lastMessagePreview = lastMessage
          ? buildMessagePreview({
              text: lastMessage.text,
              attachments: lastMessage.attachments.map((entry) => ({
                kind: entry.mediaAsset.kind,
              })),
            })
          : '';
        const unread = unreadByChatId.get(chat.id) ?? 0;

        if (kind === 'meetup') {
          if (chat.event?.hostId && blockedUserIds.has(chat.event.hostId)) {
            return null;
          }

          const eventTime = chat.event ? formatEventTime(chat.event.startsAt) : '';
          const parts = eventTime.split('·');

          return {
            id: chat.id,
            eventId: chat.event?.id,
            title: chat.title,
            emoji: chat.emoji,
            time: parts[1]?.trim() ?? '',
            status: parts[0]?.trim() ?? '',
            lastMessage: lastMessagePreview,
            lastAuthor: lastMessage?.sender.displayName ?? '',
            lastTime: lastMessage ? formatRelativeTime(lastMessage.createdAt) : '',
            unread,
            members: chat.members
              .filter((entry) => !blockedUserIds.has(entry.userId))
              .map((entry) => entry.user.displayName),
            typing: false,
            isAfterDark:
              chat.event?.isAfterDark ?? chat.sourceEvent?.isAfterDark ?? false,
            afterDarkGlow: this.resolveAfterDarkGlow(
              chat.event?.isAfterDark ?? chat.sourceEvent?.isAfterDark ?? false,
              chat.event?.afterDarkGlow ?? chat.sourceEvent?.afterDarkGlow ?? null,
            ),
            ticketUrl: chat.event?.sourcePoster?.ticketUrl ?? null,
            ...this.mapEveningChatPhase(chat),
          };
        }

        const peer = chat.members.find((entry) => entry.userId !== userId)?.user;
        if (!peer || blockedUserIds.has(peer.id)) {
          return null;
        }

        return {
          id: chat.id,
          peerUserId: peer.id,
          name: peer?.displayName ?? 'Личный чат',
          lastMessage: lastMessagePreview,
          lastTime: lastMessage ? formatRelativeTime(lastMessage.createdAt) : '',
          unread,
          online: peer?.online ?? false,
          fromMeetup:
            chat.sourceEvent?.hostId != null &&
            blockedUserIds.has(chat.sourceEvent.hostId)
              ? null
              : chat.sourceEvent?.title ?? null,
        };
      }),
      )
    ).filter((item): item is NonNullable<typeof item> => item != null);

    return {
      items,
      nextCursor:
          hasMore && page.length > 0
              ? this.encodeChatListCursor(page[page.length - 1]!)
              : null,
    };
  }

  private mapEveningChatPhase(chat: {
    meetupPhase?: string | null;
    meetupMode?: string | null;
    currentStep?: number | null;
    meetupStartsAt?: Date | null;
    meetupEndsAt?: Date | null;
    event?: {
      liveState?: { status: string } | null;
      startsAt?: Date | null;
      durationMinutes?: number | null;
    } | null;
    eveningRoute?: {
      id: string;
      steps: Array<{
        sortOrder: number;
        venue: string;
        endTimeLabel: string | null;
      }>;
    } | null;
    eveningSession?: {
      id: string;
      phase: string;
      privacy: string;
      mode: string;
      capacity: number;
      currentStep?: number | null;
      startsAt?: Date | null;
      endedAt?: Date | null;
      host?: {
        id: string;
        displayName: string;
      } | null;
      _count?: {
        participants: number;
      };
      participants?: Array<{
        status: string;
        user?: {
          displayName: string;
        } | null;
      }>;
      route: {
        id: string;
        area: string;
        steps: Array<{
          sortOrder: number;
          venue: string;
          endTimeLabel: string | null;
        }>;
      };
    } | null;
  }) {
    const session = chat.eveningSession ?? null;
    const route = session?.route ?? chat.eveningRoute ?? null;
    const steps = route?.steps ?? [];
    const totalSteps = steps.length || null;
    const phase = this.normalizeMeetupPhase(
      session ? this.phaseFromSession(session.phase) : route ? chat.meetupPhase : this.phaseFromEvent(chat.event ?? null),
    );
    const mode = this.normalizeEveningMode(session?.mode ?? chat.meetupMode);
    const currentStep =
      phase === 'live'
        ? this.normalizeCurrentStep(session?.currentStep ?? chat.currentStep, totalSteps)
        : null;
    const current =
      currentStep == null ? null : steps[Math.max(0, currentStep - 1)] ?? null;
    const joinedParticipants = (session?.participants ?? []).filter(
      (participant) => participant.status === 'joined',
    );
    const joinedCount =
      session?._count?.participants ?? joinedParticipants.length;

    return {
      phase,
      currentStep,
      totalSteps,
      currentPlace: current?.venue ?? null,
      endTime: current?.endTimeLabel ?? this.formatClock(session?.endedAt ?? chat.meetupEndsAt),
      startsInLabel:
        phase === 'soon' ? this.formatStartsIn(session?.startsAt ?? chat.meetupStartsAt) : null,
      routeId: route?.id ?? null,
      sessionId: session?.id ?? null,
      mode,
      privacy: session?.privacy ?? null,
      joinedCount: session ? joinedCount : null,
      maxGuests: session?.capacity ?? null,
      hostUserId: session?.host?.id ?? null,
      hostName: session?.host?.displayName ?? null,
      area: session?.route.area ?? null,
    };
  }

  private phaseFromSession(value: string | null | undefined) {
    if (value === 'live') {
      return 'live';
    }
    if (value === 'done' || value === 'canceled') {
      return 'done';
    }
    return 'soon';
  }

  private phaseFromEvent(
    event: {
      liveState?: { status: string } | null;
      startsAt?: Date | null;
      durationMinutes?: number | null;
    } | null,
  ) {
    if (event?.liveState?.status === 'live') {
      return 'live';
    }
    if (event?.liveState?.status === 'finished') {
      return 'done';
    }
    if (!event?.startsAt) {
      return 'upcoming';
    }

    const msUntilStart = event.startsAt.getTime() - Date.now();
    const durationMinutes =
      event.durationMinutes && event.durationMinutes > 0
        ? event.durationMinutes
        : 120;
    const msUntilEnd = msUntilStart + durationMinutes * 60 * 1000;
    if (msUntilEnd <= 0) {
      return 'done';
    }
    if (msUntilStart > 0 && msUntilStart <= 2 * 60 * 60 * 1000) {
      return 'soon';
    }

    return 'upcoming';
  }

  private normalizeMeetupPhase(value: string | null | undefined) {
    return value === 'live' || value === 'soon' || value === 'done'
      ? value
      : 'upcoming';
  }

  private normalizeEveningMode(value: string | null | undefined) {
    return value === 'auto' || value === 'manual' || value === 'hybrid'
      ? value
      : 'hybrid';
  }

  private normalizeCurrentStep(value: number | null | undefined, totalSteps: number | null) {
    if (totalSteps == null || totalSteps <= 0) {
      return null;
    }
    if (value == null || value < 1) {
      return 1;
    }
    return Math.min(value, totalSteps);
  }

  private formatStartsIn(value: Date | null | undefined) {
    if (!value) {
      return null;
    }

    const diffMinutes = Math.max(
      1,
      Math.round((value.getTime() - Date.now()) / 60000),
    );
    if (diffMinutes >= 60) {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return minutes > 0 ? `Через ${hours} ч ${minutes} мин` : `Через ${hours} ч`;
    }
    return `Через ${diffMinutes} мин`;
  }

  private formatClock(value: Date | null | undefined) {
    if (!value) {
      return null;
    }

    return new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Europe/Moscow',
    }).format(value);
  }

  async getMessages(userId: string, chatId: string, params: { cursor?: string; limit?: number }) {
    await this.assertMembership(userId, chatId);
    const blockedUserIds = await this.getBlockedUserIds(userId);
    const take = this.normalizeMessagesLimit(params.limit);
    const cursorMessage = await this.resolveMessageCursor(
      chatId,
      params.cursor,
      blockedUserIds,
    );

    const [messages, latestEvent] = await Promise.all([
      this.prismaService.client.message.findMany({
        where: {
          chatId,
          senderId: {
            notIn: [...blockedUserIds],
          },
          ...(cursorMessage
            ? {
                OR: [
                  {
                    createdAt: {
                      lt: cursorMessage.createdAt,
                    },
                  },
                  {
                    createdAt: cursorMessage.createdAt,
                    id: {
                      lt: cursorMessage.id,
                    },
                  },
                ],
              }
            : {}),
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
        orderBy: [
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
        take: take + 1,
      }),
      this.prismaService.client.realtimeEvent.findFirst({
        where: { chatId },
        orderBy: { id: 'desc' },
        select: { id: true },
      }),
    ]);
    const hasMore = messages.length > take;
    const page = hasMore ? messages.slice(0, take) : messages;
    const visiblePage = page.map((message) => ({
      ...message,
      replyTo:
        message.replyTo != null && blockedUserIds.has(message.replyTo.senderId)
          ? null
          : message.replyTo,
    }));
    const mapped = [...visiblePage]
      .reverse()
      .map((message) => mapMessage(message));
    return {
      items: mapped,
      nextCursor:
        hasMore && page.length > 0
          ? this.encodeMessageCursor(page[page.length - 1]!)
          : null,
      lastEventId: latestEvent?.id.toString() ?? null,
    };
  }

  async markRead(userId: string, chatId: string, messageId: string) {
    await this.assertMembership(userId, chatId);
    const blockedUserIds = await this.getBlockedUserIds(userId);
    const message = await this.prismaService.client.message.findFirst({
      where: {
        id: messageId,
        chatId,
        senderId: {
          notIn: [...blockedUserIds],
        },
      },
      select: { id: true },
    });

    if (!message) {
      throw new ApiError(404, 'message_not_found', 'Message not found');
    }

    const now = new Date();

    await this.prismaService.client.$transaction(async (tx) => {
      await tx.chatMember.update({
        where: {
          chatId_userId: {
            chatId,
            userId,
          },
        },
        data: {
          lastReadMessageId: messageId,
          lastReadAt: now,
          unreadCount: 0,
        },
      });

      await tx.notification.updateMany({
        where: {
          userId,
          kind: 'message',
          readAt: null,
          chatId,
          messageId,
        },
        data: {
          readAt: now,
        },
      });
    });

    return { ok: true };
  }

  private normalizeMessagesLimit(limit?: number) {
    if (limit == null || !Number.isFinite(limit)) {
      return 50;
    }

    return Math.max(1, Math.min(Math.trunc(limit), 100));
  }

  private normalizeChatListLimit(limit?: number) {
    if (limit == null || !Number.isFinite(limit)) {
      return 20;
    }

    return Math.max(1, Math.min(Math.trunc(limit), 50));
  }

  private async resolveChatListCursor(cursor?: string): Promise<ChatListCursor | null> {
    const decoded = this.decodeCursorPayload(cursor);
    if (decoded == null) {
      return null;
    }

    const updatedAt = this.parseCursorDate(decoded.updatedAt);
    if (updatedAt) {
      return {
        id: decoded.value,
        updatedAt,
      };
    }

    return this.prismaService.client.chat.findUnique({
      where: { id: decoded.value },
      select: {
        id: true,
        updatedAt: true,
      },
    });
  }

  private decodeCursorPayload(cursor?: string) {
    if (!cursor) {
      return null;
    }

    try {
      const decoded = decodeCursor(cursor);
      if (decoded?.value) {
        return decoded;
      }
    } catch {
      return { value: cursor };
    }

    return null;
  }

  private encodeChatListCursor(chat: ChatListCursor) {
    return encodeCursor({
      value: chat.id,
      updatedAt: chat.updatedAt.toISOString(),
    });
  }

  private async resolveMessageCursor(
    chatId: string,
    cursor: string | undefined,
    blockedUserIds: Set<string>,
  ): Promise<MessageCursor | null> {
    const decoded = this.decodeCursorPayload(cursor);
    if (decoded == null) {
      return null;
    }

    const createdAt = this.parseCursorDate(decoded.createdAt);
    if (createdAt) {
      return {
        id: decoded.value,
        createdAt,
      };
    }

    return this.prismaService.client.message.findFirst({
      where: {
        id: decoded.value,
        chatId,
        senderId: {
          notIn: [...blockedUserIds],
        },
      },
      select: {
        id: true,
        createdAt: true,
      },
    });
  }

  private encodeMessageCursor(message: MessageCursor) {
    return encodeCursor({
      value: message.id,
      createdAt: message.createdAt.toISOString(),
    });
  }

  private parseCursorDate(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }

    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  private async getUnreadCountsByChat(
    userId: string,
    chatIds: string[],
    blockedUserIds: Set<string>,
  ) {
    if (chatIds.length === 0) {
      return new Map<string, number>();
    }

    const canReadUnreadCounters =
      process.env.CHAT_UNREAD_COUNTER_READS !== 'false' &&
      typeof this.prismaService.client.chatMember?.findMany === 'function';

    if (canReadUnreadCounters) {
      const rows = await this.prismaService.client.chatMember.findMany({
        where: {
          userId,
          chatId: {
            in: chatIds,
          },
        },
        select: {
          chatId: true,
          unreadCount: true,
        },
      });

      return new Map(
        rows.map((item) => [item.chatId, item.unreadCount]),
      );
    }

    const blockedSenderFilter = blockedUserIds.size === 0
      ? Prisma.empty
      : Prisma.sql`AND m."senderId" NOT IN (${Prisma.join([...blockedUserIds])})`;
    const rows = await this.prismaService.client.$queryRaw<Array<{
      chat_id: string;
      unread_count: bigint | number;
    }>>`
      SELECT cm."chatId" AS chat_id, COUNT(m."id") AS unread_count
      FROM "ChatMember" cm
      LEFT JOIN "Message" last_read
        ON last_read."chatId" = cm."chatId"
        AND last_read."id" = cm."lastReadMessageId"
      LEFT JOIN "Message" m
        ON m."chatId" = cm."chatId"
        AND m."senderId" <> cm."userId"
        AND (
          COALESCE(cm."lastReadAt", last_read."createdAt") IS NULL
          OR m."createdAt" > COALESCE(cm."lastReadAt", last_read."createdAt")
        )
        ${blockedSenderFilter}
      WHERE cm."userId" = ${userId}
        AND cm."chatId" IN (${Prisma.join(chatIds)})
      GROUP BY cm."chatId"
    `;

    return new Map(
      rows.map((item) => [item.chat_id, Number(item.unread_count)]),
    );
  }

  private async assertMembership(userId: string, chatId: string) {
    const member = await this.prismaService.client.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
      select: {
        chat: {
          select: {
            kind: true,
            event: {
              select: {
                hostId: true,
              },
            },
          },
        },
      },
    });

    if (!member) {
      throw new ApiError(403, 'chat_forbidden', 'You are not a member of this chat');
    }

    if (member.chat.kind === ChatKind.direct) {
      const peer = await this.prismaService.client.chatMember.findFirst({
        where: {
          chatId,
          userId: {
            not: userId,
          },
        },
        select: {
          userId: true,
        },
      });
      if (peer != null) {
        const blockedUserIds = await this.getBlockedUserIds(userId);
        if (blockedUserIds.has(peer.userId)) {
          throw new ApiError(403, 'chat_forbidden', 'You are not a member of this chat');
        }
      }
    }

    if (member.chat.kind === ChatKind.meetup && member.chat.event?.hostId != null) {
      const blockedUserIds = await this.getBlockedUserIds(userId);
      if (blockedUserIds.has(member.chat.event.hostId) && member.chat.event.hostId !== userId) {
        throw new ApiError(403, 'chat_forbidden', 'You are not a member of this chat');
      }
    }
  }

  private resolveAfterDarkGlow(isAfterDark: boolean, glow: string | null) {
    if (!isAfterDark) {
      return glow;
    }

    return glow ?? 'magenta';
  }

  private async getBlockedUserIds(userId: string) {
    return loadBlockedUserIds(this.prismaService.client, userId);
  }
}

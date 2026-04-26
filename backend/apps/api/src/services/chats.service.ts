import { buildMessagePreview, decodeCursor, encodeCursor } from '@big-break/database';
import { ChatKind, Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { formatEventTime, formatRelativeTime, mapMessage } from '../common/presenters';
import { PrismaService } from './prisma.service';

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
            isAfterDark: true,
            afterDarkGlow: true,
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
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                online: true,
              },
            },
          },
        },
        messages: {
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
        const visibleMessages = chat.messages.filter(
          (message) => !blockedUserIds.has(message.senderId),
        );
        const lastMessage = visibleMessages[0] ?? null;
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
              ? encodeCursor({ value: page[page.length - 1]!.id })
              : null,
    };
  }

  async getMessages(userId: string, chatId: string, params: { cursor?: string; limit?: number }) {
    await this.assertMembership(userId, chatId);
    const blockedUserIds = await this.getBlockedUserIds(userId);
    const take = this.normalizeMessagesLimit(params.limit);
    const cursorId = this.decodeMessageCursor(params.cursor);
    const cursorMessage = cursorId
      ? await this.prismaService.client.message.findFirst({
          where: {
            id: cursorId,
            chatId,
            senderId: {
              notIn: [...blockedUserIds],
            },
          },
          select: {
            id: true,
            createdAt: true,
          },
        })
      : null;

    const messages = await this.prismaService.client.message.findMany({
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
    });
    const hasMore = messages.length > take;
    const page = hasMore ? messages.slice(0, take) : messages;
    const mapped = [...page]
      .reverse()
      .map((message) => mapMessage(message));
    const latestEvent = await this.prismaService.client.realtimeEvent.findFirst({
      where: { chatId },
      orderBy: { id: 'desc' },
      select: { id: true },
    });

    return {
      items: mapped,
      nextCursor:
        hasMore && page.length > 0
          ? encodeCursor({ value: page[page.length - 1]!.id })
          : null,
      lastEventId: latestEvent?.id.toString() ?? null,
    };
  }

  async markRead(userId: string, chatId: string, messageId: string) {
    await this.assertMembership(userId, chatId);
    const message = await this.prismaService.client.message.findFirst({
      where: {
        id: messageId,
        chatId,
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

  private async resolveChatListCursor(cursor?: string) {
    const cursorId = this.decodeMessageCursor(cursor);
    if (cursorId == null) {
      return null;
    }

    return this.prismaService.client.chat.findUnique({
      where: { id: cursorId },
      select: {
        id: true,
        updatedAt: true,
      },
    });
  }

  private decodeMessageCursor(cursor?: string) {
    if (!cursor) {
      return null;
    }

    try {
      return decodeCursor(cursor)?.value ?? null;
    } catch {
      return cursor;
    }
  }

  private async getUnreadCountsByChat(
    userId: string,
    chatIds: string[],
    blockedUserIds: Set<string>,
  ) {
    if (chatIds.length === 0) {
      return new Map<string, number>();
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
    const member = await this.prismaService.client.chatMember.findFirst({
      where: {
        chatId,
        userId,
      },
      include: {
        chat: {
          include: {
            event: {
              select: {
                hostId: true,
              },
            },
            members: {
              select: {
                userId: true,
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
      const peerUserId = member.chat.members.find((entry) => entry.userId !== userId)?.userId;
      if (peerUserId != null) {
        const blockedUserIds = await this.getBlockedUserIds(userId);
        if (blockedUserIds.has(peerUserId)) {
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
    const blocks = await this.prismaService.client.userBlock.findMany({
      where: {
        OR: [
          { userId },
          { blockedUserId: userId },
        ],
      },
      select: {
        userId: true,
        blockedUserId: true,
      },
    });

    const blockedUserIds = new Set<string>();
    for (const block of blocks) {
      if (block.userId === userId) {
        blockedUserIds.add(block.blockedUserId);
      }
      if (block.blockedUserId === userId) {
        blockedUserIds.add(block.userId);
      }
    }

    return blockedUserIds;
  }
}

import { buildMessagePreview, decodeCursor, encodeCursor } from '@big-break/database';
import { ChatKind } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { paginateArray } from '../common/pagination';
import { formatEventTime, formatRelativeTime, mapMessage } from '../common/presenters';
import { PrismaService } from './prisma.service';

@Injectable()
export class ChatsService {
  constructor(private readonly prismaService: PrismaService) {}

  async listChats(userId: string, kind: 'meetup' | 'direct', params: { cursor?: string; limit?: number }) {
    const blockedUserIds = await this.getBlockedUserIds(userId);

    const membership = await this.prismaService.client.chatMember.findMany({
      where: {
        userId,
        chat: {
          kind: kind === 'meetup' ? ChatKind.meetup : ChatKind.direct,
        },
      },
      include: {
        chat: {
          include: {
            event: {
              select: {
                id: true,
                hostId: true,
                startsAt: true,
              },
            },
            sourceEvent: {
              select: {
                title: true,
                hostId: true,
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
        },
      },
      orderBy: {
        chat: {
          updatedAt: 'desc',
        },
      },
    });
    const unreadByChatId = await this.getUnreadCountsByChat(
      userId,
      membership.map((member) => member.chat.id),
      blockedUserIds,
    );

    const items = (
      await Promise.all(
      membership.map(async (member) => {
        const visibleMessages = member.chat.messages.filter(
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
        const unread = unreadByChatId.get(member.chat.id) ?? 0;

        if (kind === 'meetup') {
          if (member.chat.event?.hostId && blockedUserIds.has(member.chat.event.hostId)) {
            return null;
          }

          const eventTime = member.chat.event ? formatEventTime(member.chat.event.startsAt) : '';
          const parts = eventTime.split('·');

          return {
            id: member.chat.id,
            eventId: member.chat.event?.id,
            title: member.chat.title,
            emoji: member.chat.emoji,
            time: parts[1]?.trim() ?? '',
            status: parts[0]?.trim() ?? '',
            lastMessage: lastMessagePreview,
            lastAuthor: lastMessage?.sender.displayName ?? '',
            lastTime: lastMessage ? formatRelativeTime(lastMessage.createdAt) : '',
            unread,
            members: member.chat.members
              .filter((entry) => !blockedUserIds.has(entry.userId))
              .map((entry) => entry.user.displayName),
            typing: false,
          };
        }

        const peer = member.chat.members.find((entry) => entry.userId !== userId)?.user;
        if (!peer || blockedUserIds.has(peer.id)) {
          return null;
        }

        return {
          id: member.chat.id,
          name: peer?.displayName ?? 'Личный чат',
          lastMessage: lastMessagePreview,
          lastTime: lastMessage ? formatRelativeTime(lastMessage.createdAt) : '',
          unread,
          online: peer?.online ?? false,
          fromMeetup:
            member.chat.sourceEvent?.hostId != null &&
            blockedUserIds.has(member.chat.sourceEvent.hostId)
              ? null
              : member.chat.sourceEvent?.title ?? null,
        };
      }),
      )
    ).filter((item): item is NonNullable<typeof item> => item != null);

    return paginateArray(items, params.limit ?? 20, (item) => item.id, params.cursor);
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
        sender: true,
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

    const grouped = await this.prismaService.client.notification.groupBy({
      by: ['chatId'],
      where: {
        userId,
        kind: 'message',
        readAt: null,
        chatId: {
          in: chatIds,
        },
        ...(blockedUserIds.size === 0
          ? {}
          : {
              OR: [
                { actorUserId: null },
                {
                  actorUserId: {
                    notIn: [...blockedUserIds],
                  },
                },
              ],
            }),
      },
      _count: {
        _all: true,
      },
    });

    return new Map(
      grouped
        .filter((item) => item.chatId != null)
        .map((item) => [item.chatId!, item._count._all]),
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

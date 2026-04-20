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
            event: true,
            sourceEvent: true,
            members: {
              include: {
                user: {
                  include: {
                    profile: true,
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
              take: 20,
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

    const items = (
      await Promise.all(
      membership.map(async (member) => {
        const visibleMessages = member.chat.messages.filter(
          (message) => !blockedUserIds.has(message.senderId),
        );
        const lastMessage = visibleMessages[0] ?? null;
        const unread = await this.countUnread(member.chat.id, userId, member.lastReadMessageId ?? undefined);

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
            lastMessage: lastMessage?.text ?? '',
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
          lastMessage: lastMessage?.text ?? '',
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

    const messages = await this.prismaService.client.message.findMany({
      where: { chatId },
      include: {
        sender: true,
        attachments: {
          include: {
            mediaAsset: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const mapped = messages
      .filter((message) => !blockedUserIds.has(message.senderId))
      .map((message) => mapMessage(message));
    return paginateArray(mapped, params.limit ?? 50, (item) => item.id, params.cursor);
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

      const unreadNotifications = await tx.notification.findMany({
        where: {
          userId,
          kind: 'message',
          readAt: null,
        },
        select: {
          id: true,
          payload: true,
        },
      });

      const notificationIds = unreadNotifications
        .filter((notification) => {
          const payload = notification.payload as Record<string, unknown> | null;
          return payload?.chatId === chatId;
        })
        .map((notification) => notification.id);

      if (notificationIds.length > 0) {
        await tx.notification.updateMany({
          where: {
            id: {
              in: notificationIds,
            },
          },
          data: {
            readAt: now,
          },
        });
      }
    });

    return { ok: true };
  }

  async countUnread(chatId: string, userId: string, lastReadMessageId?: string) {
    const blockedUserIds = await this.getBlockedUserIds(userId);
    let createdAfter: Date | undefined;

    if (lastReadMessageId) {
      const lastReadMessage = await this.prismaService.client.message.findUnique({
        where: { id: lastReadMessageId },
      });
      createdAfter = lastReadMessage?.createdAt;
    }

    return this.prismaService.client.message.count({
      where: {
        chatId,
        senderId: {
          notIn: [userId, ...blockedUserIds],
        },
        ...(createdAfter
          ? {
              createdAt: {
                gt: createdAfter,
              },
            }
          : {}),
      },
    });
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

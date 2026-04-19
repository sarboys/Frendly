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

    const items = await Promise.all(
      membership.map(async (member) => {
        const lastMessage = member.chat.messages[0] ?? null;
        const unread = await this.countUnread(member.chat.id, userId, member.lastReadMessageId ?? undefined);

        if (kind === 'meetup') {
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
            members: member.chat.members.map((entry) => entry.user.displayName),
            typing: member.chat.id === 'mc1',
          };
        }

        const peer = member.chat.members.find((entry) => entry.userId !== userId)?.user;

        return {
          id: member.chat.id,
          name: peer?.displayName ?? 'Личный чат',
          lastMessage: lastMessage?.text ?? '',
          lastTime: lastMessage ? formatRelativeTime(lastMessage.createdAt) : '',
          unread,
          online: peer?.online ?? false,
          fromMeetup:
            member.chat.sourceEvent?.title
              ?.replace(' на крыше', '')
              ?.replace(' по бульварам', '') ?? null,
        };
      }),
    );

    return paginateArray(items, params.limit ?? 20, (item) => item.id, params.cursor);
  }

  async getMessages(userId: string, chatId: string, params: { cursor?: string; limit?: number }) {
    await this.assertMembership(userId, chatId);

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

    const mapped = messages.map((message) => mapMessage(message));
    return paginateArray(mapped, params.limit ?? 50, (item) => item.id, params.cursor);
  }

  async markRead(userId: string, chatId: string, messageId: string) {
    await this.assertMembership(userId, chatId);

    await this.prismaService.client.chatMember.update({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
      data: {
        lastReadMessageId: messageId,
        lastReadAt: new Date(),
      },
    });

    return { ok: true };
  }

  async countUnread(chatId: string, userId: string, lastReadMessageId?: string) {
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
          not: userId,
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
    const member = await this.prismaService.client.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ApiError(403, 'chat_forbidden', 'You are not a member of this chat');
    }
  }
}

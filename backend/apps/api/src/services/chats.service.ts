import {
  buildMessagePreview,
  decodeCursor,
  encodeCursor,
  getBlockedUserIds as loadBlockedUserIds,
} from '@big-break/database';
import { ChatKind, MediaAssetKind, Prisma } from '@prisma/client';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ApiError } from '../common/api-error';
import {
  formatEventTime,
  formatRelativeTime,
  mapMessage,
  mapProfilePhoto,
} from '../common/presenters';
import { mapMediaVariants } from '../common/media-presenters';
import {
  emptyProfileSocialPreview,
  loadProfileSocialPreviews,
} from '../common/profile-social-preview';
import { PrismaService } from './prisma.service';
import { RedisCacheService } from './redis-cache.service';

const CHAT_MEMBER_PREVIEW_LIMIT = 8;
const CHAT_LIST_CACHE_SECONDS = 2;
const CHAT_MESSAGES_CACHE_SECONDS = 1;
const READ_MARKER_LOCAL_CACHE_SECONDS = 10;
const LOCAL_CACHE_MAX_ENTRIES = 5000;
const MEETUP_AUTO_FINISH_MS = 24 * 60 * 60 * 1000;
type ChatListRequestKind = 'meetup' | 'direct' | 'community';
type ChatListCachePayload = { etag: string; response: unknown };

const chatMessageMediaAssetSelect = {
  id: true,
  kind: true,
  status: true,
  mimeType: true,
  byteSize: true,
  durationMs: true,
  originalFileName: true,
  publicUrl: true,
  waveform: true,
  variants: true,
} satisfies Prisma.MediaAssetSelect;

const chatReplyAttachmentSelect = {
  mediaAsset: {
    select: {
      kind: true,
    },
  },
} satisfies Prisma.MessageAttachmentSelect;

const chatSenderProfilePhotoSelect = {
  id: true,
  sortOrder: true,
  mediaAsset: {
    select: {
      id: true,
      kind: true,
      mimeType: true,
      byteSize: true,
      durationMs: true,
      publicUrl: true,
      variants: true,
    },
  },
} satisfies Prisma.ProfilePhotoSelect;

const chatListLastMessageSelect = {
  id: true,
  text: true,
  createdAt: true,
  sender: {
    select: {
      displayName: true,
    },
  },
  attachments: {
    select: chatReplyAttachmentSelect,
  },
} satisfies Prisma.MessageSelect;

const chatMessageSelect = {
  id: true,
  chatId: true,
  senderId: true,
  text: true,
  clientMessageId: true,
  locationLatitude: true,
  locationLongitude: true,
  locationLabel: true,
  locationExpiresAt: true,
  createdAt: true,
  sender: {
    select: {
      displayName: true,
      profile: {
        select: {
          avatarUrl: true,
          photos: {
            orderBy: {
              sortOrder: 'asc',
            },
            take: 1,
            select: chatSenderProfilePhotoSelect,
          },
        },
      },
    },
  },
  replyTo: {
    select: {
      id: true,
      senderId: true,
      text: true,
      sender: {
        select: {
          displayName: true,
        },
      },
      attachments: {
        select: chatReplyAttachmentSelect,
      },
    },
  },
  attachments: {
    select: {
      mediaAsset: {
        select: chatMessageMediaAssetSelect,
      },
    },
  },
} satisfies Prisma.MessageSelect;

interface ChatListCursor {
  id: string;
  updatedAt: Date;
}

interface MessageCursor {
  id: string;
  createdAt: Date;
}

interface ChatListMemberState {
  unreadCount: number;
  isPinned: boolean;
  pinnedAt: Date | null;
}

export interface ChatMessagesResponse {
  currentUserId: string;
  items: ReturnType<typeof mapMessage>[];
  nextCursor: string | null;
  lastEventId: string | null;
}

interface LocalCacheEntry<T> {
  expiresAt: number;
  value: T;
}

type ChatListMemberProfile = {
  avatarUrl?: string | null;
  photos?: Array<Parameters<typeof mapProfilePhoto>[0]>;
} | null;

@Injectable()
export class ChatsService {
  private readonly logger = new Logger(ChatsService.name);
  private readonly pendingChatListLoads = new Map<
    string,
    Promise<ChatListCachePayload>
  >();
  private readonly pendingMessageLoads = new Map<
    string,
    Promise<ChatMessagesResponse>
  >();
  private readonly localChatListCache = new Map<
    string,
    LocalCacheEntry<ChatListCachePayload>
  >();
  private readonly localMessageCache = new Map<
    string,
    LocalCacheEntry<ChatMessagesResponse>
  >();
  private readonly localReadMarkerCache = new Map<
    string,
    LocalCacheEntry<true>
  >();

  constructor(
    private readonly prismaService: PrismaService,
    @Optional() private readonly redisCache?: RedisCacheService,
  ) {}

  async listChatsWithCache(
    userId: string,
    kind: ChatListRequestKind,
    params: { cursor?: string; limit?: number; includeSocial?: boolean },
    ifNoneMatch?: string,
  ) {
    const cacheKey = this.chatListCacheKey(userId, kind, params);
    const local = this.getLocalCache(this.localChatListCache, cacheKey);
    if (local?.etag && local.response != null) {
      if (this.matchesEntityTag(ifNoneMatch, local.etag)) {
        return {
          etag: local.etag,
          notModified: true as const,
        };
      }
      return local;
    }

    const cached = await this.redisCache?.getJson<ChatListCachePayload>(cacheKey);
    if (cached?.etag && cached.response != null) {
      this.setLocalCache(
        this.localChatListCache,
        cacheKey,
        cached,
        CHAT_LIST_CACHE_SECONDS,
      );
      if (this.matchesEntityTag(ifNoneMatch, cached.etag)) {
        return {
          etag: cached.etag,
          notModified: true as const,
        };
      }
      return cached;
    }

    const pending = this.pendingChatListLoads.get(cacheKey);
    const payload = pending ?? this.loadChatListCachePayload(userId, kind, params, cacheKey);
    if (pending == null) {
      this.pendingChatListLoads.set(cacheKey, payload);
    }

    const resolved = await payload;

    if (this.matchesEntityTag(ifNoneMatch, resolved.etag)) {
      return {
        etag: resolved.etag,
        notModified: true as const,
      };
    }

    return resolved;
  }

  private async loadChatListCachePayload(
    userId: string,
    kind: ChatListRequestKind,
    params: { cursor?: string; limit?: number; includeSocial?: boolean },
    cacheKey: string,
  ) {
    try {
      const response = await this.listChats(userId, kind, params);
      const payload = {
        etag: this.buildChatListEtag(response),
        response,
      };
      this.setLocalCache(
        this.localChatListCache,
        cacheKey,
        payload,
        CHAT_LIST_CACHE_SECONDS,
      );
      await this.redisCache?.setJson(cacheKey, payload, CHAT_LIST_CACHE_SECONDS);
      return payload;
    } finally {
      this.pendingChatListLoads.delete(cacheKey);
    }
  }

  async listChats(
    userId: string,
    kind: ChatListRequestKind,
    params: { cursor?: string; limit?: number; includeSocial?: boolean },
  ) {
    const blockedUserIds = await this.getBlockedUserIds(userId);
    const take = this.normalizeChatListLimit(params.limit);
    const cursorChat = await this.resolveChatListCursor(params.cursor);
    const includeSocial = params.includeSocial !== false;

    const chats = await this.prismaService.client.chat.findMany({
      where: {
        kind: this.chatKindForList(kind),
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
      select: {
        id: true,
        title: true,
        emoji: true,
        meetupPhase: true,
        meetupMode: true,
        currentStep: true,
        meetupStartsAt: true,
        meetupEndsAt: true,
        updatedAt: true,
        event: {
          select: {
            id: true,
            hostId: true,
            startsAt: true,
            durationMinutes: true,
            isAfterDark: true,
            afterDarkGlow: true,
            sourceExternalContentItem: {
              select: {
                id: true,
                contentKind: true,
                priceFrom: true,
                priceMode: true,
                actionUrl: true,
                imageUrl: true,
                sourceProvider: true,
                venueName: true,
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
            sourceExternalContentItem: {
              select: {
                imageUrl: true,
              },
            },
          },
        },
        members: {
          where: {
            userId: {
              notIn: [...blockedUserIds],
            },
          },
          select: {
            userId: true,
            user: {
              select: {
                id: true,
                displayName: true,
                online: true,
                profile: {
                  select: {
                    gender: true,
                    avatarUrl: true,
                    photos: {
                      orderBy: {
                        sortOrder: 'asc',
                      },
                      take: 1,
                      select: chatSenderProfilePhotoSelect,
                    },
                  },
                },
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
          select: chatListLastMessageSelect,
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
        community: {
          select: {
            id: true,
            name: true,
            imageAsset: {
              select: {
                publicUrl: true,
                variants: true,
              },
            },
            _count: {
              select: {
                members: true,
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
    const [memberStateByChatId, socialByUserId] = await Promise.all([
      this.getChatListMemberStates(
        userId,
        page.map((chat) => chat.id),
      ),
      kind === 'meetup' && includeSocial
        ? loadProfileSocialPreviews(
            this.prismaService.client,
            userId,
            page.flatMap((chat) =>
              chat.members.map((entry) => entry.user.id),
            ),
          )
        : Promise.resolve(new Map()),
    ]);

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
        const memberState = memberStateByChatId.get(chat.id);
        const unread = memberState?.unreadCount ?? 0;
        const isPinned = memberState?.isPinned ?? false;

        if (kind === 'meetup') {
          if (chat.event?.hostId && blockedUserIds.has(chat.event.hostId)) {
            return null;
          }

          const eventTime = chat.event ? formatEventTime(chat.event.startsAt) : '';
          const parts = eventTime.split('·');
          const ticket = this.mapTicketSummary(chat.event);
          const eventImageUrl =
            chat.event?.sourceExternalContentItem?.imageUrl ??
            chat.sourceEvent?.sourceExternalContentItem?.imageUrl ??
            null;
          const memberProfiles = chat.members
            .filter((entry) => !blockedUserIds.has(entry.userId))
            .map((entry) => ({
              userId: entry.user.id,
              name: entry.user.displayName,
              avatarUrl: this.resolveChatListAvatarUrl(entry.user.profile),
              online: entry.user.online ?? false,
              isCurrentUser: entry.userId === userId,
              social:
                socialByUserId.get(entry.user.id) ??
                emptyProfileSocialPreview(),
            }));

          return {
            id: chat.id,
            eventId: chat.event?.id,
            title: chat.title,
            imageUrl: eventImageUrl,
            eventImageUrl,
            coverImageUrl: eventImageUrl,
            emoji: chat.emoji,
            time: parts[1]?.trim() ?? '',
            status: parts[0]?.trim() ?? '',
            lastMessageId: lastMessage?.id ?? null,
            lastMessage: lastMessagePreview,
            lastAuthor: lastMessage?.sender.displayName ?? '',
            lastTime: lastMessage ? formatRelativeTime(lastMessage.createdAt) : '',
            lastMessageAt: lastMessage?.createdAt.toISOString() ?? null,
            updatedAt: chat.updatedAt.toISOString(),
            unread,
            isPinned,
            members: memberProfiles.map((entry) => entry.name),
            memberProfiles,
            typing: false,
            isAfterDark:
              chat.event?.isAfterDark ?? chat.sourceEvent?.isAfterDark ?? false,
            afterDarkGlow: this.resolveAfterDarkGlow(
              chat.event?.isAfterDark ?? chat.sourceEvent?.isAfterDark ?? false,
              chat.event?.afterDarkGlow ?? chat.sourceEvent?.afterDarkGlow ?? null,
            ),
            ...ticket,
            ...this.mapEveningChatPhase(chat),
          };
        }

        if (kind === 'community') {
          if (chat.community == null) {
            return null;
          }

          const memberProfiles = chat.members
            .filter((entry) => !blockedUserIds.has(entry.userId))
            .map((entry) => ({
              userId: entry.user.id,
              name: entry.user.displayName,
              avatarUrl: this.resolveChatListAvatarUrl(entry.user.profile),
              online: entry.user.online ?? false,
              isCurrentUser: entry.userId === userId,
            }));
          const title = chat.community.name || chat.title || 'Сообщество';
          const imageUrl = chat.community.imageAsset?.publicUrl ?? null;

          return {
            id: chat.id,
            kind: 'community',
            communityId: chat.community.id,
            title,
            name: title,
            imageUrl,
            avatarUrl: imageUrl,
            imageVariants: mapMediaVariants(chat.community.imageAsset?.variants),
            lastMessageId: lastMessage?.id ?? null,
            lastMessage: lastMessagePreview,
            lastAuthor: lastMessage?.sender.displayName ?? '',
            lastTime: lastMessage ? formatRelativeTime(lastMessage.createdAt) : '',
            lastMessageAt: lastMessage?.createdAt.toISOString() ?? null,
            updatedAt: chat.updatedAt.toISOString(),
            unread,
            isPinned,
            membersCount: chat.community._count.members,
            members: memberProfiles.map((entry) => entry.name),
            memberProfiles,
            onlineCount: memberProfiles.filter((entry) => entry.online).length,
            typing: false,
          };
        }

        const peer = chat.members.find((entry) => entry.userId !== userId)?.user;
        if (!peer || blockedUserIds.has(peer.id)) {
          return null;
        }
        const peerAvatarUrl = this.resolveChatListAvatarUrl(peer.profile);

        return {
          id: chat.id,
          peerUserId: peer.id,
          peerGender: peer.profile?.gender ?? null,
          imageUrl: peerAvatarUrl,
          avatarUrl: peerAvatarUrl,
          peerAvatarUrl,
          name: peer?.displayName ?? 'Личный чат',
          lastMessageId: lastMessage?.id ?? null,
          lastMessage: lastMessagePreview,
          lastTime: lastMessage ? formatRelativeTime(lastMessage.createdAt) : '',
          lastMessageAt: lastMessage?.createdAt.toISOString() ?? null,
          updatedAt: chat.updatedAt.toISOString(),
          unread,
          isPinned,
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
    items.sort((left, right) => Number(right.isPinned) - Number(left.isPinned));

    return {
      items,
      nextCursor:
          hasMore && page.length > 0
              ? this.encodeChatListCursor(page[page.length - 1]!)
              : null,
    };
  }

  private buildChatListEtag(response: unknown) {
    const hash = createHash('sha256')
      .update(JSON.stringify(response))
      .digest('hex')
      .slice(0, 32);
    return `W/"chat-list-${hash}"`;
  }

  private chatListCacheKey(
    userId: string,
    kind: ChatListRequestKind,
    params: { cursor?: string; limit?: number; includeSocial?: boolean },
  ) {
    const includeSocial = kind === 'meetup' && params.includeSocial !== false;
    return [
      'api',
      'chat-list',
      'v1',
      userId,
      kind,
      params.cursor ?? '',
      this.normalizeChatListLimit(params.limit),
      includeSocial ? 'social' : 'no-social',
    ].join(':');
  }

  private chatMessagesCacheKey(
    userId: string,
    chatId: string,
    params: { cursor?: string; limit?: number },
  ) {
    return [
      'api',
      'chat-messages',
      'v1',
      userId,
      chatId,
      params.cursor ?? '',
      this.normalizeMessagesLimit(params.limit),
    ].join(':');
  }

  private readMarkerCacheKey(userId: string, chatId: string, messageId: string) {
    return ['api', 'chat-read', 'v1', userId, chatId, messageId].join(':');
  }

  private getLocalCache<T>(cache: Map<string, LocalCacheEntry<T>>, key: string) {
    const entry = cache.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      cache.delete(key);
      return null;
    }
    return entry.value;
  }

  private setLocalCache<T>(
    cache: Map<string, LocalCacheEntry<T>>,
    key: string,
    value: T,
    ttlSeconds: number,
  ) {
    if (cache.size >= LOCAL_CACHE_MAX_ENTRIES) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) {
        cache.delete(oldestKey);
      }
    }
    cache.set(key, {
      expiresAt: Date.now() + ttlSeconds * 1000,
      value,
    });
  }

  private async clearChatListCache(userId: string) {
    this.pendingChatListLoads.clear();
    for (const key of this.localChatListCache.keys()) {
      if (key.startsWith(`api:chat-list:v1:${userId}:`)) {
        this.localChatListCache.delete(key);
      }
    }
    await Promise.all([
      this.redisCache?.delete(this.chatListCacheKey(userId, 'meetup', {
        limit: 20,
        includeSocial: true,
      })),
      this.redisCache?.delete(this.chatListCacheKey(userId, 'meetup', {
        limit: 20,
        includeSocial: false,
      })),
      this.redisCache?.delete(this.chatListCacheKey(userId, 'direct', {
        limit: 20,
      })),
      this.redisCache?.delete(this.chatListCacheKey(userId, 'community', {
        limit: 20,
      })),
    ]);
  }

  private matchesEntityTag(ifNoneMatch: string | undefined, etag: string) {
    if (!ifNoneMatch) {
      return false;
    }

    return ifNoneMatch
      .split(',')
      .map((value) => value.trim())
      .some((value) => value === '*' || value === etag);
  }

  private chatKindForList(kind: ChatListRequestKind) {
    if (kind === 'meetup') {
      return ChatKind.meetup;
    }
    if (kind === 'community') {
      return ChatKind.community;
    }
    return ChatKind.direct;
  }

  private resolveChatListAvatarUrl(profile: ChatListMemberProfile) {
    const photo = [...(profile?.photos ?? [])]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((entry) => mapProfilePhoto(entry))[0];
    return photo?.url ?? profile?.avatarUrl ?? null;
  }

  async setPinned(userId: string, chatId: string, isPinned: boolean) {
    try {
      const member = await this.prismaService.client.chatMember.update({
        where: {
          chatId_userId: {
            chatId,
            userId,
          },
        },
        data: {
          isPinned,
          pinnedAt: isPinned ? new Date() : null,
        },
        select: {
          chatId: true,
          isPinned: true,
          pinnedAt: true,
        },
      });
      await this.clearChatListCache(userId);

      return {
        id: member.chatId,
        isPinned: member.isPinned,
        pinnedAt: member.pinnedAt?.toISOString() ?? null,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new ApiError(404, 'chat_not_found', 'Chat not found');
      }
      throw error;
    }
  }

  async deleteChat(userId: string, chatId: string) {
    const membership = await this.prismaService.client.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
      select: {
        chat: {
          select: {
            id: true,
            kind: true,
            event: {
              select: {
                id: true,
                hostId: true,
              },
            },
            eveningSession: {
              select: {
                id: true,
                hostUserId: true,
              },
            },
            community: {
              select: {
                id: true,
                createdById: true,
              },
            },
          },
        },
      },
    });

    if (!membership) {
      throw new ApiError(404, 'chat_not_found', 'Chat not found');
    }

    const chat = membership.chat;
    if (chat.kind === ChatKind.direct) {
      await this.prismaService.client.$transaction(async (tx) => {
        await tx.chatMember.deleteMany({
          where: { chatId, userId },
        });
      });
      this.scheduleChatPayloadCleanup(chat.id, chat.kind);

      return {
        id: chat.id,
        kind: 'direct',
        eventId: null,
      };
    }

    if (chat.kind === ChatKind.community) {
      if (chat.community == null) {
        throw new ApiError(
          409,
          'chat_delete_not_supported',
          'Chat delete is not supported for this chat',
        );
      }

      await this.prismaService.client.$transaction(async (tx) => {
        if (chat.community!.createdById !== userId) {
          await tx.communityMember.deleteMany({
            where: {
              communityId: chat.community!.id,
              userId,
            },
          });
        }

        await tx.chatMember.deleteMany({
          where: { chatId, userId },
        });
      });
      this.scheduleChatPayloadCleanup(chat.id, chat.kind);

      return {
        id: chat.id,
        kind: 'community',
        eventId: null,
        communityId: chat.community.id,
      };
    }

    if (chat.kind !== ChatKind.meetup) {
      throw new ApiError(
        409,
        'chat_delete_not_supported',
        'Chat delete is not supported for this chat',
      );
    }

    if (chat.event != null) {
      await this.prismaService.client.$transaction(async (tx) => {
        if (chat.event!.hostId !== userId) {
          await tx.eventParticipant.deleteMany({
            where: {
              eventId: chat.event!.id,
              userId,
            },
          });

          await tx.eventAttendance.upsert({
            where: {
              eventId_userId: {
                eventId: chat.event!.id,
                userId,
              },
            },
            update: {
              status: 'left',
              leftAt: new Date(),
            },
            create: {
              eventId: chat.event!.id,
              userId,
              status: 'left',
              leftAt: new Date(),
            },
          });
        }

        await tx.chatMember.deleteMany({
          where: { chatId, userId },
        });
      });
      this.scheduleChatPayloadCleanup(chat.id, chat.kind);

      return {
        id: chat.id,
        kind: 'meetup',
        eventId: chat.event.id,
      };
    }

    if (chat.eveningSession == null) {
      throw new ApiError(
        409,
        'chat_delete_not_supported',
        'Chat delete is not supported for this chat',
      );
    }

    await this.prismaService.client.$transaction(async (tx) => {
      if (chat.eveningSession!.hostUserId !== userId) {
        await tx.eveningSessionParticipant.updateMany({
          where: {
            sessionId: chat.eveningSession!.id,
            userId,
          },
          data: {
            status: 'left',
            leftAt: new Date(),
          },
        });
      }

      await tx.chatMember.deleteMany({
        where: { chatId, userId },
      });
    });
    this.scheduleChatPayloadCleanup(chat.id, chat.kind);

    return {
      id: chat.id,
      kind: 'meetup',
      eventId: null,
      sessionId: chat.eveningSession.id,
    };
  }

  private scheduleChatPayloadCleanup(chatId: string, kind: ChatKind) {
    setImmediate(() => {
      void this.cleanupChatPayloadIfEmpty(chatId, kind).catch((error) => {
        this.logger.warn(
          `Failed to cleanup deleted chat payload: chatId=${chatId}`,
          error instanceof Error ? error.stack : undefined,
        );
      });
    });
  }

  private async cleanupChatPayloadIfEmpty(chatId: string, kind: ChatKind) {
    await this.prismaService.client.$transaction(async (tx) => {
      const memberCount = await tx.chatMember.count({
        where: { chatId },
      });
      if (memberCount > 0) {
        return;
      }

      const attachmentKinds = [
        MediaAssetKind.chat_attachment,
        MediaAssetKind.chat_voice,
      ];
      const assets = await tx.mediaAsset.findMany({
        where: {
          chatId,
          kind: {
            in: attachmentKinds,
          },
        },
        select: {
          id: true,
        },
      });
      const assetIds = assets.map((asset) => asset.id);

      await tx.notification.deleteMany({
        where: { chatId },
      });
      await tx.realtimeEvent.deleteMany({
        where: { chatId },
      });
      await tx.message.deleteMany({
        where: { chatId },
      });
      if (assetIds.length > 0) {
        await tx.mediaAsset.deleteMany({
          where: {
            id: {
              in: assetIds,
            },
            chatId,
            kind: {
              in: attachmentKinds,
            },
          },
        });
      }

      if (kind === ChatKind.direct) {
        await tx.chat.delete({
          where: { id: chatId },
        });
      }
    });
  }

  private async getChatListMemberStates(
    userId: string,
    chatIds: string[],
  ): Promise<Map<string, ChatListMemberState>> {
    if (chatIds.length === 0) {
      return new Map();
    }

    const members = await this.prismaService.client.chatMember.findMany({
      where: {
        userId,
        chatId: {
          in: chatIds,
        },
      },
      select: {
        chatId: true,
        unreadCount: true,
        isPinned: true,
        pinnedAt: true,
      },
    });

    return new Map(
      members.map((member) => [
        member.chatId,
        {
          unreadCount: member.unreadCount,
          isPinned: member.isPinned,
          pinnedAt: member.pinnedAt,
        },
      ]),
    );
  }

  private mapTicketSummary(event?: {
    sourceExternalContentItem?: {
      id: string;
      contentKind?: string | null;
      priceFrom?: number | null;
      priceMode?: string | null;
      actionUrl?: string | null;
      sourceProvider?: string | null;
      venueName?: string | null;
    } | null;
  } | null) {
    const affiche = event?.sourceExternalContentItem;
    if (
      affiche != null &&
      (affiche.contentKind == null || affiche.contentKind === 'event') &&
      affiche?.priceMode === 'paid' &&
      (affiche.priceFrom ?? 0) > 0 &&
      (affiche.actionUrl ?? '').trim().length > 0
    ) {
      return {
        ticketUrl: affiche.actionUrl,
        ticketSourceKind: 'affiche',
        ticketSourceId: affiche.id,
        ticketPriceFrom: affiche.priceFrom ?? null,
        ticketProvider: affiche.sourceProvider ?? null,
        ticketVenue: affiche.venueName ?? null,
      };
    }

    return {
      ticketUrl: null,
      ticketSourceKind: null,
      ticketSourceId: null,
      ticketPriceFrom: null,
      ticketProvider: null,
      ticketVenue: null,
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
    if (event?.liveState?.status === 'finished') {
      return 'done';
    }
    if (!event?.startsAt) {
      return 'upcoming';
    }

    const msSinceStart = Date.now() - event.startsAt.getTime();
    if (msSinceStart >= MEETUP_AUTO_FINISH_MS) {
      return 'done';
    }
    if (event.liveState?.status === 'live' || msSinceStart >= 0) {
      return 'live';
    }

    const msUntilStart = -msSinceStart;
    if (msUntilStart <= 2 * 60 * 60 * 1000) {
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

  async getMessages(
    userId: string,
    chatId: string,
    params: { cursor?: string; limit?: number },
  ): Promise<ChatMessagesResponse> {
    const cacheKey = this.chatMessagesCacheKey(userId, chatId, params);
    const local = this.getLocalCache(this.localMessageCache, cacheKey);
    if (local) {
      return local;
    }

    const cached = await this.redisCache?.getJson<ChatMessagesResponse>(cacheKey);
    if (cached) {
      this.setLocalCache(
        this.localMessageCache,
        cacheKey,
        cached,
        CHAT_MESSAGES_CACHE_SECONDS,
      );
      return cached;
    }

    const pending = this.pendingMessageLoads.get(cacheKey);
    const payload = pending ?? this.loadMessages(userId, chatId, params, cacheKey);
    if (pending == null) {
      this.pendingMessageLoads.set(cacheKey, payload);
    }

    return payload;
  }

  private async loadMessages(
    userId: string,
    chatId: string,
    params: { cursor?: string; limit?: number },
    cacheKey: string,
  ): Promise<ChatMessagesResponse> {
    try {
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
          select: chatMessageSelect,
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
      const response = {
        currentUserId: userId,
        items: mapped,
        nextCursor:
          hasMore && page.length > 0
            ? this.encodeMessageCursor(page[page.length - 1]!)
            : null,
        lastEventId: latestEvent?.id.toString() ?? null,
      };
      this.setLocalCache(
        this.localMessageCache,
        cacheKey,
        response,
        CHAT_MESSAGES_CACHE_SECONDS,
      );
      await this.redisCache?.setJson(cacheKey, response, CHAT_MESSAGES_CACHE_SECONDS);
      return response;
    } finally {
      this.pendingMessageLoads.delete(cacheKey);
    }
  }

  async markRead(userId: string, chatId: string, messageId: string) {
    const readCacheKey = this.readMarkerCacheKey(userId, chatId, messageId);
    if (this.getLocalCache(this.localReadMarkerCache, readCacheKey)) {
      return { ok: true };
    }

    const member = await this.assertMembership(userId, chatId);
    if (member.lastReadMessageId === messageId && member.unreadCount === 0) {
      this.setLocalCache(
        this.localReadMarkerCache,
        readCacheKey,
        true,
        READ_MARKER_LOCAL_CACHE_SECONDS,
      );
      return { ok: true };
    }

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
    await this.clearChatListCache(userId);
    this.setLocalCache(
      this.localReadMarkerCache,
      readCacheKey,
      true,
      READ_MARKER_LOCAL_CACHE_SECONDS,
    );

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

  private async assertMembership(userId: string, chatId: string) {
    let member = await this.prismaService.client.chatMember.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
      select: {
        lastReadMessageId: true,
        unreadCount: true,
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
      member =
        (await this.restoreMeetupChatMembership(userId, chatId)) ??
        (await this.restoreCommunityChatMembership(userId, chatId));
      if (!member) {
        throw new ApiError(403, 'chat_forbidden', 'You are not a member of this chat');
      }
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

    return member;
  }

  private async restoreMeetupChatMembership(userId: string, chatId: string) {
    const chat = await this.prismaService.client.chat.findUnique({
      where: { id: chatId },
      select: {
        kind: true,
        event: {
          select: {
            hostId: true,
            participants: {
              where: { userId },
              select: { userId: true },
              take: 1,
            },
          },
        },
      },
    });

    if (chat?.kind !== ChatKind.meetup || chat.event == null) {
      return null;
    }

    const hasEventAccess =
      chat.event.hostId === userId || chat.event.participants.length > 0;
    if (!hasEventAccess) {
      return null;
    }

    await this.prismaService.client.chatMember.upsert({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
      update: {},
      create: {
        chatId,
        userId,
      },
    });

    return {
      lastReadMessageId: null,
      unreadCount: 0,
      chat: {
        kind: chat.kind,
        event: {
          hostId: chat.event.hostId,
        },
      },
    };
  }

  private async restoreCommunityChatMembership(userId: string, chatId: string) {
    const chat = await this.prismaService.client.chat.findUnique({
      where: { id: chatId },
      select: {
        kind: true,
        community: {
          select: {
            createdById: true,
            members: {
              where: { userId },
              select: { userId: true },
              take: 1,
            },
          },
        },
      },
    });

    if (chat?.kind !== ChatKind.community || chat.community == null) {
      return null;
    }

    const hasCommunityAccess =
      chat.community.createdById === userId ||
      chat.community.members.length > 0;
    if (!hasCommunityAccess) {
      return null;
    }

    await this.prismaService.client.chatMember.upsert({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
      update: {},
      create: {
        chatId,
        userId,
      },
    });

    return {
      lastReadMessageId: null,
      unreadCount: 0,
      chat: {
        kind: chat.kind,
        event: null,
      },
    };
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

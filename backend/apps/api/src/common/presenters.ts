import {
  AttendanceStatus,
  Event,
  EventAttendance,
  EventJoinRequest,
  EventLiveState,
  MediaAsset,
  Message,
  Profile,
  User,
} from '@prisma/client';
import { buildMessagePreview } from '@big-break/database';
import { mapMediaAsset, mapProfilePhoto } from './media-presenters';

export { mapMediaAsset, mapProfilePhoto } from './media-presenters';

export function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.max(Math.floor(diffMs / 60000), 0);

  if (diffMin < 1) {
    return 'сейчас';
  }

  if (diffMin < 60) {
    return `${diffMin} мин`;
  }

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return `${diffHours} ч`;
  }

  return 'вчера';
}

export function formatEventTime(startDate: Date): string {
  const hours = `${startDate.getHours()}`.padStart(2, '0');
  const minutes = `${startDate.getMinutes()}`.padStart(2, '0');
  const now = new Date();
  const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const deltaDays = Math.round((startDay - nowDay) / 86400000);

  if (deltaDays === 0) {
    return `Сегодня · ${hours}:${minutes}`;
  }

  if (deltaDays === 1) {
    return `Завтра · ${hours}:${minutes}`;
  }

  return `${hours}:${minutes}`;
}

export function mapMessage(
  message: Message & {
    sender: User;
    replyTo?: (Message & {
      sender: User;
      attachments: Array<{
        mediaAsset: MediaAsset;
      }>;
    }) | null;
    attachments: Array<{
      mediaAsset: MediaAsset;
    }>;
  },
) {
  return {
    id: message.id,
    chatId: message.chatId,
    senderId: message.senderId,
    senderName: message.sender.displayName,
    text: message.text,
    clientMessageId: message.clientMessageId,
    createdAt: message.createdAt.toISOString(),
    replyTo: message.replyTo ? mapReplyPreview(message.replyTo) : null,
    attachments: message.attachments.map((entry) => mapMediaAsset(entry.mediaAsset)),
  };
}

function mapReplyPreview(
  message: Message & {
    sender: User;
    attachments: Array<{
      mediaAsset: MediaAsset;
    }>;
  },
) {
  const isVoice = message.attachments.some(
    (entry) => entry.mediaAsset.kind === 'chat_voice',
  );
  const previewText = buildMessagePreview({
    text: message.text,
    attachments: message.attachments.map((entry) => ({
      kind: entry.mediaAsset.kind,
    })),
  });

  return {
    id: message.id,
    authorId: message.senderId,
    author: message.sender.displayName,
    text: previewText,
    isVoice,
  };
}

export function mapBasicProfile(
  user: User & {
    profile:
      | (Profile & {
          photos?: Array<{
            id: string;
            sortOrder: number;
            mediaAsset: MediaAsset;
          }>;
        })
      | null;
  },
) {
  const photos = (user.profile?.photos ?? [])
    .filter((photo) => photo.mediaAsset.publicUrl)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((photo) => mapProfilePhoto(photo));
  const birthDateAge = user.profile?.birthDate
    ? calculateAge(user.profile.birthDate)
    : null;

  return {
    id: user.id,
    displayName: user.displayName,
    verified: user.verified,
    online: user.online,
    age: birthDateAge ?? user.profile?.age ?? null,
    gender: user.profile?.gender ?? null,
    city: user.profile?.city ?? null,
    area: user.profile?.area ?? null,
    bio: user.profile?.bio ?? null,
    vibe: user.profile?.vibe ?? null,
    rating: user.profile?.rating ?? 0,
    meetupCount: user.profile?.meetupCount ?? 0,
    avatarUrl: photos[0]?.url ?? user.profile?.avatarUrl ?? null,
    photos,
  };
}

function calculateAge(birthDate: Date) {
  const now = new Date();
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birthDate.getUTCMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && now.getUTCDate() < birthDate.getUTCDate())
  ) {
    age -= 1;
  }
  return age;
}

export function mapUserPreview(user: User & { profile: Profile | null }) {
  return {
    userId: user.id,
    displayName: user.displayName,
    avatarUrl: user.profile?.avatarUrl ?? null,
    verified: user.verified,
    online: user.online,
  };
}

export function mapAttendanceStatus(
  attendance?: Pick<EventAttendance, 'status'> | null,
): AttendanceStatus {
  return attendance?.status ?? 'not_checked_in';
}

export function mapJoinRequestStatus(
  request?: Pick<EventJoinRequest, 'status'> | null,
): EventJoinRequest['status'] | null {
  return request?.status ?? null;
}

export function mapLiveStatus(state?: Pick<EventLiveState, 'status'> | null) {
  return state?.status ?? 'idle';
}

export function mapEventSummary(params: {
  event: Event & {
    latitude?: number | null;
    longitude?: number | null;
  };
  participants: Array<{
    userId: string;
    user: Pick<User, 'displayName'>;
  }>;
  currentUserId: string;
  participantCount?: number;
  joined?: boolean;
  joinRequest?: Pick<EventJoinRequest, 'status'> | null;
  attendance?: Pick<EventAttendance, 'status'> | null;
  liveState?: Pick<EventLiveState, 'status'> | null;
}) {
  const {
    event,
    participants,
    currentUserId,
    participantCount,
    joined,
    joinRequest,
    attendance,
    liveState,
  } = params;
  const attendeePreview = participants.filter((participant) => participant.userId !== currentUserId);

  return {
    id: event.id,
    title: event.title,
    emoji: event.emoji,
    time: formatEventTime(event.startsAt),
    startsAtIso: event.startsAt.toISOString(),
    place: event.place,
    distance: `${event.distanceKm.toFixed(1)} км`,
    latitude: event.latitude ?? null,
    longitude: event.longitude ?? null,
    attendees: attendeePreview.slice(0, 5).map((participant) => participant.user.displayName),
    going: participantCount ?? participants.length,
    capacity: event.capacity,
    vibe: event.vibe,
    tone: event.tone,
    hostNote: event.hostNote,
    lifestyle: event.lifestyle,
    priceMode: event.priceMode,
    priceAmountFrom: event.priceAmountFrom,
    priceAmountTo: event.priceAmountTo,
    accessMode: event.accessMode,
    genderMode: event.genderMode,
    visibilityMode: event.visibilityMode,
    joined: joined ?? participants.some((participant) => participant.userId === currentUserId),
    joinMode: event.joinMode,
    joinRequestStatus: mapJoinRequestStatus(joinRequest),
    attendanceStatus: mapAttendanceStatus(attendance),
    liveStatus: mapLiveStatus(liveState),
    isHost: event.hostId === currentUserId,
  };
}

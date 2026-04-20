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

export function mapMediaAsset(asset: MediaAsset) {
  return {
    id: asset.id,
    kind: asset.kind,
    status: asset.status,
    url: asset.publicUrl,
    mimeType: asset.mimeType,
    byteSize: asset.byteSize,
    fileName: asset.originalFileName,
  };
}

export function mapProfilePhoto(
  photo: {
    id: string;
    sortOrder: number;
    mediaAsset: MediaAsset;
  },
) {
  return {
    id: photo.id,
    url: photo.mediaAsset.publicUrl,
    order: photo.sortOrder,
  };
}

export function mapMessage(
  message: Message & {
    sender: User;
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
    attachments: message.attachments.map((entry) => mapMediaAsset(entry.mediaAsset)),
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

  return {
    id: user.id,
    displayName: user.displayName,
    verified: user.verified,
    online: user.online,
    age: user.profile?.age ?? null,
    city: user.profile?.city ?? null,
    area: user.profile?.area ?? null,
    bio: user.profile?.bio ?? null,
    vibe: user.profile?.vibe ?? null,
    rating: user.profile?.rating ?? 0,
    meetupCount: user.profile?.meetupCount ?? 0,
    avatarUrl: user.profile?.avatarUrl ?? photos[0]?.url ?? null,
    photos,
  };
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
  event: Event;
  participants: Array<{
    userId: string;
    user: User & { profile: Profile | null };
  }>;
  currentUserId: string;
  joinRequest?: Pick<EventJoinRequest, 'status'> | null;
  attendance?: Pick<EventAttendance, 'status'> | null;
  liveState?: Pick<EventLiveState, 'status'> | null;
}) {
  const { event, participants, currentUserId, joinRequest, attendance, liveState } = params;
  const attendeePreview = participants.filter((participant) => participant.userId !== currentUserId);

  return {
    id: event.id,
    title: event.title,
    emoji: event.emoji,
    time: formatEventTime(event.startsAt),
    place: event.place,
    distance: `${event.distanceKm.toFixed(1)} км`,
    attendees: attendeePreview.slice(0, 5).map((participant) => participant.user.displayName),
    going: participants.length,
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
    joined: participants.some((participant) => participant.userId === currentUserId),
    joinMode: event.joinMode,
    joinRequestStatus: mapJoinRequestStatus(joinRequest),
    attendanceStatus: mapAttendanceStatus(attendance),
    liveStatus: mapLiveStatus(liveState),
    isHost: event.hostId === currentUserId,
  };
}

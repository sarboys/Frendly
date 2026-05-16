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
import {
  buildMediaProxyPath,
  buildMessagePreview,
  objectKeyFromPublicAssetUrl,
} from '@big-break/database';
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

type MessageMediaAsset = Pick<
  MediaAsset,
  | 'id'
  | 'kind'
  | 'status'
  | 'mimeType'
  | 'byteSize'
  | 'durationMs'
  | 'originalFileName'
  | 'publicUrl'
  | 'waveform'
>;

type MessagePresenterInput = Pick<
  Message,
  'id' | 'chatId' | 'senderId' | 'text' | 'clientMessageId' | 'createdAt'
> & {
  sender: Pick<User, 'displayName'> & {
    profile?: (Pick<Profile, 'avatarUrl'> & {
      photos?: BasicProfilePhoto[];
    }) | null;
  };
  replyTo?: (Pick<Message, 'id' | 'senderId' | 'text'> & {
    sender: Pick<User, 'displayName'>;
    attachments: Array<{
      mediaAsset: Pick<MediaAsset, 'kind'>;
    }>;
  }) | null;
  attachments: Array<{
    mediaAsset: MessageMediaAsset;
  }>;
};

export function mapMessage(
  message: MessagePresenterInput,
) {
  const systemKind = resolveSystemMessageKind(message.clientMessageId);
  const isSystem = systemKind != null;
  const senderAvatarPhoto = isSystem
    ? null
    : ((message.sender.profile?.photos ?? [])
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((photo) => mapProfilePhoto(photo))[0] ?? null);
  return {
    id: message.id,
    chatId: message.chatId,
    senderId: message.senderId,
    senderName: isSystem ? 'Frendly' : message.sender.displayName,
    senderAvatarUrl: isSystem
      ? null
      : senderAvatarPhoto?.url ?? message.sender.profile?.avatarUrl ?? null,
    senderAvatarVariants: senderAvatarPhoto?.variants ?? {},
    text: message.text,
    clientMessageId: message.clientMessageId,
    createdAt: message.createdAt.toISOString(),
    kind: isSystem ? 'system' : 'user',
    ...(systemKind != null ? { systemKind } : {}),
    replyTo: message.replyTo ? mapReplyPreview(message.replyTo) : null,
    attachments: message.attachments.map((entry) => mapMediaAsset(entry.mediaAsset)),
  };
}

function resolveSystemMessageKind(clientMessageId: string) {
  if (!clientMessageId.startsWith('evening-session:')) {
    return null;
  }
  if (clientMessageId.includes(':checkin:') || clientMessageId.includes(':join:')) {
    return 'checkin';
  }
  if (clientMessageId.includes(':step:')) {
    return 'step';
  }
  if (clientMessageId.includes(':finish')) {
    return 'finish';
  }
  return 'launch';
}

function mapReplyPreview(
  message: Pick<Message, 'id' | 'senderId' | 'text'> & {
    sender: Pick<User, 'displayName'>;
    attachments: Array<{
      mediaAsset: Pick<MediaAsset, 'kind'>;
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

type BasicProfilePhoto = {
  id: string;
  sortOrder: number;
  mediaAsset: Pick<
    MediaAsset,
    | 'id'
    | 'kind'
    | 'mimeType'
    | 'byteSize'
    | 'durationMs'
    | 'publicUrl'
    | 'variants'
  >;
};

type BasicProfileUser = Pick<User, 'id' | 'displayName' | 'verified' | 'online'> & {
  profile:
    | (Pick<
        Profile,
        | 'age'
        | 'birthDate'
        | 'gender'
        | 'city'
        | 'area'
        | 'bio'
        | 'vibe'
        | 'rating'
        | 'meetupCount'
        | 'avatarUrl'
        | 'avatarAssetId'
      > & {
        photos?: BasicProfilePhoto[];
      })
    | null;
};

export function mapBasicProfile(user: BasicProfileUser) {
  const photos = (user.profile?.photos ?? [])
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
    avatarUrl:
      photos[0]?.url ??
      (user.profile?.avatarAssetId
        ? buildMediaProxyPath(user.profile.avatarAssetId)
        : user.profile?.avatarUrl ?? null),
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

export function mapUserPreview(
  user: Pick<User, 'id' | 'displayName' | 'verified' | 'online'> & {
    profile: Pick<Profile, 'avatarUrl'> | null;
  },
) {
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

type EventSummaryInput = Pick<
  Event,
  | 'id'
  | 'title'
  | 'emoji'
  | 'startsAt'
  | 'place'
  | 'distanceKm'
  | 'capacity'
  | 'vibe'
  | 'tone'
  | 'hostNote'
  | 'lifestyle'
  | 'priceMode'
  | 'priceAmountFrom'
  | 'priceAmountTo'
  | 'accessMode'
  | 'genderMode'
  | 'visibilityMode'
  | 'requiresVerification'
  | 'requiresFrendlyPlus'
  | 'joinMode'
  | 'hostId'
  | 'eveningRouteId'
  | 'isDate'
> & {
  latitude?: number | null;
  longitude?: number | null;
  sourcePoster?: {
    id: string;
    priceFrom: number;
    ticketUrl: string;
    provider: string;
    venue: string;
  } | null;
  sourceExternalContentItem?: {
    id?: string | null;
    contentKind?: string | null;
    title?: string | null;
    imageUrl: string | null;
    priceFrom?: number | null;
    priceMode?: string | null;
    actionUrl?: string | null;
    sourceProvider?: string | null;
    venueName?: string | null;
    currency?: string | null;
    bookingPromos?: EventBookingPromo[];
  } | null;
};

type EventBookingPromo = {
  title: string;
  description: string | null;
  validUntil: string | null;
  bookingUrl: string | null;
  sourceUrl: string | null;
};

export function mapEventTicketSummary(event?: {
  sourcePoster?: {
    id: string;
    priceFrom: number;
    ticketUrl: string;
    provider: string;
    venue: string;
  } | null;
  sourceExternalContentItem?: {
    id?: string | null;
    contentKind?: string | null;
    title?: string | null;
    priceFrom?: number | null;
    priceMode?: string | null;
    actionUrl?: string | null;
    sourceProvider?: string | null;
    venueName?: string | null;
    currency?: string | null;
    bookingPromos?: EventBookingPromo[];
  } | null;
} | null) {
  const poster = event?.sourcePoster;
  if (poster && poster.priceFrom > 0 && poster.ticketUrl.trim().length > 0) {
    return {
      ticketUrl: poster.ticketUrl,
      ticketSourceKind: 'poster',
      ticketSourceId: poster.id,
      ticketPriceFrom: poster.priceFrom,
      ticketProvider: poster.provider,
      ticketVenue: poster.venue,
    };
  }

  const affiche = event?.sourceExternalContentItem;
  if (
    affiche?.id &&
    (affiche.contentKind == null || affiche.contentKind === 'event') &&
    affiche.priceMode === 'paid' &&
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

export function mapEventBookingSummary(event?: {
  sourceExternalContentItem?: {
    id?: string | null;
    contentKind?: string | null;
    title?: string | null;
    priceFrom?: number | null;
    actionUrl?: string | null;
    sourceProvider?: string | null;
    currency?: string | null;
    bookingPromos?: EventBookingPromo[];
  } | null;
} | null) {
  const place = event?.sourceExternalContentItem;
  if (
    place?.id &&
    place.contentKind === 'place' &&
    (place.actionUrl ?? '').trim().length > 0
  ) {
    return {
      bookingUrl: place.actionUrl,
      bookingProvider: place.sourceProvider ?? null,
      bookingPlaceId: place.id,
      bookingAverageCheck: place.priceFrom ?? null,
      bookingCurrency: place.currency ?? null,
      bookingPromos: (place.bookingPromos ?? []).slice(0, 3),
    };
  }

  return {
    bookingUrl: null,
    bookingProvider: null,
    bookingPlaceId: null,
    bookingAverageCheck: null,
    bookingCurrency: null,
    bookingPromos: [],
  };
}

export function mapEventSummary(params: {
  event: EventSummaryInput;
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
  const attendeePreview = participants.filter(
    (participant) =>
      participant.userId !== currentUserId && participant.userId !== event.hostId,
  );

  return {
    id: event.id,
    title: event.title,
    emoji: event.emoji,
    time: formatEventTime(event.startsAt),
    startsAtIso: event.startsAt.toISOString(),
    place: event.place,
    distance: `${event.distanceKm.toFixed(1)} км`,
    imageUrl: mapExternalContentImageUrl(event.sourceExternalContentItem),
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
    requiresVerification: event.requiresVerification,
    requiresFrendlyPlus: event.requiresFrendlyPlus,
    routeId: event.eveningRouteId,
    isDate: event.isDate,
    joined: joined ?? participants.some((participant) => participant.userId === currentUserId),
    joinMode: event.joinMode,
    joinRequestStatus: mapJoinRequestStatus(joinRequest),
    attendanceStatus: mapAttendanceStatus(attendance),
    liveStatus: mapLiveStatus(liveState),
    isHost: event.hostId === currentUserId,
    ...mapEventTicketSummary(event),
    ...mapEventBookingSummary(event),
  };
}

function mapExternalContentImageUrl(
  source?: { imageUrl: string | null } | null,
) {
  const trimmed = source?.imageUrl?.trim();
  if (!trimmed) {
    return null;
  }

  let objectKey: string | null = null;
  try {
    objectKey = objectKeyFromPublicAssetUrl(trimmed);
  } catch {
    objectKey = null;
  }

  if (!objectKey?.startsWith('external-content/')) {
    return trimmed;
  }

  return `/affiche/images?key=${encodeURIComponent(objectKey)}`;
}

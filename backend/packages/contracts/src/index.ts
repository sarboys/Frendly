export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  lastEventId?: string | null;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
  requestId: string;
}

export type EventFilter = 'nearby' | 'now' | 'calm' | 'newcomers' | 'date';
export type EventLifestyleFilter = 'any' | 'zozh' | 'neutral' | 'anti';
export type EventPriceFilter = 'any' | 'free' | 'cheap' | 'mid' | 'premium';
export type EventGenderFilter = 'any' | 'male' | 'female';
export type EventAccessFilter = 'any' | 'open' | 'request' | 'free';

export interface DevLoginRequest {
  userId?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export type TelegramDispatchKind = 'start' | 'contact';

export interface TelegramDispatchRequest {
  kind: TelegramDispatchKind;
  telegramUserId: string;
  chatId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  startToken?: string;
  startPayload?: string;
}

export interface TelegramDispatchAction {
  type: 'send_message';
  text: string;
  replyMarkup?: Record<string, unknown>;
}

export interface TelegramDispatchResponse {
  actions: TelegramDispatchAction[];
}

export interface UploadUrlResponse {
  uploadUrl: string;
  objectKey: string;
  headers: Record<string, string>;
}

export interface UploadCompleteResponse {
  assetId: string;
  status: 'pending' | 'ready' | 'failed';
}

export interface EveningOptionDto {
  key: string;
  label: string;
  emoji?: string;
  blurb?: string;
  range?: string;
}

export interface EveningOptionsDto {
  goals: EveningOptionDto[];
  moods: EveningOptionDto[];
  budgets: EveningOptionDto[];
  formats: EveningOptionDto[];
  areas: EveningOptionDto[];
}

export interface EveningStepStateDto {
  perkUsed: boolean;
  ticketBought: boolean;
  sentToChat: boolean;
  chatMessageId: string | null;
}

export interface EveningRouteStepDto {
  id: string;
  time: string;
  endTime: string | null;
  kind: string;
  title: string;
  venue: string;
  address: string;
  emoji: string;
  distance: string;
  walkMin: number | null;
  perk: string | null;
  perkShort: string | null;
  ticketPrice: number | null;
  ticketCommission: number | null;
  sponsored: boolean;
  premium: boolean;
  partnerId: string | null;
  description: string | null;
  vibeTag: string | null;
  lat: number;
  lng: number;
  hasShareable: boolean;
  state: EveningStepStateDto;
}

export interface EveningRouteDto {
  id: string;
  title: string;
  vibe: string;
  blurb: string;
  totalPriceFrom: number;
  totalSavings: number;
  durationLabel: string;
  area: string;
  goal: string;
  mood: string;
  budget: string;
  format: string | null;
  premium: boolean;
  locked: boolean;
  recommendedFor: string | null;
  hostsCount: number;
  chatId: string | null;
  steps: EveningRouteStepDto[];
  userState: {
    usedPerkStepIds: string[];
    boughtTicketStepIds: string[];
    sentToChatStepIds: string[];
  };
}

export interface EveningStepActionDto {
  stepId: string;
  perkUsed: boolean;
  perkUsedAt: string | null;
  ticketBought: boolean;
  ticketBoughtAt: string | null;
  sentToChat: boolean;
  sentToChatAt: string | null;
  chatMessageId: string | null;
}

export interface EveningShareToChatDto {
  stepId: string;
  sentToChat: boolean;
  sentToChatAt: string;
  chatId: string;
  messageId: string;
  previewText: string;
  alreadySent: boolean;
}

export type PublicShareTargetType = 'event' | 'evening_session';

export interface CreatePublicShareDto {
  targetType: PublicShareTargetType;
  targetId: string;
}

export interface PublicShareLinkDto {
  slug: string;
  targetType: PublicShareTargetType;
  targetId: string;
  appPath: string;
  url: string;
  deepLink: string;
}

export interface PublicSharePersonDto {
  name: string;
  avatarUrl: string | null;
}

export interface PublicShareRouteStepDto {
  id: string;
  time: string;
  endTime: string | null;
  title: string;
  venue: string;
  address: string;
  emoji: string;
  description: string | null;
  distance: string | null;
  walkMin: number | null;
  perk: string | null;
  lat: number;
  lng: number;
}

export interface PublicShareRouteDto {
  area: string | null;
  durationLabel: string | null;
  totalPriceFrom: number | null;
  totalSavings: number | null;
  steps: PublicShareRouteStepDto[];
}

export interface PublicShareDto extends PublicShareLinkDto {
  kind: PublicShareTargetType;
  title: string;
  emoji: string;
  description: string;
  startsAt: string | null;
  durationMinutes: number | null;
  place: string | null;
  area: string | null;
  vibe: string | null;
  partnerName: string | null;
  partnerOffer: string | null;
  capacity: number;
  host: {
    name: string;
    avatarUrl: string | null;
    verified: boolean;
  };
  people: {
    count: number;
    preview: PublicSharePersonDto[];
  };
  route: PublicShareRouteDto | null;
}

export type MeetupPhase = 'live' | 'soon' | 'upcoming' | 'done';
export type EveningLaunchMode = 'auto' | 'manual' | 'hybrid';

export interface EveningLaunchResponseDto {
  routeId: string;
  chatId: string;
  phase: MeetupPhase;
  mode: EveningLaunchMode;
  currentStep: number;
  totalSteps: number;
  currentPlace: string | null;
  startsAt: string;
  endsAt: string | null;
}

export interface ChatMessageDto {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string | null;
  text: string;
  clientMessageId: string;
  createdAt: string;
  kind?: 'user' | 'system';
  systemKind?: 'launch' | 'checkin' | 'step' | 'finish';
  eventId?: string;
  replyTo?: ReplyPreviewDto | null;
  attachments: MediaAssetDto[];
}

export interface ReplyPreviewDto {
  id: string;
  author: string;
  text: string;
  isVoice: boolean;
}

export type MediaKind =
  | 'avatar'
  | 'chat_attachment'
  | 'chat_voice'
  | 'story_media'
  | 'poster_cover';
export type MediaVisibility = 'public' | 'private';

export interface MediaVariantDto {
  url: string | null;
  downloadUrl: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
  cacheKey?: string | null;
  expiresAt?: string | null;
}

export interface MediaResourceDto {
  id: string;
  kind: MediaKind;
  visibility: MediaVisibility;
  mimeType: string;
  byteSize: number;
  url: string | null;
  downloadUrl: string | null;
  variants: Record<string, MediaVariantDto>;
  durationMs: number | null;
  previewHash: string | null;
  cacheKey: string;
  expiresAt: string | null;
}

export interface MediaAssetDto extends MediaResourceDto {
  status: 'pending' | 'ready' | 'failed';
  fileName: string;
  waveform: number[];
}

export interface WsClientEventMap {
  'session.authenticate': { accessToken: string };
  'chat.subscribe': { chatId: string };
  'chat.unsubscribe': { chatId: string };
  'message.send': {
    chatId: string;
    text: string;
    clientMessageId: string;
    attachmentIds?: string[];
    replyToMessageId?: string;
  };
  'message.edit': {
    chatId: string;
    messageId: string;
    text: string;
  };
  'message.delete': { chatId: string; messageId: string };
  'message.read': { chatId: string; messageId: string };
  'typing.start': { chatId: string };
  'typing.stop': { chatId: string };
  'sync.request': { chatId: string; sinceEventId?: string };
}

export interface WsServerEventMap {
  'session.authenticated': { userId: string };
  'message.created': ChatMessageDto;
  'message.updated': ChatMessageDto;
  'message.deleted': {
    chatId: string;
    messageId: string;
    senderId: string;
    clientMessageId: string;
  };
  'message.attachment_ready': { chatId: string; assetId: string };
  'message.read': { chatId: string; userId: string; messageId: string; readAt: string };
  'typing.changed': { chatId: string; userId: string; isTyping: boolean };
  'chat.updated': {
    chatId: string;
    sessionId?: string;
    routeId?: string;
    phase?: 'live' | 'soon' | 'upcoming' | 'done';
    currentStep?: number | null;
    totalSteps?: number;
    currentPlace?: string | null;
    endTime?: string | null;
    startsInLabel?: string | null;
  };
  'unread.updated': { chatId: string; unreadCount: number };
  'notification.created': {
    userId: string;
    notificationId: string;
    kind: string;
    title: string;
    body: string;
    payload: Record<string, unknown>;
    readAt: string | null;
    createdAt: string;
  };
  'sync.snapshot': {
    chatId: string;
    sinceEventId?: string;
    reset?: boolean;
    hasMore?: boolean;
    nextEventId?: string | null;
    events: Array<{ id: string; type: string; payload: unknown; createdAt: string }>;
  };
}

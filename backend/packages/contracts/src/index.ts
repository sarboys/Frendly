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

export interface PartnerDto {
  id: string;
  name: string;
  city: string;
  status: string;
  contact: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VenueDto {
  id: string;
  ownerType: string;
  partnerId: string | null;
  source: string;
  externalId: string | null;
  moderationStatus: string;
  trustLevel: string;
  city: string;
  timezone: string;
  area: string | null;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
  tags: unknown;
  averageCheck: number | null;
  openingHours: unknown | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlacePromoDto {
  title: string;
  description: string | null;
  validUntil: string | null;
  bookingUrl: string | null;
  sourceUrl: string | null;
}

export interface PlaceSearchResultDto {
  id: string;
  name: string;
  address: string;
  city: string;
  lat: number | null;
  lng: number | null;
  category: string;
  placeKind: string | null;
  averageCheck: number | null;
  currency: string | null;
  rating: number | null;
  bookingUrl: string | null;
  provider: string | null;
  sourceUrl: string | null;
  distanceKm: number | null;
  promos: PlacePromoDto[];
}

export interface PlacePromoListItemDto extends PlacePromoDto {
  id: string;
  city: string;
  venueName: string | null;
  address: string | null;
  placeId: string | null;
  placeName: string | null;
  placeCategory: string | null;
  placeKind: string | null;
  placeBookingUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  averageCheck: number | null;
  currency: string | null;
  provider: string | null;
  distanceKm: number | null;
}

export interface PartnerOfferDto {
  id: string;
  partnerId: string;
  venueId: string;
  title: string;
  description: string;
  terms: string | null;
  shortLabel: string | null;
  validFrom: string | null;
  validTo: string | null;
  daysOfWeek: unknown | null;
  timeWindow: unknown | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface EveningRouteTemplateStepPreviewDto {
  title: string;
  venue: string;
  emoji: string;
  time: string | null;
  kind: string | null;
}

export interface EveningRouteTemplatePartnerOfferPreviewDto {
  partnerId: string;
  title: string;
  shortLabel: string | null;
}

export interface EveningRouteTemplateSessionDto {
  sessionId: string;
  startsAt: string;
  joinedCount: number;
  capacity: number;
}

export interface EveningRouteTemplateSummaryDto {
  id: string;
  routeId: string;
  title: string;
  blurb: string;
  city: string;
  area: string | null;
  badgeLabel: string | null;
  coverUrl: string | null;
  vibe: string;
  budget: string;
  durationLabel: string;
  totalPriceFrom: number;
  totalSavings: number;
  mood: string;
  premium: boolean;
  hostsCount: number;
  stepsPreview: EveningRouteTemplateStepPreviewDto[];
  partnerOffersPreview: EveningRouteTemplatePartnerOfferPreviewDto[];
  nearestSessions: EveningRouteTemplateSessionDto[];
}

export interface EveningRouteTemplateStepDto extends EveningRouteStepDto {
  venueId: string | null;
  partnerOfferId: string | null;
  offerTitle: string | null;
  offerDescription: string | null;
  offerTerms: string | null;
  offerShortLabel: string | null;
}

export interface EveningRouteTemplateDetailDto
  extends EveningRouteTemplateSummaryDto {
  goal: string;
  format: string | null;
  recommendedFor: string | null;
  steps: EveningRouteTemplateStepDto[];
}

export interface AdminEveningRouteTemplateDto {
  id: string;
  source: string;
  status: string;
  city: string;
  timezone: string;
  area: string | null;
  centerLat: number | null;
  centerLng: number | null;
  radiusMeters: number | null;
  currentRouteId: string | null;
  scheduledPublishAt: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  currentRoute: EveningRouteTemplateDetailDto | null;
  revisionCount: number;
}

export interface AdminPartnerOfferAnalyticsFiltersDto {
  from: string | null;
  to: string | null;
  partnerId: string | null;
  venueId: string | null;
}

export interface AdminPartnerOfferAnalyticsPartnerDto {
  partnerId: string;
  partnerName: string;
  city: string | null;
  activations: number;
  uniqueUsers: number;
}

export interface AdminPartnerOfferAnalyticsRouteDto {
  routeTemplateId: string;
  routeTitle: string;
  city: string | null;
  activations: number;
  uniqueUsers: number;
}

export interface AdminPartnerOfferAnalyticsDailyDto {
  date: string;
  activations: number;
  uniqueUsers: number;
}

export interface AdminPartnerOfferAnalyticsDto {
  filters: AdminPartnerOfferAnalyticsFiltersDto;
  activations: number;
  uniqueUsers: number;
  topPartners: AdminPartnerOfferAnalyticsPartnerDto[];
  topRoutes: AdminPartnerOfferAnalyticsRouteDto[];
  daily: AdminPartnerOfferAnalyticsDailyDto[];
}

export interface AdminEveningRouteRevisionStepInput {
  sortOrder: number;
  timeLabel: string;
  endTimeLabel?: string | null;
  kind: string;
  title: string;
  venueId?: string | null;
  partnerOfferId?: string | null;
  venue?: string | null;
  address?: string | null;
  description?: string | null;
  emoji?: string | null;
  distanceLabel?: string | null;
  walkMin?: number | null;
  lat?: number | null;
  lng?: number | null;
  ticketPrice?: number | null;
  ticketUrl?: string | null;
  ticketSourceCode?: string | null;
  ticketProvider?: string | null;
}

export interface ProfileSocialDto {
  followers: number;
  likes: number;
  superLikes: number;
  iFollow: boolean;
  iLike: boolean;
  iSuper: boolean;
}

export type EventInviteState =
  | 'available'
  | 'already_joined'
  | 'pending_invite'
  | 'pending_request';

export interface FollowingPersonDto {
  id: string;
  name: string;
  age: number | null;
  area: string | null;
  common: string[];
  online: boolean;
  verified: boolean;
  vibe: string | null;
  avatarUrl: string | null;
  social: ProfileSocialDto;
  inviteState: EventInviteState;
}

export interface EventInviteResponseDto {
  id: string;
  eventId: string;
  userId: string;
  status: 'pending';
  inviteState: 'pending_invite' | 'pending_request';
}

export interface DeleteChatResponseDto {
  id: string;
  kind: 'meetup' | 'direct' | 'community';
  eventId: string | null;
  sessionId?: string | null;
  communityId?: string | null;
}

export interface MeetupChatMemberProfileDto {
  userId: string;
  name: string;
  online: boolean;
  isCurrentUser: boolean;
  social: ProfileSocialDto;
}

export interface MeetupChatTicketDto {
  ticketUrl: string | null;
  ticketSourceKind: 'affiche' | null;
  ticketSourceId: string | null;
  ticketPriceFrom: number | null;
  ticketProvider: string | null;
  ticketVenue: string | null;
}

export interface AdminEveningRouteRevisionInput {
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
  recommendedFor: string | null;
  badgeLabel: string | null;
  steps: AdminEveningRouteRevisionStepInput[];
}

export interface AdminAiEveningBriefInput {
  city: string;
  timezone?: string | null;
  area?: string | null;
  titleIdea: string;
  audience: string;
  format: string;
  mood: string;
  budget: string;
  durationMinutes: number;
  minSteps?: number;
  maxSteps?: number;
  requiredVenueIds?: string[];
  excludedVenueIds?: string[];
  partnerGoal?: string | null;
  tone?: string | null;
  boldness?: string | null;
  createdByAdminId?: string | null;
}

export interface AdminAiEveningBriefDto {
  id: string;
  city: string;
  timezone: string;
  area: string | null;
  titleIdea: string;
  audience: string;
  format: string;
  mood: string;
  budget: string;
  durationMinutes: number;
  minSteps: number;
  maxSteps: number;
  requiredVenueIds: string[];
  excludedVenueIds: string[];
  partnerGoal: string | null;
  tone: string | null;
  boldness: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAiEveningValidationIssueDto {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  stepIndex?: number;
  venueId?: string | null;
}

export interface AdminAiEveningDraftStepDto {
  id: string;
  sortOrder: number;
  venueId: string | null;
  partnerOfferId: string | null;
  kind: string;
  title: string;
  timeLabel: string;
  endTimeLabel: string | null;
  description: string | null;
  transition: string | null;
  priceEstimate: number | null;
  walkMin: number | null;
}

export interface AdminAiEveningDraftDto {
  id: string;
  briefId: string;
  runId: string | null;
  title: string;
  description: string;
  city: string;
  area: string | null;
  vibe: string;
  budget: string;
  durationLabel: string;
  totalPriceFrom: number;
  score: number;
  validationStatus: string;
  validationIssues: AdminAiEveningValidationIssueDto[];
  selectedAt: string | null;
  createdRouteId: string | null;
  createdAt: string;
  updatedAt: string;
  steps: AdminAiEveningDraftStepDto[];
}

export interface AdminAiEveningGenerateResponseDto {
  runId: string;
  status: string;
  drafts: AdminAiEveningDraftDto[];
}

export interface AdminRouteReviewDraftStepDto {
  id: string;
  sortOrder: number;
  externalContentItemId: string | null;
  timeLabel: string;
  endTimeLabel: string | null;
  kind: string;
  title: string;
  venue: string;
  address: string;
  emoji: string;
  distanceLabel: string;
  walkMin: number | null;
  description: string | null;
  vibeTag: string | null;
  ticketPrice: number | null;
  ticketUrl: string | null;
  ticketSourceCode: string | null;
  ticketProvider: string | null;
  lat: number;
  lng: number;
  sourceUrl: string | null;
  sourceName: string | null;
  sourceTitle: string | null;
}

export interface AdminRouteReviewDraftDto {
  id: string;
  batchId: string;
  status: string;
  title: string;
  description: string;
  city: string;
  timezone: string;
  area: string | null;
  vibe: string;
  budget: string;
  durationLabel: string;
  totalPriceFrom: number;
  goal: string;
  mood: string;
  format: string | null;
  recommendedFor: string | null;
  badgeLabel: string | null;
  score: number;
  validationStatus: string;
  validationIssues: AdminAiEveningValidationIssueDto[];
  reviewedByAdminId: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdTemplateId: string | null;
  publishedAt: string | null;
  rejectedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  steps: AdminRouteReviewDraftStepDto[];
}

export interface AdminRouteReviewDraftListDto {
  items: AdminRouteReviewDraftDto[];
  nextCursor: string | null;
}

export interface AdminRouteReviewActionInput {
  reviewNote?: string | null;
}

export interface AdminRouteReviewSourceDto {
  id: string;
  code: string;
  name: string;
  kind: string;
  status: string;
  lastImportedAt: string | null;
  baseUrl: string | null;
  lastError: string | null;
  lastFetchedCount: number;
  lastPublishedCount: number;
}

export interface AdminRouteReviewSourceListDto {
  items: AdminRouteReviewSourceDto[];
}

export interface AdminExternalImportRunDto {
  id: string;
  sourceId: string;
  sourceCode: string | null;
  city: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  fetchedCount: number;
  normalizedCount: number;
  skippedCount: number;
  publishedCount: number;
  paidCount: number;
  freeCount: number;
  unknownPriceCount: number;
  missingCoordsCount: number;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface AdminExternalImportRunListDto {
  items: AdminExternalImportRunDto[];
}

export interface AdminRouteReviewImportRunInput {
  city: string;
  sources: string[];
  from: string;
  to: string;
  importMode?: string;
}

export interface AdminExternalContentItemDto {
  id: string;
  sourceId: string;
  sourceCode: string | null;
  sourceName: string | null;
  sourceItemId: string;
  sourceUrl: string | null;
  contentKind: string;
  city: string;
  timezone: string;
  area: string | null;
  title: string;
  shortSummary: string | null;
  category: string;
  tags: string[];
  address: string | null;
  lat: number | null;
  lng: number | null;
  startsAt: string | null;
  endsAt: string | null;
  priceFrom: number | null;
  currency: string | null;
  venueName: string | null;
  imageUrl: string | null;
  actionUrl: string | null;
  actionKind: string | null;
  priceMode: string;
  isAffiliate: boolean;
  sourceProvider: string | null;
  placeKind: string | null;
  publicStatus: string;
  hasCoords: boolean;
  routePlannerBlockedReason: string | null;
  rawSummary: string | null;
  moderationStatus: string;
  importedAt: string;
  expiresAt: string | null;
}

export interface AdminExternalContentItemListDto {
  items: AdminExternalContentItemDto[];
  nextCursor: string | null;
}

export interface AfficheEventDto {
  id: string;
  title: string;
  description: string | null;
  city: string;
  venue: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  startsAt: string | null;
  endsAt: string | null;
  dateLabel: string | null;
  timeLabel: string | null;
  category: string;
  priceFrom: number | null;
  priceMode: 'free' | 'paid' | 'unknown';
  currency: string | null;
  imageUrl: string | null;
  imageVariants: Record<string, MediaVariantDto>;
  provider: string | null;
  sourceCode: string | null;
  actionUrl: string | null;
  actionKind: string | null;
  isAffiliate: boolean;
  tags: string[];
}

export interface AfficheEventListDto {
  items: AfficheEventDto[];
  nextCursor: string | null;
}

export interface AdminRouteGenerationRunDto {
  id: string;
  city: string;
  timezone: string;
  area: string | null;
  mood: string;
  budget: string;
  audience: string;
  format: string;
  source: string;
  status: string;
  promptVersion: string;
  maxDrafts: number | null;
  draftCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface AdminRouteGenerationRunListDto {
  items: AdminRouteGenerationRunDto[];
}

export interface AdminRouteGenerationRunInput {
  city: string;
  area?: string | null;
  mood: string;
  budget: string;
  maxDrafts?: number | null;
}

export interface CreateEveningRouteTemplateSessionRequestDto {
  startsAt: string;
  privacy?: 'open' | 'request' | 'invite';
  capacity?: number;
  hostNote?: string | null;
}

export interface CreateEveningRouteTemplateSessionResponseDto {
  sessionId: string;
  routeId: string;
  routeTemplateId: string;
  chatId: string;
  phase: string;
  chatPhase: string;
  privacy: 'open' | 'request' | 'invite';
  inviteToken: string | null;
  mode: EveningLaunchMode;
  currentStep: number | null;
  totalSteps: number;
  currentPlace: string | null;
  startsAt: string;
  endsAt: string | null;
  joinedCount: number;
  maxGuests: number;
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
  ticketUrl: string | null;
  ticketSourceCode: string | null;
  ticketProvider: string | null;
  sponsored: boolean;
  premium: boolean;
  partnerId: string | null;
  venueId?: string | null;
  partnerOfferId?: string | null;
  offerTitle?: string | null;
  offerDescription?: string | null;
  offerTerms?: string | null;
  offerShortLabel?: string | null;
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

export interface EveningAiRouteDraftRequestDto {
  prompt?: string;
  goal?: string;
  mood?: string;
  budget?: string;
  format?: string;
  area?: string;
  stepCount?: number;
  city?: string;
  latitude?: number;
  longitude?: number;
}

export interface EveningAiRouteDraftWarningDto {
  code: string;
  message?: string;
  stepIndex?: number;
  externalContentItemId?: string;
  issues?: EveningAiRouteDraftWarningDto[];
}

export interface EveningAiRouteDraftDto {
  draftId: string;
  route: EveningRouteDto;
  acceptedStepIndexes: number[];
  currentStepIndex: number | null;
  canConfirm: boolean;
  expiresAt: string;
  warnings: EveningAiRouteDraftWarningDto[];
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

export type PartnerOfferCodeStatus = 'issued' | 'activated' | 'expired';

export interface PartnerOfferCodeDto {
  id: string;
  codeUrl: string;
  status: PartnerOfferCodeStatus;
  expiresAt: string;
  activatedAt: string | null;
  offerTitle: string;
  venueName: string;
  partnerName: string;
}

export type PublicPartnerOfferCodeActivationStatus =
  | 'activated'
  | 'already_activated'
  | 'expired'
  | 'not_found';

export interface PublicPartnerOfferCodeActivationDto {
  status: PublicPartnerOfferCodeActivationStatus;
  offerTitle: string | null;
  venueName: string | null;
  partnerName: string | null;
  activatedAt: string | null;
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

export interface EveningSessionSummaryDto {
  id: string;
  sessionId: string;
  routeId: string;
  routeTemplateId: string | null;
  chatId: string;
  phase: string;
  chatPhase: MeetupPhase;
  privacy: 'open' | 'request' | 'invite';
  mode: EveningLaunchMode;
  title: string;
  vibe: string;
  emoji: string;
  area: string | null;
  isCurated: boolean;
  badgeLabel: string | null;
  startsAt: string | null;
  joinedCount: number;
  maxGuests: number;
}

export interface ChatMessageDto {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string | null;
  senderAvatarVariants?: Record<string, MediaVariantDto>;
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
  | 'story_media';
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

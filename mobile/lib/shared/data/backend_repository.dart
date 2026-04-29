import 'dart:io';
import 'dart:typed_data';

import 'package:big_break_mobile/shared/models/auth_flow.dart';
import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/shared/models/event.dart';
import 'package:big_break_mobile/shared/models/event_check_in.dart';
import 'package:big_break_mobile/shared/models/event_detail.dart';
import 'package:big_break_mobile/shared/models/evening_route_template.dart';
import 'package:big_break_mobile/shared/models/evening_session.dart';
import 'package:big_break_mobile/shared/models/after_party_state.dart';
import 'package:big_break_mobile/shared/models/dating_profile.dart';
import 'package:big_break_mobile/shared/models/host_dashboard.dart';
import 'package:big_break_mobile/shared/models/live_meetup.dart';
import 'package:big_break_mobile/shared/models/match.dart';
import 'package:big_break_mobile/shared/models/meetup_chat.dart';
import 'package:big_break_mobile/shared/models/message.dart';
import 'package:big_break_mobile/shared/models/notification_item.dart';
import 'package:big_break_mobile/shared/models/onboarding_data.dart';
import 'package:big_break_mobile/shared/models/paginated_response.dart';
import 'package:big_break_mobile/shared/models/partner_offer_code.dart';
import 'package:big_break_mobile/shared/models/person_summary.dart';
import 'package:big_break_mobile/shared/models/personal_chat.dart';
import 'package:big_break_mobile/shared/models/poster.dart';
import 'package:big_break_mobile/shared/models/profile.dart';
import 'package:big_break_mobile/shared/models/public_share.dart';
import 'package:big_break_mobile/shared/models/safety_hub.dart';
import 'package:big_break_mobile/shared/models/story.dart';
import 'package:big_break_mobile/shared/models/subscription.dart';
import 'package:big_break_mobile/shared/models/tokens.dart';
import 'package:big_break_mobile/shared/models/user_settings.dart';
import 'package:big_break_mobile/shared/models/verification_state.dart';
import 'package:big_break_mobile/shared/utils/voice_metrics.dart';
import 'package:big_break_mobile/features/after_dark/presentation/after_dark_models.dart';
import 'package:big_break_mobile/features/communities/domain/community.dart';
import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final authBootstrapProvider = FutureProvider<void>((ref) async {
  final repository = ref.read(backendRepositoryProvider);
  final authTokensController = ref.read(authTokensProvider.notifier);
  final currentUserIdController = ref.read(currentUserIdProvider.notifier);
  final existingTokens = ref.read(authTokensProvider);
  if (existingTokens == null) {
    currentUserIdController.state = null;
    return;
  }
  try {
    final me = await repository.fetchMe();
    currentUserIdController.state = me.id;
  } on DioException catch (error) {
    final statusCode = error.response?.statusCode;
    if (statusCode == 401) {
      Future<void>.microtask(() {
        authTokensController.clear();
        currentUserIdController.state = null;
      });
      return;
    }
  } catch (_) {}
});

final backendRepositoryProvider = Provider<BackendRepository>((ref) {
  return BackendRepository(
    ref: ref,
    dio: ref.read(apiClientProvider).dio,
  );
});

class BackendRepository {
  BackendRepository({
    required this.ref,
    required this.dio,
    Dio Function()? createUploadDio,
    VoiceMetricReporter? voiceMetricReporter,
  })  : _createUploadDio = createUploadDio ?? _defaultUploadDio,
        _voiceMetricReporter = voiceMetricReporter;

  final Ref ref;
  final Dio dio;
  final Dio Function() _createUploadDio;
  final VoiceMetricReporter? _voiceMetricReporter;

  Options get _publicAuthOptions => Options(
        extra: const {
          'skipAuthHeader': true,
          'skipAuthRefresh': true,
        },
      );

  Future<void> logout() async {
    await dio.post<Map<String, dynamic>>('/auth/logout');
  }

  Future<ProfilePhoto> uploadProfilePhotoFile(PlatformFile file) async {
    final mimeType = _resolveMimeType(file.name);
    final uploadUrlResponse = await dio.post<Map<String, dynamic>>(
      '/uploads/media/upload-url',
      data: {
        'scope': 'profile_photo',
        'fileName': file.name,
        'contentType': mimeType,
      },
    );
    final uploadData = uploadUrlResponse.data!;
    final uploadUrl = uploadData['uploadUrl'] as String;
    final objectKey = uploadData['objectKey'] as String;
    final completeUrl =
        uploadData['completeUrl'] as String? ?? '/uploads/media/complete';
    final uploadHeaders = Map<String, dynamic>.from(
      (uploadData['headers'] as Map?) ?? const {},
    );
    final int byteSize;
    try {
      byteSize = await _putPresignedUpload(
        file,
        uploadUrl: uploadUrl,
        uploadHeaders: uploadHeaders,
      );
    } on DioException {
      return _uploadProfilePhotoViaApiFile(file, mimeType);
    } on SocketException {
      return _uploadProfilePhotoViaApiFile(file, mimeType);
    }

    final response = await dio.post<Map<String, dynamic>>(
      completeUrl,
      data: {
        'scope': 'profile_photo',
        'objectKey': objectKey,
        'mimeType': mimeType,
        'byteSize': byteSize,
        'fileName': file.name,
      },
    );
    return ProfilePhoto.fromJson(
      Map<String, dynamic>.from(response.data!['photo'] as Map),
    );
  }

  Future<ProfilePhoto> _uploadProfilePhotoViaApiFile(
    PlatformFile file,
    String mimeType,
  ) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/uploads/media/file',
      data: FormData.fromMap({
        'scope': 'profile_photo',
        'contentType': mimeType,
        'file': await _profilePhotoMultipartFile(file, mimeType),
      }),
    );
    return ProfilePhoto.fromJson(
      Map<String, dynamic>.from(response.data!['photo'] as Map),
    );
  }

  Future<AuthTokens> devLogin() async {
    return devLoginAs('user-me');
  }

  Future<AuthTokens> devLoginAs(String userId) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/auth/dev/login',
      data: {'userId': userId},
      options: _publicAuthOptions,
    );
    return AuthTokens.fromJson(response.data!);
  }

  Future<PhoneAuthSession> loginWithTestPhoneShortcut(
      String phoneNumber) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/auth/phone/test-login',
      data: {'phoneNumber': phoneNumber},
      options: _publicAuthOptions,
    );
    return PhoneAuthSession.fromJson(response.data!);
  }

  Future<PhoneAuthChallenge> requestPhoneCode(String phoneNumber) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/auth/phone/request',
      data: {'phoneNumber': phoneNumber},
      options: _publicAuthOptions,
    );
    return PhoneAuthChallenge.fromJson(response.data!);
  }

  Future<PhoneAuthSession> verifyPhoneCode({
    required String challengeId,
    required String code,
  }) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/auth/phone/verify',
      data: {
        'challengeId': challengeId,
        'code': code,
      },
      options: _publicAuthOptions,
    );
    return PhoneAuthSession.fromJson(response.data!);
  }

  Future<TelegramAuthStart> startTelegramAuth({String? startToken}) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/auth/telegram/start',
      data: {
        if (startToken != null && startToken.isNotEmpty)
          'startToken': startToken,
      },
      options: _publicAuthOptions,
    );
    return TelegramAuthStart.fromJson(response.data!);
  }

  Future<PhoneAuthSession> verifyTelegramAuth({
    required String loginSessionId,
    required String code,
  }) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/auth/telegram/verify',
      data: {
        'loginSessionId': loginSessionId,
        'code': code,
      },
      options: _publicAuthOptions,
    );
    return PhoneAuthSession.fromJson(response.data!);
  }

  Future<PhoneAuthSession> verifyGoogleIdToken(String idToken) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/auth/google/verify',
      data: {'idToken': idToken},
      options: _publicAuthOptions,
    );
    return PhoneAuthSession.fromJson(response.data!);
  }

  Future<PhoneAuthSession> verifyYandexOAuthToken(String oauthToken) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/auth/yandex/verify',
      data: {'oauthToken': oauthToken},
      options: _publicAuthOptions,
    );
    return PhoneAuthSession.fromJson(response.data!);
  }

  Future<ProfileData> fetchMe() async {
    final response = await dio.get<Map<String, dynamic>>(
      '/profile/me',
      options: Options(
        connectTimeout: const Duration(seconds: 5),
        receiveTimeout: const Duration(seconds: 8),
      ),
    );
    return ProfileData.fromProfileJson(response.data!);
  }

  Future<ProfileData> fetchProfile() async {
    final responses = await Future.wait<Response<Map<String, dynamic>>>([
      dio.get<Map<String, dynamic>>('/profile/me'),
      dio.get<Map<String, dynamic>>('/onboarding/me'),
    ]);
    final profileResponse = responses[0];
    final onboardingResponse = responses[1];
    return ProfileData.fromProfileJson(
      profileResponse.data!,
      onboardingJson: onboardingResponse.data,
    );
  }

  Future<ProfileData> updateProfile(Map<String, dynamic> payload) async {
    await dio.patch<Map<String, dynamic>>('/profile/me', data: payload);
    return fetchProfile();
  }

  Future<PublicShareLink> createPublicShare({
    required String targetType,
    required String targetId,
  }) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/shares',
      data: {
        'targetType': targetType,
        'targetId': targetId,
      },
    );
    return PublicShareLink.fromJson(response.data!);
  }

  Future<OnboardingData> fetchOnboarding() async {
    final response = await dio.get<Map<String, dynamic>>('/onboarding/me');
    return OnboardingData.fromJson(response.data!);
  }

  Future<OnboardingData> saveOnboarding(OnboardingData data) async {
    final response = await dio.put<Map<String, dynamic>>(
      '/onboarding/me',
      data: data.toJson(),
    );
    return OnboardingData.fromJson(response.data!);
  }

  Future<PaginatedResponse<Event>> fetchEvents({
    String filter = 'nearby',
    String? q,
    String? lifestyle,
    String? price,
    String? gender,
    String? access,
    String? cursor,
    int limit = 20,
    double? latitude,
    double? longitude,
    double? radiusKm,
    double? southWestLatitude,
    double? southWestLongitude,
    double? northEastLatitude,
    double? northEastLongitude,
  }) async {
    final response = await dio.get<Map<String, dynamic>>(
      '/events',
      queryParameters: {
        'filter': filter,
        if (q != null && q.isNotEmpty) 'q': q,
        if (lifestyle != null && lifestyle.isNotEmpty) 'lifestyle': lifestyle,
        if (price != null && price.isNotEmpty) 'price': price,
        if (gender != null && gender.isNotEmpty) 'gender': gender,
        if (access != null && access.isNotEmpty) 'access': access,
        'limit': limit,
        if (latitude != null) 'latitude': latitude,
        if (longitude != null) 'longitude': longitude,
        if (radiusKm != null) 'radiusKm': radiusKm,
        if (southWestLatitude != null) 'southWestLatitude': southWestLatitude,
        if (southWestLongitude != null)
          'southWestLongitude': southWestLongitude,
        if (northEastLatitude != null) 'northEastLatitude': northEastLatitude,
        if (northEastLongitude != null)
          'northEastLongitude': northEastLongitude,
        if (cursor != null) 'cursor': cursor,
      },
    );
    return PaginatedResponse.fromJson(
      response.data!,
      Event.fromJson,
    );
  }

  Future<EventDetail> fetchEventDetail(String eventId) async {
    final response = await dio.get<Map<String, dynamic>>('/events/$eventId');
    return EventDetail.fromJson(response.data!);
  }

  Future<PaginatedResponse<Poster>> fetchPosters({
    String? q,
    String? category,
    bool? featured,
    String? cursor,
    int limit = 24,
  }) async {
    final response = await dio.get<Map<String, dynamic>>(
      '/posters',
      queryParameters: {
        if (q != null && q.isNotEmpty) 'q': q,
        if (category != null && category.isNotEmpty) 'category': category,
        if (featured != null) 'featured': featured.toString(),
        if (cursor != null) 'cursor': cursor,
        'limit': limit,
      },
    );
    return PaginatedResponse.fromJson(
      response.data!,
      Poster.fromJson,
    );
  }

  Future<Poster> fetchPosterDetail(String posterId) async {
    final response = await dio.get<Map<String, dynamic>>('/posters/$posterId');
    return Poster.fromJson(response.data!);
  }

  Future<EventDetail> joinEvent(String eventId) async {
    final response =
        await dio.post<Map<String, dynamic>>('/events/$eventId/join');
    return EventDetail.fromJson(response.data!);
  }

  Future<EventDetail> leaveEvent(String eventId) async {
    final response =
        await dio.delete<Map<String, dynamic>>('/events/$eventId/join');
    return EventDetail.fromJson(response.data!);
  }

  Future<PaginatedResponse<PersonSummary>> fetchPeople({
    String? q,
    String? cursor,
    int limit = 20,
  }) async {
    final response = await dio.get<Map<String, dynamic>>(
      '/people',
      queryParameters: {
        'limit': limit,
        if (q != null && q.isNotEmpty) 'q': q,
        if (cursor != null) 'cursor': cursor,
      },
    );
    return PaginatedResponse.fromJson(
      response.data!,
      PersonSummary.fromJson,
    );
  }

  Future<PaginatedResponse<DatingProfileData>> fetchDatingDiscover({
    String? cursor,
    int limit = 20,
  }) async {
    final response = await dio.get<Map<String, dynamic>>(
      '/dating/discover',
      queryParameters: {
        'limit': limit,
        if (cursor != null) 'cursor': cursor,
      },
    );
    return PaginatedResponse.fromJson(
      response.data!,
      DatingProfileData.fromJson,
    );
  }

  Future<PaginatedResponse<DatingProfileData>> fetchDatingLikes({
    String? cursor,
    int limit = 20,
  }) async {
    final response = await dio.get<Map<String, dynamic>>(
      '/dating/likes',
      queryParameters: {
        'limit': limit,
        if (cursor != null) 'cursor': cursor,
      },
    );
    return PaginatedResponse.fromJson(
      response.data!,
      DatingProfileData.fromJson,
    );
  }

  Future<DatingActionResult> sendDatingAction({
    required String targetUserId,
    required String action,
  }) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/dating/actions',
      data: {
        'targetUserId': targetUserId,
        'action': action,
      },
    );
    return DatingActionResult.fromJson(response.data!);
  }

  Future<ProfileData> fetchPersonProfile(String userId) async {
    final response = await dio.get<Map<String, dynamic>>('/people/$userId');
    return ProfileData.fromPersonJson(response.data!);
  }

  Future<String> createOrGetDirectChat(String userId) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/people/$userId/direct-chat',
    );
    return response.data!['id'] as String;
  }

  Future<PaginatedResponse<MeetupChat>> fetchMeetupChats({
    String? cursor,
    int limit = 20,
  }) async {
    final response = await dio.get<Map<String, dynamic>>(
      '/chats/meetups',
      queryParameters: {
        'limit': limit,
        if (cursor != null) 'cursor': cursor,
      },
    );
    return PaginatedResponse.fromJson(
      response.data!,
      MeetupChat.fromJson,
    );
  }

  Future<PaginatedResponse<PersonalChat>> fetchPersonalChats({
    String? cursor,
    int limit = 20,
  }) async {
    final response = await dio.get<Map<String, dynamic>>(
      '/chats/personal',
      queryParameters: {
        'limit': limit,
        if (cursor != null) 'cursor': cursor,
      },
    );
    return PaginatedResponse.fromJson(
      response.data!,
      PersonalChat.fromJson,
    );
  }

  Future<PaginatedResponse<Community>> fetchCommunities({
    String? cursor,
    int limit = 20,
  }) async {
    final response = await dio.get<Map<String, dynamic>>(
      '/communities',
      queryParameters: {
        'limit': limit,
        if (cursor != null) 'cursor': cursor,
      },
    );
    return PaginatedResponse.fromJson(
      response.data!,
      Community.fromJson,
    );
  }

  Future<Community> fetchCommunity(String communityId) async {
    final response =
        await dio.get<Map<String, dynamic>>('/communities/$communityId');
    return Community.fromJson(response.data!);
  }

  Future<PaginatedResponse<CommunityMediaItem>> fetchCommunityMedia(
    String communityId, {
    String? cursor,
    int limit = 30,
  }) async {
    final response = await dio.get<Map<String, dynamic>>(
      '/communities/$communityId/media',
      queryParameters: {
        'limit': limit,
        if (cursor != null) 'cursor': cursor,
      },
    );
    return PaginatedResponse.fromJson(
      response.data!,
      CommunityMediaItem.fromJson,
    );
  }

  Future<Community> createCommunity({
    required String name,
    required String avatar,
    required String description,
    required CommunityPrivacy privacy,
    required String purpose,
    required List<CommunitySocialLink> socialLinks,
    String? idempotencyKey,
  }) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/communities',
      data: {
        'name': name,
        'avatar': avatar,
        'description': description,
        'privacy': privacy == CommunityPrivacy.private ? 'private' : 'public',
        'purpose': purpose,
        'tags': [purpose],
        'socialLinks': socialLinks
            .map((link) => {
                  'label': link.label,
                  'handle': link.handle,
                })
            .toList(growable: false),
      },
      options: idempotencyKey == null
          ? null
          : Options(
              headers: {
                'idempotency-key': idempotencyKey,
              },
            ),
    );
    return Community.fromJson(response.data!);
  }

  Future<Community> createCommunityNews({
    required String communityId,
    required String title,
    required String body,
    required String category,
    required String audience,
    required bool pin,
    required bool push,
  }) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/communities/$communityId/news',
      data: {
        'title': title,
        'body': body,
        'category': category,
        'audience': audience,
        'pin': pin,
        'push': push,
      },
    );
    return Community.fromJson(response.data!);
  }

  Future<PaginatedResponse<Message>> fetchMessages(
    String chatId, {
    String? cursor,
    int limit = 100,
  }) async {
    final response = await dio.get<Map<String, dynamic>>(
      '/chats/$chatId/messages',
      queryParameters: {
        'limit': limit,
        if (cursor != null) 'cursor': cursor,
      },
      options: Options(
        connectTimeout: const Duration(seconds: 4),
        receiveTimeout: const Duration(seconds: 6),
      ),
    );
    final currentUserId = ref.read(currentUserIdProvider) ?? 'user-me';
    return PaginatedResponse.fromJson(
      response.data!,
      (json) => Message.fromJson(json, currentUserId: currentUserId),
    );
  }

  Future<void> markChatRead(String chatId, String messageId) async {
    await dio.post<Map<String, dynamic>>(
      '/chats/$chatId/read',
      data: {'messageId': messageId},
    );
  }

  Future<PaginatedResponse<NotificationItem>> fetchNotifications({
    String? cursor,
    int limit = 20,
  }) async {
    final response = await dio.get<Map<String, dynamic>>(
      '/notifications',
      queryParameters: {
        'limit': limit,
        if (cursor != null) 'cursor': cursor,
      },
    );
    return PaginatedResponse.fromJson(
      response.data!,
      NotificationItem.fromJson,
    );
  }

  Future<int> fetchUnreadNotificationCount() async {
    final response =
        await dio.get<Map<String, dynamic>>('/notifications/unread-count');
    return (response.data!['unreadCount'] as num?)?.toInt() ?? 0;
  }

  Future<void> markNotificationRead(String notificationId) async {
    await dio.post<Map<String, dynamic>>('/notifications/$notificationId/read');
  }

  Future<void> markAllNotificationsRead() async {
    await dio.post<Map<String, dynamic>>('/notifications/read-all');
  }

  Future<EventDetail> createEvent({
    required String title,
    required String description,
    required String emoji,
    required String vibe,
    required String place,
    required DateTime startsAt,
    required int capacity,
    String mode = 'default',
    String lifestyle = 'neutral',
    String priceMode = 'free',
    int? priceAmountFrom,
    int? priceAmountTo,
    String accessMode = 'open',
    String genderMode = 'all',
    String visibilityMode = 'public',
    EventJoinMode joinMode = EventJoinMode.open,
    String? inviteeUserId,
    String? posterId,
    String? communityId,
    String? afterDarkCategory,
    String? afterDarkGlow,
    String? dressCode,
    String? ageRange,
    String? ratioLabel,
    double? distanceKm,
    double? latitude,
    double? longitude,
    bool consentRequired = false,
    List<String>? rules,
    String? idempotencyKey,
  }) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/events',
      options: idempotencyKey == null
          ? null
          : Options(headers: {'idempotency-key': idempotencyKey}),
      data: {
        'mode': mode,
        'title': title,
        'description': description,
        'emoji': emoji,
        'vibe': vibe,
        'place': place,
        'startsAt': startsAt.toUtc().toIso8601String(),
        'capacity': capacity,
        'distanceKm': distanceKm ?? 1.0,
        if (latitude != null) 'latitude': latitude,
        if (longitude != null) 'longitude': longitude,
        'joinMode': joinMode == EventJoinMode.request ? 'request' : 'open',
        'lifestyle': lifestyle,
        'priceMode': priceMode,
        if (priceAmountFrom != null) 'priceAmountFrom': priceAmountFrom,
        if (priceAmountTo != null) 'priceAmountTo': priceAmountTo,
        'accessMode': accessMode,
        'genderMode': genderMode,
        'visibilityMode': visibilityMode,
        if (inviteeUserId != null) 'inviteeUserId': inviteeUserId,
        if (posterId != null) 'posterId': posterId,
        if (communityId != null) 'communityId': communityId,
        if (afterDarkCategory != null) 'afterDarkCategory': afterDarkCategory,
        if (afterDarkGlow != null) 'afterDarkGlow': afterDarkGlow,
        if (dressCode != null) 'dressCode': dressCode,
        if (ageRange != null) 'ageRange': ageRange,
        if (ratioLabel != null) 'ratioLabel': ratioLabel,
        if (consentRequired) 'consentRequired': true,
        if (rules != null) 'rules': rules,
      },
    );
    return EventDetail.fromJson(response.data!);
  }

  Future<void> createJoinRequest(String eventId, {required String note}) async {
    await dio.post<Map<String, dynamic>>(
      '/events/$eventId/join-request',
      data: {'note': note},
    );
  }

  Future<void> cancelJoinRequest(String eventId) async {
    await dio.delete<Map<String, dynamic>>('/events/$eventId/join-request');
  }

  Future<EventCheckInData> fetchCheckIn(String eventId) async {
    final response =
        await dio.get<Map<String, dynamic>>('/events/$eventId/check-in');
    return EventCheckInData.fromJson(response.data!);
  }

  Future<void> confirmCheckIn(String eventId, {String? code}) async {
    await dio.post<Map<String, dynamic>>(
      '/events/$eventId/check-in/confirm',
      data: {
        if (code != null) 'code': code,
      },
    );
  }

  Future<LiveMeetupData> fetchLiveMeetup(String eventId) async {
    final response =
        await dio.get<Map<String, dynamic>>('/events/$eventId/live');
    return LiveMeetupData.fromJson(response.data!);
  }

  Future<AfterPartyData> fetchAfterParty(String eventId) async {
    final response =
        await dio.get<Map<String, dynamic>>('/events/$eventId/after-party');
    return AfterPartyData.fromJson(response.data!);
  }

  Future<void> saveAfterParty(
    String eventId, {
    required String vibe,
    required int hostRating,
    required List<String> favoriteUserIds,
    String? note,
  }) async {
    await dio.post<Map<String, dynamic>>(
      '/events/$eventId/feedback',
      data: {
        'vibe': vibe,
        'hostRating': hostRating,
        'favoriteUserIds': favoriteUserIds,
        'note': note,
      },
    );
  }

  Future<HostDashboardData> fetchHostDashboard() async {
    final response = await dio.get<Map<String, dynamic>>('/host/dashboard');
    return HostDashboardData.fromJson(response.data!);
  }

  Future<HostEventData> fetchHostEvent(String eventId) async {
    final response =
        await dio.get<Map<String, dynamic>>('/host/events/$eventId');
    return HostEventData.fromJson(response.data!);
  }

  Future<void> approveJoinRequest(String requestId) async {
    await dio.post<Map<String, dynamic>>('/host/requests/$requestId/approve');
  }

  Future<void> rejectJoinRequest(String requestId) async {
    await dio.post<Map<String, dynamic>>('/host/requests/$requestId/reject');
  }

  Future<void> acceptInvite(String eventId, String requestId) async {
    await dio.post<Map<String, dynamic>>(
      '/events/$eventId/invites/$requestId/accept',
    );
  }

  Future<void> declineInvite(String eventId, String requestId) async {
    await dio.post<Map<String, dynamic>>(
      '/events/$eventId/invites/$requestId/decline',
    );
  }

  Future<void> manualCheckIn(String eventId, {required String userId}) async {
    await dio.post<Map<String, dynamic>>(
      '/host/events/$eventId/check-in',
      data: {'userId': userId},
    );
  }

  Future<void> startLiveMeetup(String eventId) async {
    await dio.post<Map<String, dynamic>>('/host/events/$eventId/live/start');
  }

  Future<void> finishLiveMeetup(String eventId) async {
    await dio.post<Map<String, dynamic>>('/host/events/$eventId/live/finish');
  }

  Future<EveningPublishResult> publishEveningRoute(
    String routeId, {
    required EveningPrivacy privacy,
  }) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/evening/routes/$routeId/launch',
      data: {
        'privacy': eveningPrivacyToJson(privacy),
      },
    );
    return EveningPublishResult.fromJson(response.data!);
  }

  Future<Map<String, dynamic>> fetchEveningOptions() async {
    final response = await dio.get<Map<String, dynamic>>(
      '/evening/options',
      options: Options(
        connectTimeout: const Duration(seconds: 4),
        receiveTimeout: const Duration(seconds: 6),
      ),
    );
    return response.data!;
  }

  Future<Map<String, dynamic>> resolveEveningRoute({
    String? goal,
    String? mood,
    String? budget,
    String? format,
    String? area,
  }) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/evening/routes/resolve',
      data: {
        if (goal != null && goal.isNotEmpty) 'goal': goal,
        if (mood != null && mood.isNotEmpty) 'mood': mood,
        if (budget != null && budget.isNotEmpty) 'budget': budget,
        if (format != null && format.isNotEmpty) 'format': format,
        if (area != null && area.isNotEmpty) 'area': area,
      },
      options: Options(
        connectTimeout: const Duration(seconds: 4),
        receiveTimeout: const Duration(seconds: 6),
      ),
    );
    return response.data!;
  }

  Future<Map<String, dynamic>> fetchEveningRoute(String routeId) async {
    final response = await dio.get<Map<String, dynamic>>(
      '/evening/routes/$routeId',
      options: Options(
        connectTimeout: const Duration(seconds: 4),
        receiveTimeout: const Duration(seconds: 6),
      ),
    );
    return response.data!;
  }

  Future<void> launchEveningRoute(
    String routeId, {
    required EveningLaunchMode mode,
    required int startDelayMin,
  }) async {
    await dio.post<Map<String, dynamic>>(
      '/evening/routes/$routeId/launch',
      data: {
        'mode': eveningLaunchModeToJson(mode),
        'startDelayMin': startDelayMin,
      },
    );
  }

  Future<void> finishEveningRoute(String routeId) async {
    await dio.post<Map<String, dynamic>>('/evening/routes/$routeId/finish');
  }

  Future<PaginatedResponse<EveningSessionSummary>> fetchEveningSessions({
    int limit = 20,
  }) async {
    final response = await dio.get<Map<String, dynamic>>(
      '/evening/sessions',
      queryParameters: {
        'limit': limit,
      },
    );
    return PaginatedResponse.fromJson(
      response.data!,
      EveningSessionSummary.fromJson,
    );
  }

  Future<EveningSessionDetail> fetchEveningSession(String sessionId) async {
    final response =
        await dio.get<Map<String, dynamic>>('/evening/sessions/$sessionId');
    return EveningSessionDetail.fromJson(response.data!);
  }

  Future<PaginatedResponse<EveningRouteTemplateSummary>>
      fetchEveningRouteTemplates({
    String city = 'Москва',
    int limit = 20,
  }) async {
    final response = await dio.get<Map<String, dynamic>>(
      '/evening/route-templates',
      queryParameters: {
        'city': city,
        'limit': limit,
      },
    );
    return PaginatedResponse.fromJson(
      response.data!,
      EveningRouteTemplateSummary.fromJson,
    );
  }

  Future<EveningRouteTemplateDetail> fetchEveningRouteTemplate(
    String templateId,
  ) async {
    final response = await dio.get<Map<String, dynamic>>(
      '/evening/route-templates/$templateId',
    );
    return EveningRouteTemplateDetail.fromJson(response.data!);
  }

  Future<PaginatedResponse<EveningRouteTemplateSession>>
      fetchEveningRouteTemplateSessions(
    String templateId, {
    int limit = 10,
  }) async {
    final response = await dio.get<Map<String, dynamic>>(
      '/evening/route-templates/$templateId/sessions',
      queryParameters: {
        'limit': limit,
      },
    );
    return PaginatedResponse.fromJson(
      response.data!,
      EveningRouteTemplateSession.fromJson,
    );
  }

  Future<CreateEveningRouteTemplateSessionResult>
      createEveningSessionFromTemplate(
    String templateId, {
    required DateTime startsAt,
    required EveningPrivacy privacy,
    required int capacity,
    String? hostNote,
  }) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/evening/route-templates/$templateId/sessions',
      data: {
        'startsAt': startsAt.toUtc().toIso8601String(),
        'privacy': eveningPrivacyToJson(privacy),
        'capacity': capacity,
        if (hostNote != null && hostNote.trim().isNotEmpty)
          'hostNote': hostNote.trim(),
      },
    );
    return CreateEveningRouteTemplateSessionResult.fromJson(response.data!);
  }

  Future<EveningJoinResult> joinEveningSession(
    String sessionId, {
    String? inviteToken,
  }) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/evening/sessions/$sessionId/join',
      data: {
        if (inviteToken != null) 'inviteToken': inviteToken,
      },
    );
    return EveningJoinResult.fromJson(response.data!);
  }

  Future<EveningJoinResult> requestEveningSession(
    String sessionId, {
    String? note,
  }) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/evening/sessions/$sessionId/join-request',
      data: {
        if (note != null && note.isNotEmpty) 'note': note,
      },
    );
    return EveningJoinResult.fromJson(response.data!);
  }

  Future<void> startEveningSession(String sessionId) async {
    await dio.post<Map<String, dynamic>>('/evening/sessions/$sessionId/start');
  }

  Future<void> finishEveningSession(String sessionId) async {
    await dio.post<Map<String, dynamic>>('/evening/sessions/$sessionId/finish');
  }

  Future<void> approveEveningJoinRequest(
    String sessionId,
    String requestId,
  ) async {
    await dio.post<Map<String, dynamic>>(
      '/evening/sessions/$sessionId/join-requests/$requestId/approve',
    );
  }

  Future<void> rejectEveningJoinRequest(
    String sessionId,
    String requestId,
  ) async {
    await dio.post<Map<String, dynamic>>(
      '/evening/sessions/$sessionId/join-requests/$requestId/reject',
    );
  }

  Future<void> checkInEveningStep(String sessionId, String stepId) async {
    await dio.post<Map<String, dynamic>>(
      '/evening/sessions/$sessionId/steps/$stepId/check-in',
    );
  }

  Future<PartnerOfferCode> issuePartnerOfferCode({
    required String sessionId,
    required String stepId,
    required String offerId,
  }) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/evening/sessions/$sessionId/steps/$stepId/offers/$offerId/code',
    );
    return PartnerOfferCode.fromJson(response.data!);
  }

  Future<PartnerOfferCode> fetchPartnerOfferCode(String codeId) async {
    final response = await dio.get<Map<String, dynamic>>(
      '/evening/offer-codes/$codeId',
    );
    return PartnerOfferCode.fromJson(response.data!);
  }

  Future<void> advanceEveningStep(String sessionId, String stepId) async {
    await dio.post<Map<String, dynamic>>(
      '/evening/sessions/$sessionId/steps/$stepId/advance',
    );
  }

  Future<void> skipEveningStep(String sessionId, String stepId) async {
    await dio.post<Map<String, dynamic>>(
      '/evening/sessions/$sessionId/steps/$stepId/skip',
    );
  }

  Future<Map<String, dynamic>> fetchEveningAfterParty(String sessionId) async {
    final response = await dio.get<Map<String, dynamic>>(
      '/evening/sessions/$sessionId/after-party',
    );
    return response.data!;
  }

  Future<Map<String, dynamic>> saveEveningAfterPartyFeedback(
    String sessionId, {
    required int rating,
    String? reaction,
    String? comment,
  }) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/evening/sessions/$sessionId/after-party/feedback',
      data: {
        'rating': rating,
        if (reaction != null && reaction.isNotEmpty) 'reaction': reaction,
        if (comment != null && comment.isNotEmpty) 'comment': comment,
      },
    );
    return response.data!;
  }

  Future<Map<String, dynamic>> addEveningAfterPartyPhoto(
    String sessionId, {
    required String assetId,
  }) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/evening/sessions/$sessionId/after-party/photos',
      data: {'assetId': assetId},
    );
    return response.data!;
  }

  Future<void> uploadAvatarFile(PlatformFile file) async {
    await uploadProfilePhotoFile(file);
  }

  Future<ProfileData> deleteProfilePhoto(String photoId) async {
    final response = await dio.delete<Map<String, dynamic>>(
      '/profile/me/photos/$photoId',
    );
    return ProfileData.fromProfileJson(response.data!);
  }

  Future<ProfileData> makePrimaryProfilePhoto(String photoId) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/profile/me/photos/$photoId/primary',
    );
    return ProfileData.fromProfileJson(response.data!);
  }

  Future<ProfileData> reorderProfilePhotos(List<String> photoIds) async {
    final response = await dio.patch<Map<String, dynamic>>(
      '/profile/me/photos/order',
      data: {'photoIds': photoIds},
    );
    return ProfileData.fromProfileJson(response.data!);
  }

  Future<UserSettingsData> fetchSettings() async {
    final response = await dio.get<Map<String, dynamic>>('/settings/me');
    return UserSettingsData.fromJson(response.data!);
  }

  Future<UserSettingsData> updateSettings(UserSettingsData settings) async {
    final response = await dio.put<Map<String, dynamic>>(
      '/settings/me',
      data: settings.toJson(),
    );
    return UserSettingsData.fromJson(response.data!);
  }

  Future<Map<String, dynamic>> updateTestingAccess({
    required bool frendlyPlusEnabled,
    required bool afterDarkEnabled,
  }) async {
    final response = await dio.put<Map<String, dynamic>>(
      '/settings/me/testing-access',
      data: {
        'frendlyPlusEnabled': frendlyPlusEnabled,
        'afterDarkEnabled': afterDarkEnabled,
      },
    );
    return response.data!;
  }

  Future<VerificationStateData> fetchVerification() async {
    final response = await dio.get<Map<String, dynamic>>('/verification/me');
    return VerificationStateData.fromJson(response.data!);
  }

  Future<VerificationStateData> submitVerificationStep(String step) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/verification/submit',
      data: {'step': step},
    );
    return VerificationStateData.fromJson(response.data!);
  }

  Future<SafetyHubData> fetchSafetyHub() async {
    final response = await dio.get<Map<String, dynamic>>('/safety/me');
    return SafetyHubData.fromJson(response.data!);
  }

  Future<void> updateSafety({
    required bool autoSharePlans,
    required bool hideExactLocation,
  }) async {
    await dio.put<Map<String, dynamic>>(
      '/safety/me',
      data: {
        'autoSharePlans': autoSharePlans,
        'hideExactLocation': hideExactLocation,
      },
    );
  }

  Future<List<TrustedContactData>> fetchTrustedContacts() async {
    final response = await dio.get<List<dynamic>>('/safety/trusted-contacts');
    return (response.data ?? const [])
        .whereType<Map>()
        .map((item) =>
            TrustedContactData.fromJson(Map<String, dynamic>.from(item)))
        .toList(growable: false);
  }

  Future<void> createTrustedContact({
    required String name,
    required String channel,
    required String value,
    required String mode,
  }) async {
    await dio.post<Map<String, dynamic>>(
      '/safety/trusted-contacts',
      data: {
        'name': name,
        'channel': channel,
        'value': value,
        if (channel == 'phone') 'phoneNumber': value,
        'mode': mode,
      },
    );
  }

  Future<void> deleteTrustedContact(String contactId) async {
    await dio.delete<Map<String, dynamic>>(
      '/safety/trusted-contacts/$contactId',
    );
  }

  Future<List<UserReportData>> fetchReports() async {
    final response = await dio.get<List<dynamic>>('/reports/me');
    return (response.data ?? const [])
        .whereType<Map>()
        .map((item) => UserReportData.fromJson(Map<String, dynamic>.from(item)))
        .toList(growable: false);
  }

  Future<void> createReport({
    required String targetUserId,
    required String reason,
    String? details,
    required bool blockRequested,
  }) async {
    await dio.post<Map<String, dynamic>>(
      '/reports',
      data: {
        'targetUserId': targetUserId,
        'reason': reason,
        'details': details,
        'blockRequested': blockRequested,
      },
    );
  }

  Future<List<BlockedUserData>> fetchBlocks() async {
    final response = await dio.get<List<dynamic>>('/blocks');
    return (response.data ?? const [])
        .whereType<Map>()
        .map(
            (item) => BlockedUserData.fromJson(Map<String, dynamic>.from(item)))
        .toList(growable: false);
  }

  Future<void> createBlock({
    required String targetUserId,
  }) async {
    await dio.post<Map<String, dynamic>>(
      '/blocks',
      data: {
        'targetUserId': targetUserId,
      },
    );
  }

  Future<SafetySosData> createSos({String? eventId}) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/safety/sos',
      data: {
        if (eventId != null) 'eventId': eventId,
      },
    );
    return SafetySosData.fromJson(response.data!);
  }

  Future<List<StoryData>> fetchStories(String eventId) async {
    final response =
        await dio.get<Map<String, dynamic>>('/events/$eventId/stories');
    return ((response.data?['items'] as List?) ?? const [])
        .whereType<Map>()
        .map((item) => StoryData.fromJson(Map<String, dynamic>.from(item)))
        .toList(growable: false);
  }

  Future<void> createStory(
    String eventId, {
    required String caption,
    required String emoji,
  }) async {
    await dio.post<Map<String, dynamic>>(
      '/events/$eventId/stories',
      data: {
        'caption': caption,
        'emoji': emoji,
      },
    );
  }

  Future<List<MatchData>> fetchMatches() async {
    final response = await dio.get<Map<String, dynamic>>('/matches');
    return ((response.data?['items'] as List?) ?? const [])
        .whereType<Map>()
        .map((item) => MatchData.fromJson(Map<String, dynamic>.from(item)))
        .toList(growable: false);
  }

  Future<List<SubscriptionPlanData>> fetchSubscriptionPlans() async {
    final response = await dio.get<Map<String, dynamic>>('/subscription/plans');
    return ((response.data?['plans'] as List?) ?? const [])
        .whereType<Map>()
        .map((item) =>
            SubscriptionPlanData.fromJson(Map<String, dynamic>.from(item)))
        .toList(growable: false);
  }

  Future<SubscriptionStateData> fetchSubscriptionState() async {
    final response = await dio.get<Map<String, dynamic>>('/subscription/me');
    return SubscriptionStateData.fromJson(response.data!);
  }

  Future<SubscriptionStateData> subscribe(String plan) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/subscription/subscribe',
      data: {'plan': plan},
    );
    return SubscriptionStateData.fromJson(response.data!);
  }

  Future<Map<String, dynamic>> restoreSubscription() async {
    final response =
        await dio.post<Map<String, dynamic>>('/subscription/restore');
    return response.data!;
  }

  Future<AfterDarkAccessData> fetchAfterDarkAccess() async {
    final response = await dio.get<Map<String, dynamic>>('/after-dark/access');
    return AfterDarkAccessData.fromJson(response.data!);
  }

  Future<AfterDarkAccessData> unlockAfterDark({
    required String plan,
    required bool ageConfirmed,
    required bool codeAccepted,
  }) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/after-dark/unlock',
      data: {
        'plan': plan,
        'ageConfirmed': ageConfirmed,
        'codeAccepted': codeAccepted,
      },
    );
    return AfterDarkAccessData.fromJson(response.data!);
  }

  Future<PaginatedResponse<AfterDarkEvent>> fetchAfterDarkEvents({
    String? cursor,
    int limit = 20,
  }) async {
    final response = await dio.get<Map<String, dynamic>>(
      '/after-dark/events',
      queryParameters: {
        'limit': limit,
        if (cursor != null) 'cursor': cursor,
      },
    );
    return PaginatedResponse.fromJson(
      response.data!,
      (item) => AfterDarkEvent.fromJson(item),
    );
  }

  Future<AfterDarkEventDetail> fetchAfterDarkEventDetail(String eventId) async {
    final response =
        await dio.get<Map<String, dynamic>>('/after-dark/events/$eventId');
    return AfterDarkEventDetail.fromJson(response.data!);
  }

  Future<Map<String, dynamic>> joinAfterDarkEvent(
    String eventId, {
    required bool acceptedRules,
    String? note,
  }) async {
    final response = await dio.post<Map<String, dynamic>>(
      '/after-dark/events/$eventId/join',
      data: {
        'acceptedRules': acceptedRules,
        if (note != null && note.isNotEmpty) 'note': note,
      },
    );
    return response.data!;
  }

  Future<void> registerPushToken({
    required String token,
    required String provider,
    required String deviceId,
    required String platform,
  }) async {
    await dio.post<Map<String, dynamic>>(
      '/push-tokens',
      data: {
        'token': token,
        'provider': provider,
        'deviceId': deviceId,
        'platform': platform,
      },
    );
  }

  Future<void> deletePushTokenByDeviceId(String deviceId) async {
    await dio.delete<Map<String, dynamic>>(
      '/push-tokens/device/$deviceId',
    );
  }

  Future<String> uploadChatAttachment(
    PlatformFile file, {
    required String chatId,
  }) async {
    final mimeType = _resolveMimeType(file.name);
    final uploadUrlResponse = await dio.post<Map<String, dynamic>>(
      '/uploads/chat-attachment/upload-url',
      data: {
        'chatId': chatId,
        'kind': 'chat_attachment',
        'fileName': file.name,
        'contentType': mimeType,
      },
    );
    final uploadData = uploadUrlResponse.data!;
    final uploadUrl = uploadData['uploadUrl'] as String;
    final objectKey = uploadData['objectKey'] as String;
    final uploadHeaders = Map<String, dynamic>.from(
      (uploadData['headers'] as Map?) ?? const {},
    );
    final byteSize = await _putPresignedUpload(
      file,
      uploadUrl: uploadUrl,
      uploadHeaders: uploadHeaders,
    );
    final completeResponse = await dio.post<Map<String, dynamic>>(
      '/uploads/chat-attachment/complete',
      data: {
        'chatId': chatId,
        'kind': 'chat_attachment',
        'objectKey': objectKey,
        'mimeType': mimeType,
        'byteSize': byteSize,
        'fileName': file.name,
      },
    );

    return completeResponse.data!['assetId'] as String;
  }

  Future<String> uploadChatVoice(
    PlatformFile file, {
    required String chatId,
    required int durationMs,
    required List<double> waveform,
  }) async {
    final stopwatch = Stopwatch()..start();
    final mimeType = _resolveMimeType(file.name);
    final uploadUrlResponse = await dio.post<Map<String, dynamic>>(
      '/uploads/chat-attachment/upload-url',
      data: {
        'chatId': chatId,
        'kind': 'chat_voice',
        'fileName': file.name,
        'contentType': mimeType,
        'durationMs': durationMs,
        'waveform': waveform,
      },
    );
    final uploadData = uploadUrlResponse.data!;
    final uploadUrl = uploadData['uploadUrl'] as String;
    final objectKey = uploadData['objectKey'] as String;
    final uploadHeaders = Map<String, dynamic>.from(
      (uploadData['headers'] as Map?) ?? const {},
    );
    final bytes = await _readFileBytes(file);

    await _createUploadDio().put<void>(
      uploadUrl,
      data: bytes,
      options: Options(
        headers: {
          ...uploadHeaders,
          Headers.contentLengthHeader: bytes.length,
        },
      ),
    );

    final completeResponse = await dio.post<Map<String, dynamic>>(
      '/uploads/chat-attachment/complete',
      data: {
        'chatId': chatId,
        'kind': 'chat_voice',
        'objectKey': objectKey,
        'mimeType': mimeType,
        'byteSize': bytes.length,
        'fileName': file.name,
        'durationMs': durationMs,
        'waveform': waveform,
      },
    );

    emitVoiceMetric(
      'voice_upload_ms',
      stopwatch,
      reporter: _voiceMetricReporter,
    );

    return completeResponse.data!['assetId'] as String;
  }

  static Dio _defaultUploadDio() {
    return Dio(
      BaseOptions(
        connectTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 20),
      ),
    );
  }

  Future<int> _putPresignedUpload(
    PlatformFile file, {
    required String uploadUrl,
    required Map<String, dynamic> uploadHeaders,
  }) async {
    final path = file.path;
    if (path != null && path.isNotEmpty) {
      final byteSize = file.size;
      await _createUploadDio().put<void>(
        uploadUrl,
        data: File(path).openRead(),
        options: Options(
          headers: {
            ...uploadHeaders,
            Headers.contentLengthHeader: byteSize,
          },
        ),
      );
      return byteSize;
    }

    final bytes = await _readFileBytes(file);
    await _createUploadDio().put<void>(
      uploadUrl,
      data: bytes,
      options: Options(
        headers: {
          ...uploadHeaders,
          Headers.contentLengthHeader: bytes.length,
        },
      ),
    );
    return bytes.length;
  }

  Future<MultipartFile> _profilePhotoMultipartFile(
    PlatformFile file,
    String mimeType,
  ) async {
    final contentType = DioMediaType.parse(mimeType);
    final path = file.path;
    if (path != null && path.isNotEmpty) {
      return MultipartFile.fromFile(
        path,
        filename: file.name,
        contentType: contentType,
      );
    }

    return MultipartFile.fromBytes(
      await _readFileBytes(file),
      filename: file.name,
      contentType: contentType,
    );
  }

  Future<Uint8List> _readFileBytes(PlatformFile file) async {
    final bytes = file.bytes;
    if (bytes != null) {
      return bytes;
    }
    final path = file.path;
    if (path == null) {
      throw StateError('File bytes are missing');
    }
    return File(path).readAsBytes();
  }

  String _resolveMimeType(String fileName) {
    final lower = fileName.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.m4a')) return 'audio/mp4';
    if (lower.endsWith('.aac')) return 'audio/aac';
    if (lower.endsWith('.mp3')) return 'audio/mpeg';
    if (lower.endsWith('.wav')) return 'audio/wav';
    if (lower.endsWith('.ogg')) return 'audio/ogg';
    if (lower.endsWith('.webm')) return 'audio/webm';
    return 'application/octet-stream';
  }
}

import 'dart:io';

import 'package:dio/dio.dart';
import 'package:mobile2/shared/models/backend_models.dart';

class BackendRepository {
  BackendRepository(this._dio);

  final Dio _dio;

  Future<BackendUser> fetchMe({CancelToken? cancelToken}) async {
    final json = await _getMap('/me', cancelToken: cancelToken);
    return BackendUser.fromJson(json);
  }

  Future<BackendCardItem> fetchOwnProfile({CancelToken? cancelToken}) async {
    final json = await _getMap('/profile/me', cancelToken: cancelToken);
    return BackendCardItem.fromJson(json);
  }

  Future<BackendCardItem> updateOwnProfile({
    required Map<String, Object?> data,
    CancelToken? cancelToken,
  }) async {
    final json = await _patchMap(
      '/profile/me',
      data: data,
      cancelToken: cancelToken,
    );
    return BackendCardItem.fromJson(json);
  }

  Future<AuthTokens> refreshTokens(AuthTokens tokens) async {
    final json = await _postMap(
      '/auth/refresh',
      data: {'refreshToken': tokens.refreshToken},
      options: Options(extra: {
        'skipAuthHeader': true,
        'skipAuthRefresh': true,
        'skipRequestDeduplication': true,
      }),
    );
    return AuthTokens.fromJson(json);
  }

  Future<AuthSession> verifyPhone({
    required String challengeId,
    required String code,
    CancelToken? cancelToken,
  }) async {
    final json = await _postMap(
      '/auth/phone/verify',
      data: {'challengeId': challengeId, 'code': code},
      options:
          Options(extra: {'skipAuthHeader': true, 'skipAuthRefresh': true}),
      cancelToken: cancelToken,
    );
    return AuthSession.fromJson(json);
  }

  Future<AuthSession> loginWithTestPhoneShortcut(
    String phoneNumber, {
    CancelToken? cancelToken,
  }) async {
    final json = await _postMap(
      '/auth/phone/test-login',
      data: {'phoneNumber': phoneNumber},
      options:
          Options(extra: {'skipAuthHeader': true, 'skipAuthRefresh': true}),
      cancelToken: cancelToken,
    );
    return AuthSession.fromJson(json);
  }

  Future<PhoneAuthChallenge> requestPhoneCode(
    String phoneNumber, {
    CancelToken? cancelToken,
  }) async {
    final json = await _postMap(
      '/auth/phone/request',
      data: {'phoneNumber': phoneNumber},
      options:
          Options(extra: {'skipAuthHeader': true, 'skipAuthRefresh': true}),
      cancelToken: cancelToken,
    );
    return PhoneAuthChallenge.fromJson(json);
  }

  Future<TelegramAuthStart> startTelegramAuth({
    String? startToken,
    CancelToken? cancelToken,
  }) async {
    final json = await _postMap(
      '/auth/telegram/start',
      data: {'startToken': startToken},
      options:
          Options(extra: {'skipAuthHeader': true, 'skipAuthRefresh': true}),
      cancelToken: cancelToken,
    );
    return TelegramAuthStart.fromJson(json);
  }

  Future<AuthSession> verifyTelegramAuth({
    required String loginSessionId,
    required String code,
    CancelToken? cancelToken,
  }) async {
    final json = await _postMap(
      '/auth/telegram/verify',
      data: {'loginSessionId': loginSessionId, 'code': code},
      options:
          Options(extra: {'skipAuthHeader': true, 'skipAuthRefresh': true}),
      cancelToken: cancelToken,
    );
    return AuthSession.fromJson(json);
  }

  Future<OnboardingData> fetchOnboarding({CancelToken? cancelToken}) async {
    final json = await _getMap('/onboarding/me', cancelToken: cancelToken);
    return OnboardingData.fromJson(json);
  }

  Future<OnboardingData> saveOnboarding(
    OnboardingData data, {
    CancelToken? cancelToken,
  }) async {
    final json = await _putMap(
      '/onboarding/me',
      data: data.toJson(),
      cancelToken: cancelToken,
    );
    return OnboardingData.fromJson(json);
  }

  Future<Map<String, Object?>> checkOnboardingContact({
    String? email,
    String? phoneNumber,
    CancelToken? cancelToken,
  }) {
    return _postMap(
      '/onboarding/contact/check',
      data: {
        if (email != null && email.isNotEmpty) 'email': email,
        if (phoneNumber != null && phoneNumber.isNotEmpty)
          'phoneNumber': phoneNumber,
      },
      cancelToken: cancelToken,
    );
  }

  Future<AppSettingsData> fetchSettings({CancelToken? cancelToken}) async {
    final json = await _getMap('/settings/me', cancelToken: cancelToken);
    return AppSettingsData.fromJson(json);
  }

  Future<AppSettingsData> updateSettings(
    Map<String, Object?> data, {
    CancelToken? cancelToken,
  }) async {
    final json = await _putMap(
      '/settings/me',
      data: data,
      cancelToken: cancelToken,
    );
    return AppSettingsData.fromJson(json);
  }

  Future<SafetyData> fetchSafety({CancelToken? cancelToken}) async {
    final json = await _getMap('/safety/me', cancelToken: cancelToken);
    return SafetyData.fromJson(json);
  }

  Future<SafetyData> updateSafety(
    Map<String, Object?> data, {
    CancelToken? cancelToken,
  }) async {
    await _putMap(
      '/safety/me',
      data: data,
      cancelToken: cancelToken,
    );
    return fetchSafety(cancelToken: cancelToken);
  }

  Future<Map<String, Object?>> logout({CancelToken? cancelToken}) {
    return _postMap('/auth/logout', cancelToken: cancelToken);
  }

  Future<BackendPage<BackendCardItem>> fetchEvents({
    String? city,
    String? filter,
    String? query,
    String? lifestyle,
    String? price,
    String? gender,
    String? access,
    String? date,
    int limit = 20,
    String? cursor,
    CancelToken? cancelToken,
  }) {
    return _fetchCardPage(
      '/events',
      query: {
        'city': city,
        'filter': filter,
        'q': query,
        'lifestyle': lifestyle,
        'price': price,
        'gender': gender,
        'access': access,
        'date': date,
        'limit': limit,
        'cursor': cursor,
      },
      cancelToken: cancelToken,
    );
  }

  Future<BackendCardItem> fetchEventDetail(
    String eventId, {
    CancelToken? cancelToken,
  }) async {
    final json = await _getMap('/events/$eventId', cancelToken: cancelToken);
    return BackendCardItem.fromJson(json);
  }

  Future<BackendCardItem> createEvent({
    required Map<String, Object?> data,
    required String idempotencyKey,
    CancelToken? cancelToken,
  }) async {
    final json = await _postMap(
      '/events',
      data: data,
      options: Options(headers: {'idempotency-key': idempotencyKey}),
      cancelToken: cancelToken,
    );
    return BackendCardItem.fromJson(json);
  }

  Future<BackendCardItem> fetchHostedEvent(
    String eventId, {
    CancelToken? cancelToken,
  }) async {
    final json =
        await _getMap('/host/events/$eventId', cancelToken: cancelToken);
    return BackendCardItem.fromJson(json);
  }

  Future<BackendCardItem> updateHostedEvent(
    String eventId, {
    required Map<String, Object?> data,
    CancelToken? cancelToken,
  }) async {
    final json = await _patchMap(
      '/host/events/$eventId',
      data: data,
      cancelToken: cancelToken,
    );
    return BackendCardItem.fromJson(json);
  }

  Future<BackendCardItem> joinEvent(
    String eventId, {
    CancelToken? cancelToken,
  }) async {
    final json = await _postMap(
      '/events/$eventId/join',
      cancelToken: cancelToken,
    );
    return BackendCardItem.fromJson(json);
  }

  Future<BackendCardItem> leaveEvent(
    String eventId, {
    CancelToken? cancelToken,
  }) async {
    final json = await _deleteMap(
      '/events/$eventId/join',
      cancelToken: cancelToken,
    );
    return BackendCardItem.fromJson(json);
  }

  Future<BackendCardItem> createJoinRequest(
    String eventId, {
    String? note,
    CancelToken? cancelToken,
  }) async {
    final json = await _postMap(
      '/events/$eventId/join-request',
      data: {if (note != null && note.trim().isNotEmpty) 'note': note.trim()},
      cancelToken: cancelToken,
    );
    return BackendCardItem.fromJson(json);
  }

  Future<BackendCardItem> cancelJoinRequest(
    String eventId, {
    CancelToken? cancelToken,
  }) async {
    final json = await _deleteMap(
      '/events/$eventId/join-request',
      cancelToken: cancelToken,
    );
    return BackendCardItem.fromJson(json);
  }

  Future<BackendPage<BackendCardItem>> fetchFollowingPeople({
    required String eventId,
    String? q,
    String? cursor,
    int limit = 20,
    CancelToken? cancelToken,
  }) {
    return _fetchCardPage(
      '/people/following',
      query: {
        'eventId': eventId,
        'q': q,
        'cursor': cursor,
        'limit': limit,
      },
      cancelToken: cancelToken,
    );
  }

  Future<Map<String, Object?>> inviteUserToEvent(
    String eventId,
    String userId, {
    CancelToken? cancelToken,
  }) {
    return _postMap(
      '/events/$eventId/invites',
      data: {'userId': userId},
      cancelToken: cancelToken,
    );
  }

  Future<BackendCardItem> acceptEventInvite({
    required String eventId,
    required String requestId,
    CancelToken? cancelToken,
  }) async {
    final json = await _postMap(
      '/events/$eventId/invites/$requestId/accept',
      cancelToken: cancelToken,
    );
    return BackendCardItem.fromJson(json);
  }

  Future<Map<String, Object?>> declineEventInvite({
    required String eventId,
    required String requestId,
    CancelToken? cancelToken,
  }) {
    return _postMap(
      '/events/$eventId/invites/$requestId/decline',
      cancelToken: cancelToken,
    );
  }

  Future<BackendPage<BackendCardItem>> fetchAffiche({
    String? city,
    String? query,
    String? date,
    String? dateFrom,
    String? dateTo,
    String? priceMode,
    String? category,
    int limit = 20,
    String? cursor,
    CancelToken? cancelToken,
  }) {
    return _fetchCardPage(
      '/affiche/events',
      query: {
        'city': city,
        'q': query,
        'date': date,
        'dateFrom': dateFrom,
        'dateTo': dateTo,
        'priceMode': priceMode,
        'category': category,
        'limit': limit,
        'cursor': cursor,
      },
      cancelToken: cancelToken,
    );
  }

  Future<BackendCardItem> fetchAfficheDetail(
    String eventId, {
    CancelToken? cancelToken,
  }) async {
    final json = await _getMap(
      '/affiche/events/$eventId',
      cancelToken: cancelToken,
    );
    return BackendCardItem.fromJson(json);
  }

  Future<BackendPage<BackendCardItem>> fetchRoutes({
    String? city,
    String? query,
    int limit = 20,
    CancelToken? cancelToken,
  }) {
    return _fetchCardPage(
      '/evening/route-templates',
      query: {'city': city, 'q': query, 'limit': limit},
      cancelToken: cancelToken,
    );
  }

  Future<BackendCardItem> fetchRouteDetail(
    String routeId, {
    CancelToken? cancelToken,
  }) async {
    final json = await _getMap(
      '/evening/route-templates/$routeId',
      cancelToken: cancelToken,
    );
    return BackendCardItem.fromJson(json);
  }

  Future<BackendPage<BackendChatSummary>> fetchMeetupChats({
    CancelToken? cancelToken,
  }) async {
    final json = await _getMap(
      '/chats/meetups',
      query: const {'includeSocial': false},
      cancelToken: cancelToken,
    );
    return _chatPage(json);
  }

  Future<BackendPage<BackendChatSummary>> fetchPersonalChats({
    CancelToken? cancelToken,
  }) async {
    final json = await _getMap('/chats/personal', cancelToken: cancelToken);
    return _chatPage(json);
  }

  Future<BackendPage<BackendChatMessage>> fetchChatMessages(
    String chatId, {
    String? cursor,
    int limit = 20,
    CancelToken? cancelToken,
  }) async {
    final json = await _getMap(
      '/chats/$chatId/messages',
      query: {'cursor': cursor, 'limit': limit},
      cancelToken: cancelToken,
    );
    final currentUserId = _stringOrNull(json['currentUserId']);
    return BackendPage(
      items: _items(json).map((item) {
        final raw = {
          ...item,
          if (currentUserId != null) 'mine': item['senderId'] == currentUserId,
        };
        return BackendChatMessage.fromJson(chatId, raw);
      }).toList(growable: false),
      nextCursor: _stringOrNull(json['nextCursor']),
      raw: json,
    );
  }

  Future<Map<String, Object?>> markChatRead(
    String chatId, {
    required String messageId,
    CancelToken? cancelToken,
  }) {
    return _postMap(
      '/chats/$chatId/read',
      data: {'messageId': messageId},
      cancelToken: cancelToken,
    );
  }

  Future<Map<String, Object?>> setChatPinned(
    String chatId, {
    required bool isPinned,
    CancelToken? cancelToken,
  }) {
    return _postMap(
      '/chats/$chatId/pin',
      data: {'isPinned': isPinned},
      cancelToken: cancelToken,
    );
  }

  Future<Map<String, Object?>> deleteChat(
    String chatId, {
    CancelToken? cancelToken,
  }) {
    return _deleteMap('/chats/$chatId', cancelToken: cancelToken);
  }

  Future<Map<String, Object?>> uploadChatAttachmentFile({
    required String chatId,
    required String filePath,
    required String fileName,
    required String mimeType,
    String kind = 'chat_attachment',
    int? durationMs,
    List<double> waveform = const [],
    CancelToken? cancelToken,
  }) async {
    final uploadData = await _postMap(
      '/uploads/chat-attachment/upload-url',
      data: {
        'chatId': chatId,
        'kind': kind,
        'fileName': fileName,
        'contentType': mimeType,
        if (durationMs != null) 'durationMs': durationMs,
        if (waveform.isNotEmpty) 'waveform': waveform,
      },
      cancelToken: cancelToken,
    );
    final uploadUrl = uploadData['uploadUrl']?.toString();
    final objectKey = uploadData['objectKey']?.toString();
    if (uploadUrl == null || uploadUrl.isEmpty) {
      throw StateError('Attachment upload did not return uploadUrl');
    }
    if (objectKey == null || objectKey.isEmpty) {
      throw StateError('Attachment upload did not return objectKey');
    }
    final headers = _stringMap(uploadData['headers']);
    final byteSize = await _putPresignedFile(
      uploadUrl: uploadUrl,
      filePath: filePath,
      headers: headers,
      cancelToken: cancelToken,
    );
    return _postMap(
      '/uploads/chat-attachment/complete',
      data: {
        'chatId': chatId,
        'kind': kind,
        'objectKey': objectKey,
        'mimeType': mimeType,
        'byteSize': byteSize,
        'fileName': fileName,
        if (durationMs != null) 'durationMs': durationMs,
        if (waveform.isNotEmpty) 'waveform': waveform,
      },
      cancelToken: cancelToken,
    );
  }

  Future<Map<String, Object?>> uploadProfilePhotoFile({
    required String filePath,
    required String fileName,
    required String mimeType,
    CancelToken? cancelToken,
  }) async {
    return _postMap(
      '/profile/me/photos/file',
      data: FormData.fromMap({
        'file': await MultipartFile.fromFile(
          filePath,
          filename: fileName,
          contentType: DioMediaType.parse(mimeType),
        ),
      }),
      cancelToken: cancelToken,
    );
  }

  Future<Map<String, Object?>> deleteProfilePhoto(
    String photoId, {
    CancelToken? cancelToken,
  }) {
    return _deleteMap('/profile/me/photos/$photoId', cancelToken: cancelToken);
  }

  Future<Map<String, Object?>> makePrimaryProfilePhoto(
    String photoId, {
    CancelToken? cancelToken,
  }) {
    return _postMap(
      '/profile/me/photos/$photoId/primary',
      cancelToken: cancelToken,
    );
  }

  Future<TokenWalletData> fetchTokenWallet({CancelToken? cancelToken}) async {
    final json = await _getMap('/tokens/wallet', cancelToken: cancelToken);
    return TokenWalletData.fromJson(json);
  }

  Future<TokenWalletData> createPromotion({
    required String targetKind,
    required String targetId,
    String optionId = 'boost-24',
    CancelToken? cancelToken,
  }) async {
    final json = await _postMap(
      '/tokens/promotions',
      data: {
        'targetKind': targetKind,
        'targetId': targetId,
        'optionId': optionId,
      },
      cancelToken: cancelToken,
    );
    return TokenWalletData.fromJson(json);
  }

  Future<PaymentsCatalog> fetchPaymentsCatalog({
    CancelToken? cancelToken,
  }) async {
    final json = await _getMap('/payments/catalog', cancelToken: cancelToken);
    return PaymentsCatalog.fromJson(json);
  }

  Future<PaymentOrderData> initTokenPayment({
    required String productId,
    CancelToken? cancelToken,
  }) async {
    final json = await _postMap(
      '/payments/init',
      data: {'productKind': 'tokens', 'productId': productId},
      cancelToken: cancelToken,
    );
    return PaymentOrderData.fromJson(json);
  }

  Future<SubscriptionStateData> fetchSubscription({
    CancelToken? cancelToken,
  }) async {
    final json = await _getMap('/subscription/me', cancelToken: cancelToken);
    return SubscriptionStateData.fromJson(json);
  }

  Future<List<SubscriptionPlan>> fetchSubscriptionPlans({
    CancelToken? cancelToken,
  }) async {
    final items = await _getList(
      '/subscription/plans',
      cancelToken: cancelToken,
    );
    return items.map(SubscriptionPlan.fromJson).toList(growable: false);
  }

  Future<SubscriptionStateData> subscribeWithTokens({
    required String plan,
    CancelToken? cancelToken,
  }) async {
    final json = await _postMap(
      '/subscription/subscribe',
      data: {'plan': plan},
      cancelToken: cancelToken,
    );
    return SubscriptionStateData.fromJson(json);
  }

  Future<VerificationStateData> fetchVerification({
    CancelToken? cancelToken,
  }) async {
    final json = await _getMap('/verification/me', cancelToken: cancelToken);
    return VerificationStateData.fromJson(json);
  }

  Future<VerificationStateData> submitVerification({
    required String step,
    CancelToken? cancelToken,
  }) async {
    final json = await _postMap(
      '/verification/submit',
      data: {'step': step},
      cancelToken: cancelToken,
    );
    return VerificationStateData.fromJson(json);
  }

  Future<DropsHomeData> fetchDropsHome({CancelToken? cancelToken}) async {
    final json = await _getMap('/drops/home', cancelToken: cancelToken);
    return DropsHomeData.fromJson(json);
  }

  Future<Map<String, Object?>> claimDropsVerification({
    CancelToken? cancelToken,
  }) {
    return _postMap(
      '/drops/tasks/verification/claim',
      cancelToken: cancelToken,
    );
  }

  Future<Map<String, Object?>> claimDropsDailyLogin({
    CancelToken? cancelToken,
  }) {
    return _postMap(
      '/drops/tasks/daily-login/claim',
      cancelToken: cancelToken,
    );
  }

  Future<DropApplyResult> applyDropTickets({
    required String dropId,
    required int ticketCount,
    CancelToken? cancelToken,
  }) async {
    final json = await _postMap(
      '/drops/$dropId/tickets/apply',
      data: {'ticketCount': ticketCount},
      cancelToken: cancelToken,
    );
    return DropApplyResult.fromJson(json);
  }

  Future<DropReferralLinkData> createDropsReferralLink({
    CancelToken? cancelToken,
  }) async {
    final json = await _postMap(
      '/drops/referral-link/create',
      cancelToken: cancelToken,
    );
    return DropReferralLinkData.fromJson(json);
  }

  Future<BackendPage<BackendCardItem>> fetchNotifications({
    int limit = 30,
    CancelToken? cancelToken,
  }) {
    return _fetchCardPage(
      '/notifications',
      query: {'limit': limit},
      cancelToken: cancelToken,
    );
  }

  Future<int> fetchNotificationUnreadCount({
    CancelToken? cancelToken,
  }) async {
    final json = await _getMap(
      '/notifications/unread-count',
      cancelToken: cancelToken,
    );
    return int.tryParse(json['unreadCount']?.toString() ?? '') ?? 0;
  }

  Future<Map<String, Object?>> markNotificationRead(
    String notificationId, {
    CancelToken? cancelToken,
  }) {
    return _postMap(
      '/notifications/$notificationId/read',
      cancelToken: cancelToken,
    );
  }

  Future<Map<String, Object?>> markAllNotificationsRead({
    CancelToken? cancelToken,
  }) {
    return _postMap('/notifications/read-all', cancelToken: cancelToken);
  }

  Future<Map<String, Object?>> registerPushToken({
    required String token,
    String provider = 'fcm',
    String? deviceId,
    String? platform,
    CancelToken? cancelToken,
  }) {
    return _postMap(
      '/push-tokens',
      data: {
        'token': token,
        'provider': provider,
        if (deviceId != null && deviceId.isNotEmpty) 'deviceId': deviceId,
        if (platform != null && platform.isNotEmpty) 'platform': platform,
      },
      cancelToken: cancelToken,
    );
  }

  Future<Map<String, Object?>> deletePushTokenByDeviceId(
    String deviceId, {
    CancelToken? cancelToken,
  }) {
    return _deleteMap(
      '/push-tokens/device/$deviceId',
      cancelToken: cancelToken,
    );
  }

  Future<BackendPage<BackendCardItem>> fetchCommunities({
    int limit = 20,
    String? cursor,
    CancelToken? cancelToken,
  }) {
    return _fetchCardPage(
      '/communities',
      query: {'limit': limit, 'cursor': cursor},
      cancelToken: cancelToken,
    );
  }

  Future<BackendCardItem> fetchCommunityDetail(
    String communityId, {
    CancelToken? cancelToken,
  }) async {
    final json = await _getMap(
      '/communities/$communityId',
      cancelToken: cancelToken,
    );
    return BackendCardItem.fromJson(json);
  }

  Future<BackendCardItem> createCommunity({
    required Map<String, Object?> data,
    required String idempotencyKey,
    CancelToken? cancelToken,
  }) async {
    final json = await _postMap(
      '/communities',
      data: data,
      options: Options(headers: {'idempotency-key': idempotencyKey}),
      cancelToken: cancelToken,
    );
    return BackendCardItem.fromJson(json);
  }

  Future<BackendCardItem> joinCommunity(
    String communityId, {
    CancelToken? cancelToken,
  }) async {
    final json = await _postMap(
      '/communities/$communityId/join',
      cancelToken: cancelToken,
    );
    return BackendCardItem.fromJson(json);
  }

  Future<BackendCardItem> leaveCommunity(
    String communityId, {
    CancelToken? cancelToken,
  }) async {
    final json = await _deleteMap(
      '/communities/$communityId/join',
      cancelToken: cancelToken,
    );
    return BackendCardItem.fromJson(json);
  }

  Future<BackendPage<BackendCardItem>> fetchCommunityMedia(
    String communityId, {
    int limit = 20,
    String? cursor,
    CancelToken? cancelToken,
  }) {
    return _fetchCardPage(
      '/communities/$communityId/media',
      query: {'limit': limit, 'cursor': cursor},
      cancelToken: cancelToken,
    );
  }

  Future<BackendCardItem> createCommunityNews({
    required String communityId,
    required String title,
    required String body,
    bool pin = true,
    CancelToken? cancelToken,
  }) async {
    final json = await _postMap(
      '/communities/$communityId/news',
      data: {'title': title, 'body': body, 'pin': pin},
      cancelToken: cancelToken,
    );
    return BackendCardItem.fromJson(json);
  }

  Future<EveningRouteSessionData> createRouteTemplateSession({
    required String templateId,
    required DateTime startsAt,
    String privacy = 'open',
    int? capacity,
    CancelToken? cancelToken,
  }) async {
    final json = await _postMap(
      '/evening/route-templates/$templateId/sessions',
      data: {
        'startsAt': startsAt.toUtc().toIso8601String(),
        'privacy': privacy,
        if (capacity != null) 'capacity': capacity,
      },
      cancelToken: cancelToken,
    );
    return EveningRouteSessionData.fromJson(json);
  }

  Future<Map<String, Object?>> startEveningSession(
    String sessionId, {
    CancelToken? cancelToken,
  }) {
    return _postMap(
      '/evening/sessions/$sessionId/start',
      cancelToken: cancelToken,
    );
  }

  Future<Map<String, Object?>> joinEveningSession(
    String sessionId, {
    String? inviteToken,
    String? note,
    CancelToken? cancelToken,
  }) {
    return _postMap(
      '/evening/sessions/$sessionId/join',
      data: {
        if (inviteToken != null && inviteToken.isNotEmpty)
          'inviteToken': inviteToken,
        if (note != null && note.isNotEmpty) 'note': note,
      },
      cancelToken: cancelToken,
    );
  }

  Future<Map<String, Object?>> checkInEveningStep({
    required String sessionId,
    required String stepId,
    CancelToken? cancelToken,
  }) {
    return _postMap(
      '/evening/sessions/$sessionId/steps/$stepId/check-in',
      cancelToken: cancelToken,
    );
  }

  Future<Map<String, Object?>> advanceEveningStep({
    required String sessionId,
    required String stepId,
    CancelToken? cancelToken,
  }) {
    return _postMap(
      '/evening/sessions/$sessionId/steps/$stepId/advance',
      cancelToken: cancelToken,
    );
  }

  Future<Map<String, Object?>> skipEveningStep({
    required String sessionId,
    required String stepId,
    CancelToken? cancelToken,
  }) {
    return _postMap(
      '/evening/sessions/$sessionId/steps/$stepId/skip',
      cancelToken: cancelToken,
    );
  }

  Future<Map<String, Object?>> finishEveningSession(
    String sessionId, {
    CancelToken? cancelToken,
  }) {
    return _postMap(
      '/evening/sessions/$sessionId/finish',
      cancelToken: cancelToken,
    );
  }

  Future<Map<String, Object?>> fetchEveningAfterParty(
    String sessionId, {
    CancelToken? cancelToken,
  }) {
    return _getMap(
      '/evening/sessions/$sessionId/after-party',
      cancelToken: cancelToken,
    );
  }

  Future<Map<String, Object?>> saveEveningAfterPartyFeedback({
    required String sessionId,
    required int rating,
    String? reaction,
    String? comment,
    CancelToken? cancelToken,
  }) {
    return _postMap(
      '/evening/sessions/$sessionId/after-party/feedback',
      data: {
        'rating': rating,
        if (reaction != null && reaction.isNotEmpty) 'reaction': reaction,
        if (comment != null && comment.isNotEmpty) 'comment': comment,
      },
      cancelToken: cancelToken,
    );
  }

  Future<Map<String, Object?>> addEveningAfterPartyPhoto({
    required String sessionId,
    required String assetId,
    CancelToken? cancelToken,
  }) {
    return _postMap(
      '/evening/sessions/$sessionId/after-party/photos',
      data: {'assetId': assetId},
      cancelToken: cancelToken,
    );
  }

  Future<PartnerOfferCodeData> issuePartnerOfferCode({
    required String sessionId,
    required String stepId,
    required String offerId,
    CancelToken? cancelToken,
  }) async {
    final json = await _postMap(
      '/evening/sessions/$sessionId/steps/$stepId/offers/$offerId/code',
      cancelToken: cancelToken,
    );
    return PartnerOfferCodeData.fromJson(json);
  }

  Future<PartnerOfferCodeData> fetchPartnerOfferCode(
    String codeId, {
    CancelToken? cancelToken,
  }) async {
    final json = await _getMap(
      '/evening/offer-codes/$codeId',
      cancelToken: cancelToken,
    );
    return PartnerOfferCodeData.fromJson(json);
  }

  Future<EveningAiDraftData> createEveningAiDraft({
    required String prompt,
    String? city,
    CancelToken? cancelToken,
  }) async {
    final json = await _postMap(
      '/evening/routes/ai-drafts',
      data: {
        'prompt': prompt,
        if (city != null && city.isNotEmpty) 'city': city,
      },
      cancelToken: cancelToken,
    );
    return EveningAiDraftData.fromJson(json);
  }

  Future<EveningAiDraftData> fetchEveningAiDraft(
    String draftId, {
    CancelToken? cancelToken,
  }) async {
    final json = await _getMap(
      '/evening/routes/ai-drafts/$draftId',
      cancelToken: cancelToken,
    );
    return EveningAiDraftData.fromJson(json);
  }

  Future<EveningAiDraftData> acceptEveningAiDraftStep({
    required String draftId,
    required int stepIndex,
    CancelToken? cancelToken,
  }) async {
    final json = await _postMap(
      '/evening/routes/ai-drafts/$draftId/steps/$stepIndex/accept',
      cancelToken: cancelToken,
    );
    return EveningAiDraftData.fromJson(json);
  }

  Future<EveningAiDraftData> regenerateEveningAiDraft(
    String draftId, {
    CancelToken? cancelToken,
  }) async {
    final json = await _postMap(
      '/evening/routes/ai-drafts/$draftId/regenerate',
      cancelToken: cancelToken,
    );
    return EveningAiDraftData.fromJson(json);
  }

  Future<EveningAiDraftData> confirmEveningAiDraft(
    String draftId, {
    CancelToken? cancelToken,
  }) async {
    final json = await _postMap(
      '/evening/routes/ai-drafts/$draftId/confirm',
      cancelToken: cancelToken,
    );
    return EveningAiDraftData.fromJson(json);
  }

  Future<AfterDarkAccessData> fetchAfterDarkAccess({
    CancelToken? cancelToken,
  }) async {
    final json = await _getMap('/after-dark/access', cancelToken: cancelToken);
    return AfterDarkAccessData.fromJson(json);
  }

  Future<AfterDarkAccessData> unlockAfterDark({
    required String plan,
    required bool ageConfirmed,
    required bool codeAccepted,
    CancelToken? cancelToken,
  }) async {
    final json = await _postMap(
      '/after-dark/unlock',
      data: {
        'plan': plan,
        'ageConfirmed': ageConfirmed,
        'codeAccepted': codeAccepted,
      },
      cancelToken: cancelToken,
    );
    return AfterDarkAccessData.fromJson(json);
  }

  Future<BackendPage<BackendCardItem>> fetchAfterDarkEvents({
    int limit = 20,
    String? cursor,
    String? query,
    CancelToken? cancelToken,
  }) {
    return _fetchCardPage(
      '/after-dark/events',
      query: {'limit': limit, 'cursor': cursor, 'q': query},
      cancelToken: cancelToken,
    );
  }

  Future<BackendCardItem> fetchPublicUser(
    String userId, {
    CancelToken? cancelToken,
  }) async {
    final json = await _getMap('/people/$userId', cancelToken: cancelToken);
    return BackendCardItem.fromJson(json);
  }

  Future<ProfileSocialData> fetchProfileSocial(
    String userId, {
    CancelToken? cancelToken,
  }) async {
    final json =
        await _getMap('/people/$userId/social', cancelToken: cancelToken);
    return ProfileSocialData.fromJson(json);
  }

  Future<Map<String, Object?>> createDirectChat(
    String userId, {
    CancelToken? cancelToken,
  }) {
    return _postMap('/people/$userId/direct-chat', cancelToken: cancelToken);
  }

  Future<Map<String, Object?>> setProfileReaction({
    required String userId,
    required String kind,
    required bool active,
    CancelToken? cancelToken,
  }) {
    final path = '/people/$userId/reactions/$kind';
    return active
        ? _putMap(path, cancelToken: cancelToken)
        : _deleteMap(path, cancelToken: cancelToken);
  }

  Future<ProfileSocialData> setProfileFollow({
    required String userId,
    required bool active,
    CancelToken? cancelToken,
  }) async {
    final path = '/people/$userId/follow';
    final json = active
        ? await _putMap(path, cancelToken: cancelToken)
        : await _deleteMap(path, cancelToken: cancelToken);
    return ProfileSocialData.fromJson(json);
  }

  Future<ProfileSocialData> setProfileFollowNotifications({
    required String userId,
    required bool enabled,
    CancelToken? cancelToken,
  }) async {
    final json = await _patchMap(
      '/people/$userId/follow/notifications',
      data: {'enabled': enabled},
      cancelToken: cancelToken,
    );
    return ProfileSocialData.fromJson(json);
  }

  Future<HostDashboardData> fetchHostDashboard({
    int eventsLimit = 20,
    int requestsLimit = 20,
    CancelToken? cancelToken,
  }) async {
    final json = await _getMap(
      '/host/dashboard',
      query: {
        'eventsLimit': eventsLimit,
        'requestsLimit': requestsLimit,
      },
      cancelToken: cancelToken,
    );
    return HostDashboardData.fromJson(json);
  }

  Future<HostJoinRequestData> approveHostRequest(
    String requestId, {
    CancelToken? cancelToken,
  }) async {
    final json = await _postMap(
      '/host/requests/$requestId/approve',
      cancelToken: cancelToken,
    );
    return HostJoinRequestData.fromJson(json);
  }

  Future<HostJoinRequestData> rejectHostRequest(
    String requestId, {
    CancelToken? cancelToken,
  }) async {
    final json = await _postMap(
      '/host/requests/$requestId/reject',
      cancelToken: cancelToken,
    );
    return HostJoinRequestData.fromJson(json);
  }

  Future<BackendPage<BackendCardItem>> fetchMapEvents({
    required double north,
    required double south,
    required double east,
    required double west,
    int limit = 80,
    CancelToken? cancelToken,
  }) {
    return _fetchCardPage(
      '/events',
      query: {
        'north': _roundViewport(north),
        'south': _roundViewport(south),
        'east': _roundViewport(east),
        'west': _roundViewport(west),
        'limit': limit,
      },
      cancelToken: cancelToken,
    );
  }

  Future<BackendCardItem> fetchAfterDarkEvent(
    String eventId, {
    CancelToken? cancelToken,
  }) async {
    final json = await _getMap(
      '/after-dark/events/$eventId',
      cancelToken: cancelToken,
    );
    return BackendCardItem.fromJson(json);
  }

  Future<BackendCardItem> joinAfterDarkEvent(
    String eventId, {
    bool acceptedRules = true,
    String note = '',
    CancelToken? cancelToken,
  }) async {
    final json = await _postMap(
      '/after-dark/events/$eventId/join',
      data: {
        'acceptedRules': acceptedRules,
        if (note.isNotEmpty) 'note': note,
      },
      cancelToken: cancelToken,
    );
    return BackendCardItem.fromJson(json);
  }

  Future<BackendPage<BackendCardItem>> search(
    String query, {
    String? city,
    CancelToken? cancelToken,
  }) {
    return _fetchCardPage(
      '/search',
      query: {
        'q': query,
        'city': city,
        'meetupsLimit': 8,
        'routesLimit': 6,
        'afficheLimit': 6,
      },
      cancelToken: cancelToken,
    );
  }

  Future<BackendPage<BackendCardItem>> fetchDatingDiscover({
    int limit = 10,
    String? gender,
    int? ageMin,
    int? ageMax,
    int? radiusKm,
    List<String> interests = const [],
    bool? verifiedOnly,
    bool? onlineOnly,
    bool? newThisWeekOnly,
    CancelToken? cancelToken,
  }) {
    return _fetchCardPage(
      '/dating/discover',
      query: {
        'limit': limit,
        if (gender != null && gender.isNotEmpty) 'gender': gender,
        'ageMin': ageMin,
        'ageMax': ageMax,
        'radiusKm': radiusKm,
        if (interests.isNotEmpty) 'interests': interests,
        if (verifiedOnly != null) 'verifiedOnly': verifiedOnly,
        if (onlineOnly != null) 'onlineOnly': onlineOnly,
        if (newThisWeekOnly != null) 'newThisWeekOnly': newThisWeekOnly,
      },
      cancelToken: cancelToken,
    );
  }

  Future<Map<String, Object?>> recordDatingAction({
    required String targetUserId,
    required String action,
    CancelToken? cancelToken,
  }) {
    return _postMap(
      '/dating/actions',
      data: {'targetUserId': targetUserId, 'action': action},
      cancelToken: cancelToken,
    );
  }

  Future<BackendPage<BackendCardItem>> fetchPerks({
    String? city,
    String? category,
    int limit = 20,
    CancelToken? cancelToken,
  }) {
    return _fetchCardPage(
      '/places/promos',
      query: {'city': city, 'category': category, 'limit': limit},
      cancelToken: cancelToken,
    );
  }

  Future<BackendPage<BackendCardItem>> searchPlaces({
    required String query,
    String? city,
    int limit = 20,
    CancelToken? cancelToken,
  }) async {
    if (query.trim().length < 2) {
      return const BackendPage(items: []);
    }
    final items = await _getList(
      '/places/search',
      query: {'q': query, 'city': city, 'limit': limit},
      cancelToken: cancelToken,
    );
    return BackendPage(
      items: items.map(BackendCardItem.fromJson).toList(growable: false),
      raw: {'items': items},
    );
  }

  Future<BackendPage<BackendCardItem>> fetchHistory({
    CancelToken? cancelToken,
  }) {
    return _fetchCardPage(
      '/profile/me/frendly-history',
      cancelToken: cancelToken,
    );
  }

  Future<FrendlySeasonData> fetchFrendlySeason({
    CancelToken? cancelToken,
  }) async {
    final json = await _getMap(
      '/profile/me/frendly-season',
      cancelToken: cancelToken,
    );
    return FrendlySeasonData.fromJson(json);
  }

  Future<Map<String, Object?>> claimFrendlySeasonReward(
    String rewardKey, {
    CancelToken? cancelToken,
  }) {
    return _postMap(
      '/profile/me/frendly-season/rewards/$rewardKey/claim',
      cancelToken: cancelToken,
    );
  }

  Future<BackendPage<BackendCardItem>> fetchTrustedContacts({
    CancelToken? cancelToken,
  }) async {
    final response = await _dio.get<Object?>(
      '/safety/trusted-contacts',
      cancelToken: cancelToken,
    );
    return BackendPage(
      items: _asList(response.data)
          .map(BackendCardItem.fromJson)
          .toList(growable: false),
    );
  }

  Future<BackendCardItem> createTrustedContact({
    required String name,
    required String value,
    String channel = 'phone',
    String mode = 'sos_only',
    CancelToken? cancelToken,
  }) async {
    final json = await _postMap(
      '/safety/trusted-contacts',
      data: {
        'name': name,
        'channel': channel,
        'value': value,
        'mode': mode,
      },
      cancelToken: cancelToken,
    );
    return BackendCardItem.fromJson(json);
  }

  Future<void> deleteTrustedContact(
    String contactId, {
    CancelToken? cancelToken,
  }) async {
    await _dio.delete<Object?>(
      '/safety/trusted-contacts/$contactId',
      cancelToken: cancelToken,
    );
  }

  Future<Map<String, Object?>> createSos({
    String? eventId,
    CancelToken? cancelToken,
  }) {
    return _postMap(
      '/safety/sos',
      data: {if (eventId != null && eventId.isNotEmpty) 'eventId': eventId},
      cancelToken: cancelToken,
    );
  }

  Future<BackendPage<BackendCardItem>> fetchMatches({
    int limit = 10,
    String? cursor,
    CancelToken? cancelToken,
  }) {
    return _fetchCardPage(
      '/matches',
      query: {'limit': limit, 'cursor': cursor},
      cancelToken: cancelToken,
    );
  }

  Future<Map<String, Object?>> createReport({
    required String targetUserId,
    required String reason,
    String details = '',
    bool blockRequested = false,
    CancelToken? cancelToken,
  }) {
    return _postMap(
      '/reports',
      data: {
        'targetUserId': targetUserId,
        'reason': reason,
        'details': details,
        'blockRequested': blockRequested,
      },
      cancelToken: cancelToken,
    );
  }

  Future<BackendPage<SafetyReportData>> fetchReports({
    CancelToken? cancelToken,
  }) async {
    final json = await _getList('/reports/me', cancelToken: cancelToken);
    return BackendPage(
      items: json.map(SafetyReportData.fromJson).toList(growable: false),
      raw: {'items': json},
    );
  }

  Future<BackendPage<BlockedUserData>> fetchBlocks({
    CancelToken? cancelToken,
  }) async {
    final json = await _getList('/blocks', cancelToken: cancelToken);
    return BackendPage(
      items: json.map(BlockedUserData.fromJson).toList(growable: false),
      raw: {'items': json},
    );
  }

  Future<BlockedUserData> createBlock({
    required String targetUserId,
    CancelToken? cancelToken,
  }) async {
    final json = await _postMap(
      '/blocks',
      data: {'targetUserId': targetUserId},
      cancelToken: cancelToken,
    );
    return BlockedUserData.fromJson(json);
  }

  Future<Map<String, Object?>> createShare({
    required String targetType,
    required String targetId,
    CancelToken? cancelToken,
  }) {
    return _postMap(
      '/shares',
      data: {'targetType': targetType, 'targetId': targetId},
      cancelToken: cancelToken,
    );
  }

  Future<BackendPage<BackendCardItem>> fetchEventStories(
    String eventId, {
    int limit = 20,
    String? cursor,
    CancelToken? cancelToken,
  }) {
    return _fetchCardPage(
      '/events/$eventId/stories',
      query: {'limit': limit, 'cursor': cursor},
      cancelToken: cancelToken,
    );
  }

  Future<BackendPage<BackendCardItem>> fetchMemoryPeople({
    CancelToken? cancelToken,
  }) {
    return _fetchCardPage(
      '/profile/me/frendly-people',
      cancelToken: cancelToken,
    );
  }

  Future<Map<String, Object?>> fetchSignedMediaUrl(String path) {
    return _getMap(path);
  }

  Future<BackendPage<BackendCardItem>> _fetchCardPage(
    String path, {
    Map<String, Object?> query = const {},
    CancelToken? cancelToken,
  }) async {
    final json = await _getMap(path, query: query, cancelToken: cancelToken);
    return BackendPage(
      items: _items(json).map(BackendCardItem.fromJson).toList(growable: false),
      nextCursor: _stringOrNull(json['nextCursor']),
      raw: json,
    );
  }

  BackendPage<BackendChatSummary> _chatPage(Map<String, Object?> json) {
    return BackendPage(
      items:
          _items(json).map(BackendChatSummary.fromJson).toList(growable: false),
      nextCursor: _stringOrNull(json['nextCursor']),
      raw: json,
    );
  }

  Future<Map<String, Object?>> _getMap(
    String path, {
    Map<String, Object?> query = const {},
    CancelToken? cancelToken,
  }) async {
    final response = await _dio.get<Object?>(
      path,
      queryParameters: _cleanQuery(query),
      cancelToken: cancelToken,
    );
    return _asMap(response.data);
  }

  Future<List<Map<String, Object?>>> _getList(
    String path, {
    Map<String, Object?> query = const {},
    CancelToken? cancelToken,
  }) async {
    final response = await _dio.get<Object?>(
      path,
      queryParameters: _cleanQuery(query),
      cancelToken: cancelToken,
    );
    return _asList(response.data);
  }

  Future<Map<String, Object?>> _postMap(
    String path, {
    Object? data,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    final response = await _dio.post<Object?>(
      path,
      data: data,
      options: options,
      cancelToken: cancelToken,
    );
    return _asMap(response.data);
  }

  Future<Map<String, Object?>> _patchMap(
    String path, {
    Object? data,
    CancelToken? cancelToken,
  }) async {
    final response = await _dio.patch<Object?>(
      path,
      data: data,
      cancelToken: cancelToken,
    );
    return _asMap(response.data);
  }

  Future<Map<String, Object?>> _putMap(
    String path, {
    Object? data,
    CancelToken? cancelToken,
  }) async {
    final response = await _dio.put<Object?>(
      path,
      data: data,
      cancelToken: cancelToken,
    );
    return _asMap(response.data);
  }

  Future<Map<String, Object?>> _deleteMap(
    String path, {
    CancelToken? cancelToken,
  }) async {
    final response = await _dio.delete<Object?>(
      path,
      cancelToken: cancelToken,
    );
    return _asMap(response.data);
  }

  Future<int> _putPresignedFile({
    required String uploadUrl,
    required String filePath,
    required Map<String, String> headers,
    CancelToken? cancelToken,
  }) async {
    final file = File(filePath);
    final byteSize = await file.length();
    await _dio.put<Object?>(
      uploadUrl,
      data: file.openRead(),
      options: Options(
        headers: {
          ...headers,
          Headers.contentLengthHeader: byteSize,
        },
        extra: {
          'skipAuthHeader': true,
          'skipAuthRefresh': true,
          'skipRequestDeduplication': true,
        },
      ),
      cancelToken: cancelToken,
    );
    return byteSize;
  }

  Map<String, Object?> _asMap(Object? value) {
    if (value is Map) {
      return value.map((key, value) => MapEntry('$key', value));
    }
    return const {};
  }

  List<Map<String, Object?>> _asList(Object? value) {
    if (value is List) {
      return value.whereType<Map>().map(_asMap).toList(growable: false);
    }
    if (value is Map) {
      return _items(_asMap(value));
    }
    return const [];
  }

  List<Map<String, Object?>> _items(Map<String, Object?> json) {
    final direct = json['items'];
    if (direct is List) {
      return direct.whereType<Map>().map(_asMap).toList(growable: false);
    }
    final grouped = <Map<String, Object?>>[];
    for (final key in [
      'meetups',
      'evenings',
      'routes',
      'affiche',
      'people',
      'communities',
      'plans',
    ]) {
      final value = json[key];
      if (value is List) {
        grouped.addAll(value.whereType<Map>().map(_asMap));
      }
    }
    return grouped;
  }

  Map<String, Object?> _cleanQuery(Map<String, Object?> query) {
    return Map.fromEntries(
      query.entries.where((entry) => entry.value != null && entry.value != ''),
    );
  }

  Map<String, String> _stringMap(Object? value) {
    if (value is! Map) {
      return const {};
    }
    return value.map((key, value) => MapEntry('$key', value?.toString() ?? ''));
  }

  String? _stringOrNull(Object? value) {
    final result = value?.toString();
    if (result == null || result.isEmpty) {
      return null;
    }
    return result;
  }

  double _roundViewport(double value) {
    return (value * 1000).roundToDouble() / 1000;
  }
}

import 'package:mobile2/shared/models/backend_url.dart';

class AuthTokens {
  const AuthTokens({
    required this.accessToken,
    required this.refreshToken,
  });

  final String accessToken;
  final String refreshToken;

  factory AuthTokens.fromJson(Map<String, Object?> json) {
    return AuthTokens(
      accessToken: json['accessToken'] as String? ?? '',
      refreshToken: json['refreshToken'] as String? ?? '',
    );
  }

  Map<String, Object?> toJson() {
    return {
      'accessToken': accessToken,
      'refreshToken': refreshToken,
    };
  }
}

class AuthSession {
  const AuthSession({
    required this.tokens,
    this.userId = '',
    this.isNewUser = false,
  });

  final AuthTokens tokens;
  final String userId;
  final bool isNewUser;

  factory AuthSession.fromJson(Map<String, Object?> json) {
    return AuthSession(
      tokens: AuthTokens.fromJson(json),
      userId: _string(json['userId']),
      isNewUser: _bool(json['isNewUser']),
    );
  }
}

class PhoneAuthChallenge {
  const PhoneAuthChallenge({
    required this.challengeId,
    this.maskedPhone,
    this.resendAfterSeconds = 0,
    this.localCodeHint,
    this.raw = const {},
  });

  final String challengeId;
  final String? maskedPhone;
  final int resendAfterSeconds;
  final String? localCodeHint;
  final Map<String, Object?> raw;

  factory PhoneAuthChallenge.fromJson(Map<String, Object?> json) {
    return PhoneAuthChallenge(
      challengeId: _string(json['challengeId']),
      maskedPhone: _stringOrNull(json['maskedPhone']),
      resendAfterSeconds: _int(json['resendAfterSeconds']),
      localCodeHint: _stringOrNull(json['localCodeHint']),
      raw: json,
    );
  }
}

class TelegramAuthStart {
  const TelegramAuthStart({
    required this.loginSessionId,
    required this.botUrl,
    this.codeLength = 4,
    this.expiresAt,
    this.raw = const {},
  });

  final String loginSessionId;
  final String botUrl;
  final int codeLength;
  final DateTime? expiresAt;
  final Map<String, Object?> raw;

  factory TelegramAuthStart.fromJson(Map<String, Object?> json) {
    return TelegramAuthStart(
      loginSessionId: _string(json['loginSessionId']),
      botUrl: _string(json['botUrl']),
      codeLength: _int(json['codeLength']),
      expiresAt: _date(json['expiresAt']),
      raw: json,
    );
  }
}

class OnboardingData {
  const OnboardingData({
    this.intent,
    this.gender,
    this.birthDate,
    this.city,
    this.area,
    this.interests = const [],
    this.vibe,
    this.email,
    this.phoneNumber,
    this.requiredContact,
    this.raw = const {},
  });

  final String? intent;
  final String? gender;
  final String? birthDate;
  final String? city;
  final String? area;
  final List<String> interests;
  final String? vibe;
  final String? email;
  final String? phoneNumber;
  final String? requiredContact;
  final Map<String, Object?> raw;

  factory OnboardingData.fromJson(Map<String, Object?> json) {
    return OnboardingData(
      intent: _stringOrNull(json['intent']),
      gender: _stringOrNull(json['gender']),
      birthDate: _stringOrNull(json['birthDate']),
      city: _stringOrNull(json['city']),
      area: _stringOrNull(json['area']),
      interests: _stringList(json['interests']),
      vibe: _stringOrNull(json['vibe']),
      email: _stringOrNull(json['email']),
      phoneNumber: _stringOrNull(json['phoneNumber']),
      requiredContact: _stringOrNull(json['requiredContact']),
      raw: json,
    );
  }

  Map<String, Object?> toJson() {
    return {
      'intent': intent,
      'gender': gender,
      'birthDate': birthDate,
      'city': city,
      'area': area,
      'interests': interests,
      'vibe': vibe,
      'email': email,
      'phoneNumber': phoneNumber,
    }..removeWhere((_, value) => value == null);
  }
}

class AppSettingsData {
  const AppSettingsData({
    this.allowLocation = false,
    this.allowPush = false,
    this.allowContacts = false,
    this.autoSharePlans = false,
    this.hideExactLocation = false,
    this.quietHours = false,
    this.showAge = true,
    this.discoverable = true,
    this.darkMode = false,
    this.raw = const {},
  });

  final bool allowLocation;
  final bool allowPush;
  final bool allowContacts;
  final bool autoSharePlans;
  final bool hideExactLocation;
  final bool quietHours;
  final bool showAge;
  final bool discoverable;
  final bool darkMode;
  final Map<String, Object?> raw;

  factory AppSettingsData.fromJson(Map<String, Object?> json) {
    return AppSettingsData(
      allowLocation: _bool(json['allowLocation']),
      allowPush: _bool(json['allowPush']),
      allowContacts: _bool(json['allowContacts']),
      autoSharePlans: _bool(json['autoSharePlans']),
      hideExactLocation: _bool(json['hideExactLocation']),
      quietHours: _bool(json['quietHours']),
      showAge: _bool(json['showAge'], fallback: true),
      discoverable: _bool(json['discoverable'], fallback: true),
      darkMode: _bool(json['darkMode']),
      raw: json,
    );
  }

  Map<String, Object?> toJson() {
    return {
      'allowLocation': allowLocation,
      'allowPush': allowPush,
      'allowContacts': allowContacts,
      'autoSharePlans': autoSharePlans,
      'hideExactLocation': hideExactLocation,
      'quietHours': quietHours,
      'showAge': showAge,
      'discoverable': discoverable,
      'darkMode': darkMode,
    };
  }
}

class SafetyData {
  const SafetyData({
    required this.trustScore,
    required this.settings,
    this.trustedContacts = const [],
    this.blockedUsersCount = 0,
    this.reportsCount = 0,
    this.raw = const {},
  });

  final int trustScore;
  final AppSettingsData settings;
  final List<BackendCardItem> trustedContacts;
  final int blockedUsersCount;
  final int reportsCount;
  final Map<String, Object?> raw;

  factory SafetyData.fromJson(Map<String, Object?> json) {
    return SafetyData(
      trustScore: _int(json['trustScore']),
      settings: AppSettingsData.fromJson(_map(json['settings'])),
      trustedContacts: _list(json['trustedContacts'])
          .map(BackendCardItem.fromJson)
          .toList(growable: false),
      blockedUsersCount: _int(json['blockedUsersCount']),
      reportsCount: _int(json['reportsCount']),
      raw: json,
    );
  }
}

class BackendUser {
  const BackendUser({
    required this.id,
    required this.name,
    this.avatarUrl,
    this.gender,
    this.onboardingComplete = false,
    this.city,
    this.raw = const {},
  });

  final String id;
  final String name;
  final String? avatarUrl;
  final String? gender;
  final bool onboardingComplete;
  final String? city;
  final Map<String, Object?> raw;

  factory BackendUser.fromJson(Map<String, Object?> json) {
    final profile = _map(json['profile']);
    final onboarding = _map(json['onboarding']);
    return BackendUser(
      id: _string(json['id'] ?? json['userId']),
      name: _string(
        json['name'] ??
            json['displayName'] ??
            profile['name'] ??
            profile['displayName'] ??
            'Профиль',
      ),
      avatarUrl: _urlOrNull(
        json['avatarUrl'] ?? profile['avatarUrl'] ?? profile['photoUrl'],
      ),
      gender: _stringOrNull(
        json['gender'] ?? profile['gender'] ?? onboarding['gender'],
      ),
      onboardingComplete: json['onboardingComplete'] as bool? ??
          json['setupComplete'] as bool? ??
          false,
      city: _stringOrNull(json['city'] ?? profile['city']),
      raw: json,
    );
  }
}

class SafetyReportData {
  const SafetyReportData({
    required this.id,
    required this.targetUserId,
    required this.reason,
    required this.status,
    this.details,
    this.blockRequested = false,
    this.createdAt,
    this.raw = const {},
  });

  final String id;
  final String targetUserId;
  final String reason;
  final String status;
  final String? details;
  final bool blockRequested;
  final DateTime? createdAt;
  final Map<String, Object?> raw;

  factory SafetyReportData.fromJson(Map<String, Object?> json) {
    return SafetyReportData(
      id: _string(json['id']),
      targetUserId: _string(json['targetUserId']),
      reason: _string(json['reason']),
      status: _string(json['status']),
      details: _stringOrNull(json['details']),
      blockRequested: _bool(json['blockRequested']),
      createdAt: _date(json['createdAt']),
      raw: json,
    );
  }
}

class BlockedUserData {
  const BlockedUserData({
    required this.id,
    required this.blockedUserId,
    this.displayName,
    this.createdAt,
    this.raw = const {},
  });

  final String id;
  final String blockedUserId;
  final String? displayName;
  final DateTime? createdAt;
  final Map<String, Object?> raw;

  factory BlockedUserData.fromJson(Map<String, Object?> json) {
    final user = _map(json['blockedUser']);
    return BlockedUserData(
      id: _string(json['id']),
      blockedUserId: _string(json['blockedUserId'] ?? user['id']),
      displayName: _stringOrNull(
        json['displayName'] ?? user['displayName'] ?? user['name'],
      ),
      createdAt: _date(json['createdAt']),
      raw: json,
    );
  }
}

class BackendCardItem {
  const BackendCardItem({
    required this.id,
    required this.title,
    this.subtitle,
    this.imageUrl,
    this.startsAt,
    this.city,
    this.latitude,
    this.longitude,
    this.raw = const {},
  });

  final String id;
  final String title;
  final String? subtitle;
  final String? imageUrl;
  final DateTime? startsAt;
  final String? city;
  final double? latitude;
  final double? longitude;
  final Map<String, Object?> raw;

  factory BackendCardItem.fromJson(Map<String, Object?> json) {
    final place = _map(json['place']);
    final location = _map(json['location']);
    final profile = _map(json['profile']);
    final media = _map(json['media']);
    final primaryPhoto = _map(json['primaryPhoto']);
    final photos = _list(json['photos']);
    return BackendCardItem(
      id: _string(
        json['id'] ??
            json['eventId'] ??
            json['routeId'] ??
            json['userId'] ??
            json['communityId'] ??
            json['mediaId'] ??
            json['placeId'],
      ),
      title: _string(
        json['title'] ??
            json['name'] ??
            json['displayName'] ??
            json['caption'] ??
            json['label'] ??
            profile['name'] ??
            profile['displayName'],
      ),
      subtitle: _stringOrNull(
        json['subtitle'] ??
            json['description'] ??
            json['body'] ??
            json['bio'] ??
            json['district'] ??
            json['address'] ??
            json['time'] ??
            profile['bio'] ??
            place['address'] ??
            place['name'],
      ),
      imageUrl: _urlOrNull(
        _cardImageVariantUrl(json['imageVariants']) ??
            json['imageUrl'] ??
            json['coverUrl'] ??
            json['avatarUrl'] ??
            json['photoUrl'] ??
            _profilePhotoUrl(primaryPhoto) ??
            _profilePhotoUrl(photos.isEmpty ? null : photos.first) ??
            media['url'] ??
            media['downloadUrl'] ??
            profile['avatarUrl'] ??
            profile['photoUrl'] ??
            place['imageUrl'] ??
            place['coverUrl'],
      ),
      startsAt: _date(json['startsAt'] ?? json['date'] ?? json['createdAt']),
      city: _stringOrNull(json['city'] ?? profile['city'] ?? place['city']),
      latitude: _double(
          json['latitude'] ?? place['latitude'] ?? location['latitude']),
      longitude: _double(
          json['longitude'] ?? place['longitude'] ?? location['longitude']),
      raw: json,
    );
  }
}

class BackendPage<T> {
  const BackendPage({
    required this.items,
    this.nextCursor,
    this.raw = const {},
  });

  final List<T> items;
  final String? nextCursor;
  final Map<String, Object?> raw;
}

class BackendChatSummary {
  const BackendChatSummary({
    required this.id,
    required this.title,
    this.subtitle,
    this.imageUrl,
    this.unreadCount = 0,
    this.kind = 'meetup',
    this.raw = const {},
  });

  final String id;
  final String title;
  final String? subtitle;
  final String? imageUrl;
  final int unreadCount;
  final String kind;
  final Map<String, Object?> raw;

  factory BackendChatSummary.fromJson(Map<String, Object?> json) {
    return BackendChatSummary(
      id: _string(json['id'] ?? json['chatId']),
      title: _string(json['title'] ?? json['name'] ?? json['eventTitle']),
      subtitle: _stringOrNull(json['lastMessage'] ?? json['preview']),
      imageUrl: _urlOrNull(json['imageUrl'] ?? json['avatarUrl']),
      unreadCount: _int(json['unreadCount'] ?? json['unread']),
      kind: _string(json['kind'] ?? json['type'] ?? 'meetup'),
      raw: json,
    );
  }
}

class BackendChatMessage {
  const BackendChatMessage({
    required this.id,
    required this.chatId,
    required this.text,
    this.clientMessageId,
    this.senderId,
    this.senderName,
    this.senderAvatarUrl,
    this.createdAt,
    this.pending = false,
    this.raw = const {},
  });

  final String id;
  final String chatId;
  final String text;
  final String? clientMessageId;
  final String? senderId;
  final String? senderName;
  final String? senderAvatarUrl;
  final DateTime? createdAt;
  final bool pending;
  final Map<String, Object?> raw;

  factory BackendChatMessage.fromJson(
      String chatId, Map<String, Object?> json) {
    final sender = _map(json['sender']);
    return BackendChatMessage(
      id: _string(json['id'] ?? json['messageId'] ?? json['clientMessageId']),
      chatId: chatId,
      text: _string(json['text']),
      clientMessageId: _stringOrNull(json['clientMessageId']),
      senderId: _stringOrNull(json['senderId'] ?? sender['id']),
      senderName: _stringOrNull(
        json['senderName'] ?? sender['name'] ?? sender['displayName'],
      ),
      senderAvatarUrl: _urlOrNull(
        json['senderAvatarUrl'] ??
            json['senderAvatar'] ??
            sender['avatarUrl'] ??
            sender['photoUrl'],
      ),
      createdAt: _date(json['createdAt']),
      pending: json['pending'] as bool? ?? false,
      raw: json,
    );
  }
}

class ProfileSocialData {
  const ProfileSocialData({
    this.followers = 0,
    this.likes = 0,
    this.superLikes = 0,
    this.iFollow = false,
    this.iLike = false,
    this.iSuper = false,
    this.followNotifications = false,
    this.raw = const {},
  });

  final int followers;
  final int likes;
  final int superLikes;
  final bool iFollow;
  final bool iLike;
  final bool iSuper;
  final bool followNotifications;
  final Map<String, Object?> raw;

  factory ProfileSocialData.fromJson(Map<String, Object?> json) {
    return ProfileSocialData(
      followers: _int(json['followers']),
      likes: _int(json['likes']),
      superLikes: _int(json['superLikes']),
      iFollow: _bool(json['iFollow']),
      iLike: _bool(json['iLike']),
      iSuper: _bool(json['iSuper']),
      followNotifications: _bool(json['followNotifications']),
      raw: json,
    );
  }
}

class HostDashboardData {
  const HostDashboardData({
    required this.stats,
    this.pendingRequestsCount = 0,
    this.requests = const [],
    this.events = const [],
    this.nextRequestsCursor,
    this.nextEventsCursor,
    this.raw = const {},
  });

  final HostDashboardStats stats;
  final int pendingRequestsCount;
  final List<HostJoinRequestData> requests;
  final List<BackendCardItem> events;
  final String? nextRequestsCursor;
  final String? nextEventsCursor;
  final Map<String, Object?> raw;

  factory HostDashboardData.fromJson(Map<String, Object?> json) {
    return HostDashboardData(
      stats: HostDashboardStats.fromJson(_map(json['stats'])),
      pendingRequestsCount: _int(json['pendingRequestsCount']),
      requests: _list(json['requests'])
          .map(HostJoinRequestData.fromJson)
          .toList(growable: false),
      events: _list(json['events'])
          .map(BackendCardItem.fromJson)
          .toList(growable: false),
      nextRequestsCursor: _stringOrNull(json['nextRequestsCursor']),
      nextEventsCursor: _stringOrNull(json['nextEventsCursor']),
      raw: json,
    );
  }
}

class HostDashboardStats {
  const HostDashboardStats({
    this.meetupsCount = 0,
    this.rating = 0,
    this.guestsCount = 0,
    this.fillRate = 0,
  });

  final int meetupsCount;
  final double rating;
  final int guestsCount;
  final int fillRate;

  factory HostDashboardStats.fromJson(Map<String, Object?> json) {
    return HostDashboardStats(
      meetupsCount: _int(json['meetupsCount']),
      rating: _double(json['rating']) ?? 0,
      guestsCount: _int(json['guestsCount']),
      fillRate: _int(json['fillRate']),
    );
  }
}

class HostJoinRequestData {
  const HostJoinRequestData({
    required this.id,
    required this.eventId,
    required this.eventTitle,
    required this.userId,
    required this.userName,
    this.avatarUrl,
    this.note,
    this.status = 'pending',
    this.compatibilityScore = 0,
    this.verified = false,
    this.frendlyPlus = false,
    this.raw = const {},
  });

  final String id;
  final String eventId;
  final String eventTitle;
  final String userId;
  final String userName;
  final String? avatarUrl;
  final String? note;
  final String status;
  final int compatibilityScore;
  final bool verified;
  final bool frendlyPlus;
  final Map<String, Object?> raw;

  factory HostJoinRequestData.fromJson(Map<String, Object?> json) {
    return HostJoinRequestData(
      id: _string(json['id']),
      eventId: _string(json['eventId']),
      eventTitle: _string(json['eventTitle']),
      userId: _string(json['userId']),
      userName: _string(json['userName']),
      avatarUrl: _urlOrNull(json['avatarUrl']),
      note: _stringOrNull(json['note']),
      status: _string(json['status'] ?? 'pending'),
      compatibilityScore: _int(json['compatibilityScore']),
      verified: _bool(json['verified']),
      frendlyPlus: _bool(json['frendlyPlus']),
      raw: json,
    );
  }
}

class TokenWalletData {
  const TokenWalletData({
    required this.balance,
    this.history = const [],
    this.raw = const {},
  });

  final int balance;
  final List<BackendCardItem> history;
  final Map<String, Object?> raw;

  factory TokenWalletData.fromJson(Map<String, Object?> json) {
    return TokenWalletData(
      balance: _int(json['balance'] ?? json['tokens'] ?? json['amount']),
      history: _list(json['history'])
          .map((item) => BackendCardItem.fromJson(item))
          .toList(growable: false),
      raw: json,
    );
  }
}

class PaymentsCatalog {
  const PaymentsCatalog({
    required this.tbankEnabled,
    this.provider,
    this.subscriptions = const [],
    this.tokenPacks = const [],
    this.promoOptions = const [],
    this.raw = const {},
  });

  final bool tbankEnabled;
  final String? provider;
  final List<SubscriptionPlan> subscriptions;
  final List<TokenPackProduct> tokenPacks;
  final List<BackendCardItem> promoOptions;
  final Map<String, Object?> raw;

  factory PaymentsCatalog.fromJson(Map<String, Object?> json) {
    return PaymentsCatalog(
      tbankEnabled: json['tbankEnabled'] as bool? ?? false,
      provider: _stringOrNull(json['provider']),
      subscriptions: _list(json['subscriptions'])
          .map(SubscriptionPlan.fromJson)
          .toList(growable: false),
      tokenPacks: _list(json['tokenPacks'])
          .map(TokenPackProduct.fromJson)
          .toList(growable: false),
      promoOptions: _list(json['promoOptions'])
          .map(BackendCardItem.fromJson)
          .toList(growable: false),
      raw: json,
    );
  }
}

class SubscriptionPlan {
  const SubscriptionPlan({
    required this.id,
    required this.label,
    required this.tokenCost,
    this.priceRub = 0,
    this.priceMonthlyRub = 0,
    this.tokenMonthlyCost = 0,
    this.trialDays = 0,
    this.badge,
    this.raw = const {},
  });

  final String id;
  final String label;
  final int tokenCost;
  final int priceRub;
  final int priceMonthlyRub;
  final int tokenMonthlyCost;
  final int trialDays;
  final String? badge;
  final Map<String, Object?> raw;

  factory SubscriptionPlan.fromJson(Map<String, Object?> json) {
    return SubscriptionPlan(
      id: _string(json['id']),
      label: _string(json['label']),
      tokenCost: _int(json['tokenCost']),
      priceRub: _int(json['priceRub']),
      priceMonthlyRub: _int(json['priceMonthlyRub']),
      tokenMonthlyCost: _int(json['tokenMonthlyCost']),
      trialDays: _int(json['trialDays']),
      badge: _stringOrNull(json['badge']),
      raw: json,
    );
  }
}

class TokenPackProduct {
  const TokenPackProduct({
    required this.id,
    required this.label,
    required this.tokens,
    required this.priceRub,
    this.bonus = 0,
    this.best = false,
    this.raw = const {},
  });

  final String id;
  final String label;
  final int tokens;
  final int priceRub;
  final int bonus;
  final bool best;
  final Map<String, Object?> raw;

  factory TokenPackProduct.fromJson(Map<String, Object?> json) {
    return TokenPackProduct(
      id: _string(json['id']),
      label: _string(json['label']),
      tokens: _int(json['tokens']),
      priceRub: _int(json['priceRub']),
      bonus: _int(json['bonus']),
      best: json['best'] as bool? ?? false,
      raw: json,
    );
  }
}

class PaymentOrderData {
  const PaymentOrderData({
    required this.orderId,
    required this.status,
    required this.productKind,
    required this.productId,
    this.paymentId,
    this.paymentUrl,
    this.raw = const {},
  });

  final String orderId;
  final String status;
  final String productKind;
  final String productId;
  final String? paymentId;
  final String? paymentUrl;
  final Map<String, Object?> raw;

  factory PaymentOrderData.fromJson(Map<String, Object?> json) {
    return PaymentOrderData(
      orderId: _string(json['orderId']),
      status: _string(json['status']),
      productKind: _string(json['productKind']),
      productId: _string(json['productId']),
      paymentId: _stringOrNull(json['paymentId']),
      paymentUrl: _stringOrNull(json['paymentUrl']),
      raw: json,
    );
  }
}

class SubscriptionStateData {
  const SubscriptionStateData({
    required this.status,
    this.plan,
    this.startedAt,
    this.renewsAt,
    this.trialEndsAt,
    this.raw = const {},
  });

  final String status;
  final String? plan;
  final DateTime? startedAt;
  final DateTime? renewsAt;
  final DateTime? trialEndsAt;
  final Map<String, Object?> raw;

  factory SubscriptionStateData.fromJson(Map<String, Object?> json) {
    return SubscriptionStateData(
      status: _string(json['status']),
      plan: _stringOrNull(json['plan']),
      startedAt: _date(json['startedAt']),
      renewsAt: _date(json['renewsAt']),
      trialEndsAt: _date(json['trialEndsAt']),
      raw: json,
    );
  }
}

class VerificationStateData {
  const VerificationStateData({
    required this.status,
    required this.selfieDone,
    required this.documentDone,
    this.reviewedAt,
    this.raw = const {},
  });

  final String status;
  final bool selfieDone;
  final bool documentDone;
  final DateTime? reviewedAt;
  final Map<String, Object?> raw;

  factory VerificationStateData.fromJson(Map<String, Object?> json) {
    return VerificationStateData(
      status: _string(json['status']),
      selfieDone: json['selfieDone'] as bool? ?? false,
      documentDone: json['documentDone'] as bool? ?? false,
      reviewedAt: _date(json['reviewedAt']),
      raw: json,
    );
  }
}

class FrendlySeasonData {
  const FrendlySeasonData({
    required this.seasonKey,
    required this.seasonLabel,
    required this.checkedInCount,
    this.calendarDays = const [],
    this.rewards = const [],
    this.stats = const {},
    this.raw = const {},
  });

  final String seasonKey;
  final String seasonLabel;
  final int checkedInCount;
  final List<int> calendarDays;
  final List<FrendlySeasonRewardData> rewards;
  final Map<String, Object?> stats;
  final Map<String, Object?> raw;

  factory FrendlySeasonData.fromJson(Map<String, Object?> json) {
    final rawDays = json['calendarDays'];
    return FrendlySeasonData(
      seasonKey: _string(json['seasonKey']),
      seasonLabel: _string(json['seasonLabel']),
      checkedInCount: _int(json['checkedInCount']),
      calendarDays: rawDays is List
          ? rawDays.map(_int).where((day) => day > 0).toList(growable: false)
          : const [],
      rewards: _list(json['rewards'])
          .map(FrendlySeasonRewardData.fromJson)
          .toList(growable: false),
      stats: _map(json['stats']),
      raw: json,
    );
  }
}

class FrendlySeasonRewardData {
  const FrendlySeasonRewardData({
    required this.key,
    required this.threshold,
    required this.title,
    required this.description,
    required this.rewardKind,
    required this.rewardAmount,
    required this.unlocked,
    required this.claimed,
    this.statusTitle,
    this.claimedAt,
    this.raw = const {},
  });

  final String key;
  final int threshold;
  final String title;
  final String description;
  final String rewardKind;
  final int rewardAmount;
  final bool unlocked;
  final bool claimed;
  final String? statusTitle;
  final DateTime? claimedAt;
  final Map<String, Object?> raw;

  factory FrendlySeasonRewardData.fromJson(Map<String, Object?> json) {
    return FrendlySeasonRewardData(
      key: _string(json['key']),
      threshold: _int(json['threshold']),
      title: _string(json['title']),
      description: _string(json['description']),
      rewardKind: _string(json['rewardKind']),
      rewardAmount: _int(json['rewardAmount']),
      unlocked: json['unlocked'] as bool? ?? false,
      claimed: json['claimed'] as bool? ?? false,
      statusTitle: _stringOrNull(json['statusTitle']),
      claimedAt: _date(json['claimedAt']),
      raw: json,
    );
  }
}

class EveningAiDraftData {
  const EveningAiDraftData({
    required this.draftId,
    required this.route,
    this.acceptedStepIndexes = const [],
    this.currentStepIndex,
    this.canConfirm = false,
    this.expiresAt,
    this.warnings = const [],
    this.raw = const {},
  });

  final String draftId;
  final EveningAiRouteData route;
  final List<int> acceptedStepIndexes;
  final int? currentStepIndex;
  final bool canConfirm;
  final DateTime? expiresAt;
  final List<String> warnings;
  final Map<String, Object?> raw;

  factory EveningAiDraftData.fromJson(Map<String, Object?> json) {
    final accepted = json['acceptedStepIndexes'];
    final warnings = json['warnings'];
    return EveningAiDraftData(
      draftId: _string(json['draftId'] ?? json['id']),
      route: EveningAiRouteData.fromJson(_map(json['route'])),
      acceptedStepIndexes: accepted is List
          ? accepted.map(_int).toList(growable: false)
          : const [],
      currentStepIndex: json['currentStepIndex'] == null
          ? null
          : _int(json['currentStepIndex']),
      canConfirm: json['canConfirm'] as bool? ?? false,
      expiresAt: _date(json['expiresAt']),
      warnings: warnings is List
          ? warnings.map((item) => item.toString()).toList(growable: false)
          : const [],
      raw: json,
    );
  }
}

class EveningRouteSessionData {
  const EveningRouteSessionData({
    required this.sessionId,
    required this.chatId,
    this.routeId,
    this.routeTemplateId,
    this.phase,
    this.startsAt,
    this.joinedCount = 0,
    this.maxGuests = 0,
    this.raw = const {},
  });

  final String sessionId;
  final String chatId;
  final String? routeId;
  final String? routeTemplateId;
  final String? phase;
  final DateTime? startsAt;
  final int joinedCount;
  final int maxGuests;
  final Map<String, Object?> raw;

  factory EveningRouteSessionData.fromJson(Map<String, Object?> json) {
    return EveningRouteSessionData(
      sessionId: _string(json['sessionId'] ?? json['id']),
      chatId: _string(json['chatId']),
      routeId: _stringOrNull(json['routeId']),
      routeTemplateId: _stringOrNull(json['routeTemplateId']),
      phase: _stringOrNull(json['phase']),
      startsAt: _date(json['startsAt']),
      joinedCount: _int(json['joinedCount']),
      maxGuests: _int(json['maxGuests'] ?? json['capacity']),
      raw: json,
    );
  }
}

class PartnerOfferCodeData {
  const PartnerOfferCodeData({
    required this.id,
    required this.codeUrl,
    required this.status,
    required this.offerTitle,
    required this.venueName,
    required this.partnerName,
    this.expiresAt,
    this.activatedAt,
    this.raw = const {},
  });

  final String id;
  final String codeUrl;
  final String status;
  final String offerTitle;
  final String venueName;
  final String partnerName;
  final DateTime? expiresAt;
  final DateTime? activatedAt;
  final Map<String, Object?> raw;

  factory PartnerOfferCodeData.fromJson(Map<String, Object?> json) {
    return PartnerOfferCodeData(
      id: _string(json['id']),
      codeUrl: _string(json['codeUrl']),
      status: _string(json['status']),
      offerTitle: _string(json['offerTitle']),
      venueName: _string(json['venueName']),
      partnerName: _string(json['partnerName']),
      expiresAt: _date(json['expiresAt']),
      activatedAt: _date(json['activatedAt']),
      raw: json,
    );
  }
}

class EveningAiRouteData {
  const EveningAiRouteData({
    required this.id,
    required this.title,
    this.blurb,
    this.durationLabel,
    this.area,
    this.budget,
    this.totalPriceFrom = 0,
    this.steps = const [],
    this.raw = const {},
  });

  final String id;
  final String title;
  final String? blurb;
  final String? durationLabel;
  final String? area;
  final String? budget;
  final int totalPriceFrom;
  final List<EveningAiRouteStepData> steps;
  final Map<String, Object?> raw;

  factory EveningAiRouteData.fromJson(Map<String, Object?> json) {
    return EveningAiRouteData(
      id: _string(json['id']),
      title: _string(json['title']),
      blurb: _stringOrNull(json['blurb'] ?? json['description']),
      durationLabel: _stringOrNull(json['durationLabel']),
      area: _stringOrNull(json['area']),
      budget: _stringOrNull(json['budget'] ?? json['budgetLabel']),
      totalPriceFrom: _int(json['totalPriceFrom'] ?? json['priceFrom']),
      steps: _list(json['steps'])
          .map(EveningAiRouteStepData.fromJson)
          .toList(growable: false),
      raw: json,
    );
  }
}

class EveningAiRouteStepData {
  const EveningAiRouteStepData({
    required this.title,
    this.place,
    this.time,
    this.durationLabel,
    this.ticketUrl,
    this.ticketSourceCode,
    this.price = 0,
    this.imageUrl,
    this.raw = const {},
  });

  final String title;
  final String? place;
  final String? time;
  final String? durationLabel;
  final String? ticketUrl;
  final String? ticketSourceCode;
  final int price;
  final String? imageUrl;
  final Map<String, Object?> raw;

  factory EveningAiRouteStepData.fromJson(Map<String, Object?> json) {
    return EveningAiRouteStepData(
      title: _string(json['title'] ?? json['name']),
      place: _stringOrNull(json['place'] ?? json['venueName'] ?? json['area']),
      time: _stringOrNull(json['time'] ?? json['timeLabel']),
      durationLabel: _stringOrNull(json['durationLabel'] ?? json['duration']),
      ticketUrl: _stringOrNull(json['ticketUrl'] ?? json['actionUrl']),
      ticketSourceCode: _stringOrNull(json['ticketSourceCode']),
      price: _int(json['ticketPrice'] ?? json['priceFrom']),
      imageUrl: _urlOrNull(json['imageUrl'] ?? json['coverUrl']),
      raw: json,
    );
  }
}

class DropsHomeData {
  const DropsHomeData({
    this.mainDrop,
    this.drops = const [],
    required this.ticketProgress,
    this.tasks = const [],
    this.history = const [],
    this.pastWinners = const [],
    required this.eligibility,
    this.pendingRewards = const [],
    this.updatedAt,
    this.raw = const {},
  });

  final DropData? mainDrop;
  final List<DropData> drops;
  final DropTicketProgressData ticketProgress;
  final List<DropTaskData> tasks;
  final List<DropHistoryData> history;
  final List<DropWinnerData> pastWinners;
  final DropUserEligibilityData eligibility;
  final List<DropHistoryData> pendingRewards;
  final DateTime? updatedAt;
  final Map<String, Object?> raw;

  factory DropsHomeData.fromJson(Map<String, Object?> json) {
    final mainDropJson = _map(json['mainDrop']);
    return DropsHomeData(
      mainDrop: mainDropJson.isEmpty ? null : DropData.fromJson(mainDropJson),
      drops:
          _list(json['drops']).map(DropData.fromJson).toList(growable: false),
      ticketProgress:
          DropTicketProgressData.fromJson(_map(json['ticketProgress'])),
      tasks: _list(json['tasks'])
          .map(DropTaskData.fromJson)
          .toList(growable: false),
      history: _list(json['history'])
          .map(DropHistoryData.fromJson)
          .toList(growable: false),
      pastWinners: _list(json['pastWinners'])
          .map(DropWinnerData.fromJson)
          .toList(growable: false),
      eligibility: DropUserEligibilityData.fromJson(_map(json['eligibility'])),
      pendingRewards: _list(json['pendingRewards'])
          .map(DropHistoryData.fromJson)
          .toList(growable: false),
      updatedAt: _date(json['updatedAt']),
      raw: json,
    );
  }
}

class DropData {
  const DropData({
    required this.id,
    required this.type,
    required this.status,
    required this.title,
    required this.description,
    this.prizes = const [],
    this.prizeSummary = '',
    this.startsAt,
    this.endsAt,
    this.drawAt,
    this.drawDate = '',
    this.daysLeft = 0,
    this.participantCount = 0,
    this.myTickets = 0,
    this.maxTicketsPerUser,
    this.requiresVerified = false,
    this.requiresFrendlyPlus = false,
    required this.eligibility,
    this.seedHash,
    this.secretSeed,
    this.cancelReason,
    this.raw = const {},
  });

  final String id;
  final String type;
  final String status;
  final String title;
  final String description;
  final List<Map<String, Object?>> prizes;
  final String prizeSummary;
  final DateTime? startsAt;
  final DateTime? endsAt;
  final DateTime? drawAt;
  final String drawDate;
  final int daysLeft;
  final int participantCount;
  final int myTickets;
  final int? maxTicketsPerUser;
  final bool requiresVerified;
  final bool requiresFrendlyPlus;
  final DropEligibilityData eligibility;
  final String? seedHash;
  final String? secretSeed;
  final String? cancelReason;
  final Map<String, Object?> raw;

  factory DropData.fromJson(Map<String, Object?> json) {
    return DropData(
      id: _string(json['id']),
      type: _string(json['type']),
      status: _string(json['status']),
      title: _string(json['title']),
      description: _string(json['description']),
      prizes: _list(json['prizes']),
      prizeSummary: _string(json['prizeSummary']),
      startsAt: _date(json['startsAt']),
      endsAt: _date(json['endsAt']),
      drawAt: _date(json['drawAt']),
      drawDate: _string(json['drawDate']),
      daysLeft: _int(json['daysLeft']),
      participantCount: _int(json['participantCount']),
      myTickets: _int(json['myTickets']),
      maxTicketsPerUser: _nullableInt(json['maxTicketsPerUser']),
      requiresVerified: _bool(json['requiresVerified']),
      requiresFrendlyPlus: _bool(json['requiresFrendlyPlus']),
      eligibility: DropEligibilityData.fromJson(_map(json['eligibility'])),
      seedHash: _stringOrNull(json['seedHash']),
      secretSeed: _stringOrNull(json['secretSeed']),
      cancelReason: _stringOrNull(json['cancelReason']),
      raw: json,
    );
  }
}

class DropEligibilityData {
  const DropEligibilityData({
    this.canParticipate = false,
    this.missing = const [],
  });

  final bool canParticipate;
  final List<String> missing;

  factory DropEligibilityData.fromJson(Map<String, Object?> json) {
    return DropEligibilityData(
      canParticipate: _bool(json['canParticipate']),
      missing: _stringList(json['missing']),
    );
  }
}

class DropUserEligibilityData {
  const DropUserEligibilityData({
    this.canParticipate = false,
    this.verified = false,
    this.blockedReason,
  });

  final bool canParticipate;
  final bool verified;
  final String? blockedReason;

  factory DropUserEligibilityData.fromJson(Map<String, Object?> json) {
    return DropUserEligibilityData(
      canParticipate: _bool(json['canParticipate']),
      verified: _bool(json['verified']),
      blockedReason: _stringOrNull(json['blockedReason']),
    );
  }
}

class DropTicketProgressData {
  const DropTicketProgressData({
    this.monthKey = '',
    this.earned = 0,
    this.reserved = 0,
    this.availableTickets = 0,
    this.max = 30,
    this.nextResetAt,
  });

  final String monthKey;
  final int earned;
  final int reserved;
  final int availableTickets;
  final int max;
  final DateTime? nextResetAt;

  factory DropTicketProgressData.fromJson(Map<String, Object?> json) {
    return DropTicketProgressData(
      monthKey: _string(json['monthKey']),
      earned: _int(json['earned']),
      reserved: _int(json['reserved']),
      availableTickets: _int(json['availableTickets']),
      max: _int(json['max']) == 0 ? 30 : _int(json['max']),
      nextResetAt: _date(json['nextResetAt']),
    );
  }
}

class DropTaskData {
  const DropTaskData({
    required this.id,
    required this.source,
    required this.title,
    required this.description,
    this.rewardTickets = 0,
    this.monthlyLimit,
    this.progress = 0,
    this.status = 'locked',
    required this.cta,
    this.lockReason,
    this.raw = const {},
  });

  final String id;
  final String source;
  final String title;
  final String description;
  final int rewardTickets;
  final int? monthlyLimit;
  final int progress;
  final String status;
  final DropTaskCtaData cta;
  final String? lockReason;
  final Map<String, Object?> raw;

  factory DropTaskData.fromJson(Map<String, Object?> json) {
    return DropTaskData(
      id: _string(json['id']),
      source: _string(json['source']),
      title: _string(json['title']),
      description: _string(json['description']),
      rewardTickets: _int(json['rewardTickets']),
      monthlyLimit: _nullableInt(json['monthlyLimit']),
      progress: _int(json['progress']),
      status: _string(json['status']),
      cta: DropTaskCtaData.fromJson(_map(json['cta'])),
      lockReason: _stringOrNull(json['lockReason']),
      raw: json,
    );
  }
}

class DropTaskCtaData {
  const DropTaskCtaData({
    this.label = '',
    this.route,
    this.action,
  });

  final String label;
  final String? route;
  final String? action;

  factory DropTaskCtaData.fromJson(Map<String, Object?> json) {
    return DropTaskCtaData(
      label: _string(json['label']),
      route: _stringOrNull(json['route']),
      action: _stringOrNull(json['action']),
    );
  }
}

class DropHistoryData {
  const DropHistoryData({
    required this.id,
    required this.source,
    required this.status,
    required this.title,
    this.ticketCount = 0,
    this.cancellationReason,
    this.relatedType,
    this.relatedId,
    this.createdAt,
  });

  final String id;
  final String source;
  final String status;
  final String title;
  final int ticketCount;
  final String? cancellationReason;
  final String? relatedType;
  final String? relatedId;
  final DateTime? createdAt;

  factory DropHistoryData.fromJson(Map<String, Object?> json) {
    return DropHistoryData(
      id: _string(json['id']),
      source: _string(json['source']),
      status: _string(json['status']),
      title: _string(json['title']),
      ticketCount: _int(json['ticketCount']),
      cancellationReason: _stringOrNull(json['cancellationReason']),
      relatedType: _stringOrNull(json['relatedType']),
      relatedId: _stringOrNull(json['relatedId']),
      createdAt: _date(json['createdAt']),
    );
  }
}

class DropWinnerData {
  const DropWinnerData({
    required this.id,
    required this.name,
    this.city = '',
    this.prize = '',
    this.ticket = '',
    this.position = 0,
  });

  final String id;
  final String name;
  final String city;
  final String prize;
  final String ticket;
  final int position;

  factory DropWinnerData.fromJson(Map<String, Object?> json) {
    return DropWinnerData(
      id: _string(json['id']),
      name: _string(json['name']),
      city: _string(json['city']),
      prize: _string(json['prize']),
      ticket: _string(json['ticket']),
      position: _int(json['position']),
    );
  }
}

class DropApplyResult {
  const DropApplyResult({
    required this.dropId,
    this.appliedCount = 0,
    this.userTicketsInDrop = 0,
    this.availableTickets = 0,
    this.raw = const {},
  });

  final String dropId;
  final int appliedCount;
  final int userTicketsInDrop;
  final int availableTickets;
  final Map<String, Object?> raw;

  factory DropApplyResult.fromJson(Map<String, Object?> json) {
    return DropApplyResult(
      dropId: _string(json['dropId']),
      appliedCount: _int(json['appliedCount']),
      userTicketsInDrop: _int(json['userTicketsInDrop']),
      availableTickets: _int(json['availableTickets']),
      raw: json,
    );
  }
}

class DropReferralLinkData {
  const DropReferralLinkData({
    required this.code,
    required this.url,
    this.raw = const {},
  });

  final String code;
  final String url;
  final Map<String, Object?> raw;

  factory DropReferralLinkData.fromJson(Map<String, Object?> json) {
    return DropReferralLinkData(
      code: _string(json['code']),
      url: _string(json['url']),
      raw: json,
    );
  }
}

class AfterDarkAccessData {
  const AfterDarkAccessData({
    required this.unlocked,
    this.subscriptionStatus,
    this.plan,
    this.ageConfirmed = false,
    this.codeAccepted = false,
    this.kinkVerified = false,
    this.previewCount = 0,
    this.raw = const {},
  });

  final bool unlocked;
  final String? subscriptionStatus;
  final String? plan;
  final bool ageConfirmed;
  final bool codeAccepted;
  final bool kinkVerified;
  final int previewCount;
  final Map<String, Object?> raw;

  factory AfterDarkAccessData.fromJson(Map<String, Object?> json) {
    return AfterDarkAccessData(
      unlocked: json['unlocked'] as bool? ?? false,
      subscriptionStatus: _stringOrNull(json['subscriptionStatus']),
      plan: _stringOrNull(json['plan']),
      ageConfirmed: json['ageConfirmed'] as bool? ?? false,
      codeAccepted: json['codeAccepted'] as bool? ?? false,
      kinkVerified: json['kinkVerified'] as bool? ?? false,
      previewCount: _int(json['previewCount']),
      raw: json,
    );
  }
}

Map<String, Object?> _map(Object? value) {
  if (value is Map) {
    return value.map((key, value) => MapEntry('$key', value));
  }
  return const {};
}

List<Map<String, Object?>> _list(Object? value) {
  final source = value is Map ? value['items'] : value;
  if (source is! List) {
    return const [];
  }
  return source.whereType<Map>().map(_map).toList(growable: false);
}

String _string(Object? value) {
  return value?.toString() ?? '';
}

String? _stringOrNull(Object? value) {
  final result = value?.toString();
  if (result == null || result.isEmpty) {
    return null;
  }
  return result;
}

String? _urlOrNull(Object? value) {
  return resolveBackendUrl(_stringOrNull(value));
}

Object? _cardImageVariantUrl(Object? raw) {
  final variants = _map(raw);
  final card = _map(variants['card']);
  return card['url'] ?? card['downloadUrl'];
}

Object? _profilePhotoUrl(Object? raw) {
  final photo = _map(raw);
  final media = _map(photo['media']);
  return photo['url'] ??
      photo['downloadUrl'] ??
      media['url'] ??
      media['downloadUrl'];
}

int _int(Object? value) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

int? _nullableInt(Object? value) {
  if (value == null || value == '') {
    return null;
  }
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  return int.tryParse(value.toString());
}

double? _double(Object? value) {
  if (value is num) {
    return value.toDouble();
  }
  return double.tryParse(value?.toString() ?? '');
}

bool _bool(Object? value, {bool fallback = false}) {
  if (value is bool) {
    return value;
  }
  if (value is num) {
    return value != 0;
  }
  final text = value?.toString().toLowerCase();
  if (text == 'true' || text == '1') {
    return true;
  }
  if (text == 'false' || text == '0') {
    return false;
  }
  return fallback;
}

DateTime? _date(Object? value) {
  if (value is DateTime) {
    return value;
  }
  return DateTime.tryParse(value?.toString() ?? '');
}

List<String> _stringList(Object? value) {
  if (value is! List) {
    return const [];
  }
  return value
      .map((item) {
        if (item is Map) {
          return item['name'] ??
              item['title'] ??
              item['value'] ??
              item['label'];
        }
        return item;
      })
      .map((item) => item?.toString().trim() ?? '')
      .where((item) => item.isNotEmpty)
      .toList(growable: false);
}

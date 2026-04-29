class SafetyHubData {
  const SafetyHubData({
    required this.trustScore,
    required this.settings,
    required this.trustedContacts,
    required this.blockedUsersCount,
    required this.reportsCount,
  });

  final int trustScore;
  final Map<String, dynamic>? settings;
  final List<TrustedContactData> trustedContacts;
  final int blockedUsersCount;
  final int reportsCount;

  factory SafetyHubData.fromJson(Map<String, dynamic> json) {
    return SafetyHubData(
      trustScore: (json['trustScore'] as num?)?.toInt() ?? 0,
      settings: (json['settings'] as Map?)?.cast<String, dynamic>(),
      trustedContacts: ((json['trustedContacts'] as List?) ?? const [])
          .whereType<Map>()
          .map((item) =>
              TrustedContactData.fromJson(Map<String, dynamic>.from(item)))
          .toList(growable: false),
      blockedUsersCount: (json['blockedUsersCount'] as num?)?.toInt() ?? 0,
      reportsCount: (json['reportsCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class TrustedContactData {
  const TrustedContactData({
    required this.id,
    required this.name,
    this.channel = 'phone',
    String? value,
    required this.phoneNumber,
    required this.mode,
  }) : value = value ?? phoneNumber;

  final String id;
  final String name;
  final String channel;
  final String value;
  final String phoneNumber;
  final String mode;

  factory TrustedContactData.fromJson(Map<String, dynamic> json) {
    final value =
        json['value'] as String? ?? json['phoneNumber'] as String? ?? '';
    return TrustedContactData(
      id: json['id'] as String,
      name: json['name'] as String,
      channel: json['channel'] as String? ?? 'phone',
      value: value,
      phoneNumber: json['phoneNumber'] as String? ?? value,
      mode: json['mode'] as String? ?? 'all_plans',
    );
  }
}

class SafetySosData {
  const SafetySosData({
    required this.id,
    required this.eventId,
    required this.notifiedContactsCount,
    required this.status,
    required this.createdAt,
  });

  final String id;
  final String? eventId;
  final int notifiedContactsCount;
  final String status;
  final String createdAt;

  factory SafetySosData.fromJson(Map<String, dynamic> json) {
    return SafetySosData(
      id: json['id'] as String,
      eventId: json['eventId'] as String?,
      notifiedContactsCount:
          (json['notifiedContactsCount'] as num?)?.toInt() ?? 0,
      status: json['status'] as String? ?? 'queued',
      createdAt: json['createdAt'] as String? ?? '',
    );
  }
}

class UserReportData {
  const UserReportData({
    required this.id,
    required this.reason,
    required this.details,
    required this.status,
    required this.blockRequested,
  });

  final String id;
  final String reason;
  final String? details;
  final String status;
  final bool blockRequested;

  factory UserReportData.fromJson(Map<String, dynamic> json) {
    return UserReportData(
      id: json['id'] as String,
      reason: json['reason'] as String,
      details: json['details'] as String?,
      status: json['status'] as String? ?? 'open',
      blockRequested: (json['blockRequested'] as bool?) ?? false,
    );
  }
}

class BlockedUserData {
  const BlockedUserData({
    required this.id,
    required this.blockedUserId,
    required this.displayName,
  });

  final String id;
  final String blockedUserId;
  final String displayName;

  factory BlockedUserData.fromJson(Map<String, dynamic> json) {
    final blockedUser = (json['blockedUser'] as Map?)?.cast<String, dynamic>();
    return BlockedUserData(
      id: json['id'] as String,
      blockedUserId: json['blockedUserId'] as String,
      displayName: blockedUser?['displayName'] as String? ?? 'Пользователь',
    );
  }
}

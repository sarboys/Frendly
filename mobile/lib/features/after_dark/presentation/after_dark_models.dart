class AfterDarkAccessData {
  const AfterDarkAccessData({
    required this.unlocked,
    required this.subscriptionStatus,
    required this.plan,
    required this.ageConfirmed,
    required this.codeAccepted,
    required this.kinkVerified,
    required this.previewCount,
  });

  final bool unlocked;
  final String subscriptionStatus;
  final String? plan;
  final bool ageConfirmed;
  final bool codeAccepted;
  final bool kinkVerified;
  final int previewCount;

  const AfterDarkAccessData.fallback()
      : unlocked = false,
        subscriptionStatus = 'inactive',
        plan = null,
        ageConfirmed = false,
        codeAccepted = false,
        kinkVerified = false,
        previewCount = 0;

  factory AfterDarkAccessData.fromJson(Map<String, dynamic> json) {
    return AfterDarkAccessData(
      unlocked: (json['unlocked'] as bool?) ?? false,
      subscriptionStatus: json['subscriptionStatus'] as String? ?? 'inactive',
      plan: json['plan'] as String?,
      ageConfirmed: (json['ageConfirmed'] as bool?) ?? false,
      codeAccepted: (json['codeAccepted'] as bool?) ?? false,
      kinkVerified: (json['kinkVerified'] as bool?) ?? false,
      previewCount: (json['previewCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class AfterDarkEvent {
  const AfterDarkEvent({
    required this.id,
    required this.title,
    required this.emoji,
    required this.category,
    required this.time,
    required this.district,
    required this.distanceKm,
    required this.going,
    required this.capacity,
    required this.ratio,
    required this.ageRange,
    required this.dressCode,
    required this.vibe,
    required this.hostVerified,
    required this.consentRequired,
    required this.glow,
    required this.priceFrom,
    required this.joined,
    required this.joinRequestStatus,
  });

  final String id;
  final String title;
  final String emoji;
  final String category;
  final String time;
  final String district;
  final double distanceKm;
  final int going;
  final int capacity;
  final String ratio;
  final String ageRange;
  final String dressCode;
  final String vibe;
  final bool hostVerified;
  final bool consentRequired;
  final String glow;
  final int? priceFrom;
  final bool joined;
  final String? joinRequestStatus;

  factory AfterDarkEvent.fromJson(Map<String, dynamic> json) {
    return AfterDarkEvent(
      id: json['id'] as String,
      title: json['title'] as String,
      emoji: json['emoji'] as String,
      category: json['category'] as String? ?? 'nightlife',
      time: json['time'] as String,
      district: json['district'] as String? ?? '—',
      distanceKm: (json['distanceKm'] as num?)?.toDouble() ?? 0,
      going: (json['going'] as num?)?.toInt() ?? 0,
      capacity: (json['capacity'] as num?)?.toInt() ?? 0,
      ratio: json['ratio'] as String? ?? 'Mixed',
      ageRange: json['ageRange'] as String? ?? '18+',
      dressCode: json['dressCode'] as String? ?? '',
      vibe: json['vibe'] as String? ?? '',
      hostVerified: (json['hostVerified'] as bool?) ?? false,
      consentRequired: (json['consentRequired'] as bool?) ?? false,
      glow: json['glow'] as String? ?? 'magenta',
      priceFrom: (json['priceFrom'] as num?)?.toInt(),
      joined: (json['joined'] as bool?) ?? false,
      joinRequestStatus: json['joinRequestStatus'] as String?,
    );
  }
}

class AfterDarkEventDetail extends AfterDarkEvent {
  const AfterDarkEventDetail({
    required super.id,
    required super.title,
    required super.emoji,
    required super.category,
    required super.time,
    required super.district,
    required super.distanceKm,
    required super.going,
    required super.capacity,
    required super.ratio,
    required super.ageRange,
    required super.dressCode,
    required super.vibe,
    required super.hostVerified,
    required super.consentRequired,
    required super.glow,
    required this.description,
    required this.hostNote,
    required this.rules,
    required this.chatId,
    super.priceFrom,
    required super.joined,
    required super.joinRequestStatus,
  });

  final String description;
  final String? hostNote;
  final List<String> rules;
  final String? chatId;

  bool get isPending => joinRequestStatus == 'pending';
  bool get isApproved => joinRequestStatus == 'approved';

  factory AfterDarkEventDetail.fromJson(Map<String, dynamic> json) {
    return AfterDarkEventDetail(
      id: json['id'] as String,
      title: json['title'] as String,
      emoji: json['emoji'] as String,
      category: json['category'] as String? ?? 'nightlife',
      time: json['time'] as String,
      district: json['district'] as String? ?? '—',
      distanceKm: (json['distanceKm'] as num?)?.toDouble() ?? 0,
      going: (json['going'] as num?)?.toInt() ?? 0,
      capacity: (json['capacity'] as num?)?.toInt() ?? 0,
      ratio: json['ratio'] as String? ?? 'Mixed',
      ageRange: json['ageRange'] as String? ?? '18+',
      dressCode: json['dressCode'] as String? ?? '',
      vibe: json['vibe'] as String? ?? '',
      hostVerified: (json['hostVerified'] as bool?) ?? false,
      consentRequired: (json['consentRequired'] as bool?) ?? false,
      glow: json['glow'] as String? ?? 'magenta',
      description: json['description'] as String? ?? '',
      hostNote: json['hostNote'] as String?,
      rules: ((json['rules'] as List?) ?? const [])
          .whereType<String>()
          .toList(growable: false),
      chatId: json['chatId'] as String?,
      priceFrom: (json['priceFrom'] as num?)?.toInt(),
      joined: (json['joined'] as bool?) ?? false,
      joinRequestStatus: json['joinRequestStatus'] as String?,
    );
  }
}

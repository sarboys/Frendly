import 'package:big_break_mobile/shared/models/meetup_chat.dart';

enum EveningSessionPhase { scheduled, live, done, canceled }

class EveningSessionSummary {
  const EveningSessionSummary({
    required this.id,
    required this.routeId,
    required this.chatId,
    required this.phase,
    required this.chatPhase,
    required this.privacy,
    required this.title,
    required this.vibe,
    required this.emoji,
    this.routeTemplateId,
    this.isCurated = false,
    this.badgeLabel,
    this.area,
    this.hostUserId,
    this.hostName,
    this.joinedCount,
    this.maxGuests,
    this.currentStep,
    this.totalSteps,
    this.currentPlace,
    this.lat,
    this.lng,
    this.endTime,
    this.startsAt,
    this.startedAt,
    this.endedAt,
    this.inviteToken,
    this.isJoined = false,
    this.isRequested = false,
  });

  final String id;
  final String routeId;
  final String chatId;
  final EveningSessionPhase phase;
  final MeetupPhase chatPhase;
  final EveningPrivacy privacy;
  final String title;
  final String vibe;
  final String emoji;
  final String? routeTemplateId;
  final bool isCurated;
  final String? badgeLabel;
  final String? area;
  final String? hostUserId;
  final String? hostName;
  final int? joinedCount;
  final int? maxGuests;
  final int? currentStep;
  final int? totalSteps;
  final String? currentPlace;
  final double? lat;
  final double? lng;
  final String? endTime;
  final String? startsAt;
  final String? startedAt;
  final String? endedAt;
  final String? inviteToken;
  final bool isJoined;
  final bool isRequested;

  bool get isLive => phase == EveningSessionPhase.live;

  factory EveningSessionSummary.fromJson(Map<String, dynamic> json) {
    return EveningSessionSummary(
      id: json['sessionId'] as String? ?? json['id'] as String,
      routeId: json['routeId'] as String? ?? '',
      chatId: json['chatId'] as String? ?? '',
      phase: parseEveningSessionPhase(json['phase'] as String?),
      chatPhase: parseMeetupPhase(json['chatPhase'] as String?),
      privacy: parseEveningPrivacy(json['privacy'] as String?),
      title: json['title'] as String? ?? '',
      vibe: json['vibe'] as String? ?? '',
      emoji: json['emoji'] as String? ?? '✨',
      routeTemplateId: json['routeTemplateId'] as String?,
      isCurated: json['isCurated'] as bool? ?? false,
      badgeLabel: json['badgeLabel'] as String?,
      area: json['area'] as String?,
      hostUserId: json['hostUserId'] as String?,
      hostName: json['hostName'] as String?,
      joinedCount: (json['joinedCount'] as num?)?.toInt(),
      maxGuests: (json['maxGuests'] as num?)?.toInt(),
      currentStep: (json['currentStep'] as num?)?.toInt(),
      totalSteps: (json['totalSteps'] as num?)?.toInt(),
      currentPlace: json['currentPlace'] as String?,
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
      endTime: json['endTime'] as String?,
      startsAt: json['startsAt'] as String?,
      startedAt: json['startedAt'] as String?,
      endedAt: json['endedAt'] as String?,
      inviteToken: json['inviteToken'] as String?,
      isJoined: json['isJoined'] as bool? ?? false,
      isRequested: json['isRequested'] as bool? ?? false,
    );
  }
}

class EveningSessionDetail extends EveningSessionSummary {
  const EveningSessionDetail({
    required super.id,
    required super.routeId,
    required super.chatId,
    required super.phase,
    required super.chatPhase,
    required super.privacy,
    required super.title,
    required super.vibe,
    required super.emoji,
    super.routeTemplateId,
    super.isCurated,
    super.badgeLabel,
    super.area,
    super.hostUserId,
    super.hostName,
    super.joinedCount,
    super.maxGuests,
    super.currentStep,
    super.totalSteps,
    super.currentPlace,
    super.lat,
    super.lng,
    super.endTime,
    super.startsAt,
    super.startedAt,
    super.endedAt,
    super.inviteToken,
    super.isJoined,
    super.isRequested,
    required this.participants,
    required this.steps,
    this.pendingRequests = const [],
  });

  final List<EveningSessionParticipant> participants;
  final List<EveningSessionStep> steps;
  final List<EveningSessionJoinRequest> pendingRequests;

  factory EveningSessionDetail.fromJson(Map<String, dynamic> json) {
    final summary = EveningSessionSummary.fromJson(json);
    return EveningSessionDetail(
      id: summary.id,
      routeId: summary.routeId,
      chatId: summary.chatId,
      phase: summary.phase,
      chatPhase: summary.chatPhase,
      privacy: summary.privacy,
      title: summary.title,
      vibe: summary.vibe,
      emoji: summary.emoji,
      routeTemplateId: summary.routeTemplateId,
      isCurated: summary.isCurated,
      badgeLabel: summary.badgeLabel,
      area: summary.area,
      hostUserId: summary.hostUserId,
      hostName: summary.hostName,
      joinedCount: summary.joinedCount,
      maxGuests: summary.maxGuests,
      currentStep: summary.currentStep,
      totalSteps: summary.totalSteps,
      currentPlace: summary.currentPlace,
      lat: summary.lat,
      lng: summary.lng,
      endTime: summary.endTime,
      startsAt: summary.startsAt,
      startedAt: summary.startedAt,
      endedAt: summary.endedAt,
      inviteToken: summary.inviteToken,
      isJoined: summary.isJoined,
      isRequested: summary.isRequested,
      participants: ((json['participants'] as List?) ?? const [])
          .whereType<Map>()
          .map((item) => EveningSessionParticipant.fromJson(
              Map<String, dynamic>.from(item)))
          .toList(growable: false),
      steps: ((json['steps'] as List?) ?? const [])
          .whereType<Map>()
          .map((item) =>
              EveningSessionStep.fromJson(Map<String, dynamic>.from(item)))
          .toList(growable: false),
      pendingRequests: ((json['pendingRequests'] as List?) ?? const [])
          .whereType<Map>()
          .map((item) => EveningSessionJoinRequest.fromJson(
              Map<String, dynamic>.from(item)))
          .toList(growable: false),
    );
  }
}

class EveningSessionJoinRequest {
  const EveningSessionJoinRequest({
    required this.id,
    required this.userId,
    required this.name,
    required this.status,
    this.note,
    this.createdAt,
  });

  final String id;
  final String userId;
  final String name;
  final String status;
  final String? note;
  final String? createdAt;

  factory EveningSessionJoinRequest.fromJson(Map<String, dynamic> json) {
    return EveningSessionJoinRequest(
      id: json['id'] as String? ?? '',
      userId: json['userId'] as String? ?? '',
      name: json['name'] as String? ?? json['userName'] as String? ?? 'Гость',
      status: json['status'] as String? ?? 'requested',
      note: json['note'] as String?,
      createdAt: json['createdAt'] as String?,
    );
  }
}

class EveningSessionParticipant {
  const EveningSessionParticipant({
    required this.userId,
    required this.name,
    required this.role,
    required this.status,
  });

  final String userId;
  final String name;
  final String role;
  final String status;

  factory EveningSessionParticipant.fromJson(Map<String, dynamic> json) {
    return EveningSessionParticipant(
      userId: json['userId'] as String? ?? '',
      name: json['name'] as String? ?? '',
      role: json['role'] as String? ?? 'guest',
      status: json['status'] as String? ?? 'joined',
    );
  }
}

class EveningSessionStep {
  const EveningSessionStep({
    required this.id,
    required this.time,
    this.endTime,
    required this.kind,
    required this.title,
    required this.venue,
    required this.address,
    required this.emoji,
    this.distance,
    this.walkMin,
    this.perk,
    this.perkShort,
    this.ticketPrice,
    this.ticketCommission,
    this.sponsored = false,
    this.premium = false,
    this.partnerId,
    this.venueId,
    this.partnerOfferId,
    this.offerTitle,
    this.offerDescription,
    this.offerTerms,
    this.offerShortLabel,
    this.description,
    this.vibeTag,
    this.lat,
    this.lng,
    this.status,
    this.checkedIn = false,
    this.startedAt,
    this.finishedAt,
    this.skippedAt,
  });

  final String id;
  final String time;
  final String? endTime;
  final String kind;
  final String title;
  final String venue;
  final String address;
  final String emoji;
  final String? distance;
  final int? walkMin;
  final String? perk;
  final String? perkShort;
  final int? ticketPrice;
  final int? ticketCommission;
  final bool sponsored;
  final bool premium;
  final String? partnerId;
  final String? venueId;
  final String? partnerOfferId;
  final String? offerTitle;
  final String? offerDescription;
  final String? offerTerms;
  final String? offerShortLabel;
  final String? description;
  final String? vibeTag;
  final double? lat;
  final double? lng;
  final String? status;
  final bool checkedIn;
  final String? startedAt;
  final String? finishedAt;
  final String? skippedAt;

  factory EveningSessionStep.fromJson(Map<String, dynamic> json) {
    return EveningSessionStep(
      id: json['id'] as String? ?? '',
      time: json['time'] as String? ?? '',
      endTime: json['endTime'] as String?,
      kind: json['kind'] as String? ?? '',
      title: json['title'] as String? ?? '',
      venue: json['venue'] as String? ?? '',
      address: json['address'] as String? ?? '',
      emoji: json['emoji'] as String? ?? '✨',
      distance: json['distance'] as String?,
      walkMin: (json['walkMin'] as num?)?.toInt(),
      perk: json['perk'] as String?,
      perkShort: json['perkShort'] as String?,
      ticketPrice: (json['ticketPrice'] as num?)?.toInt(),
      ticketCommission: (json['ticketCommission'] as num?)?.toInt(),
      sponsored: json['sponsored'] as bool? ?? false,
      premium: json['premium'] as bool? ?? false,
      partnerId: json['partnerId'] as String?,
      venueId: json['venueId'] as String?,
      partnerOfferId: json['partnerOfferId'] as String?,
      offerTitle: json['offerTitle'] as String?,
      offerDescription: json['offerDescription'] as String?,
      offerTerms: json['offerTerms'] as String?,
      offerShortLabel: json['offerShortLabel'] as String?,
      description: json['description'] as String?,
      vibeTag: json['vibeTag'] as String?,
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
      status: json['status'] as String?,
      checkedIn: json['checkedIn'] as bool? ?? false,
      startedAt: json['startedAt'] as String?,
      finishedAt: json['finishedAt'] as String?,
      skippedAt: json['skippedAt'] as String?,
    );
  }
}

class EveningPublishResult {
  const EveningPublishResult({
    required this.sessionId,
    required this.routeId,
    required this.chatId,
    required this.phase,
    required this.privacy,
    required this.joinedCount,
    required this.maxGuests,
    this.inviteToken,
  });

  final String sessionId;
  final String routeId;
  final String chatId;
  final EveningSessionPhase phase;
  final EveningPrivacy privacy;
  final int joinedCount;
  final int maxGuests;
  final String? inviteToken;

  factory EveningPublishResult.fromJson(Map<String, dynamic> json) {
    return EveningPublishResult(
      sessionId: json['sessionId'] as String? ?? '',
      routeId: json['routeId'] as String? ?? '',
      chatId: json['chatId'] as String? ?? '',
      phase: parseEveningSessionPhase(json['phase'] as String?),
      privacy: parseEveningPrivacy(json['privacy'] as String?),
      joinedCount: (json['joinedCount'] as num?)?.toInt() ?? 0,
      maxGuests: (json['maxGuests'] as num?)?.toInt() ?? 0,
      inviteToken: json['inviteToken'] as String?,
    );
  }
}

class EveningJoinResult {
  const EveningJoinResult({
    required this.status,
    this.sessionId,
    this.chatId,
    this.requestId,
  });

  final String status;
  final String? sessionId;
  final String? chatId;
  final String? requestId;

  factory EveningJoinResult.fromJson(Map<String, dynamic> json) {
    return EveningJoinResult(
      status: json['status'] as String? ?? '',
      sessionId: json['sessionId'] as String?,
      chatId: json['chatId'] as String?,
      requestId: json['requestId'] as String?,
    );
  }
}

EveningSessionPhase parseEveningSessionPhase(String? value) {
  switch (value) {
    case 'live':
      return EveningSessionPhase.live;
    case 'done':
      return EveningSessionPhase.done;
    case 'canceled':
      return EveningSessionPhase.canceled;
    case 'scheduled':
    default:
      return EveningSessionPhase.scheduled;
  }
}

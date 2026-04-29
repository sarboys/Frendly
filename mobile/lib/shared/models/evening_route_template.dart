import 'package:big_break_mobile/shared/models/meetup_chat.dart';

class EveningRouteTemplateSummary {
  const EveningRouteTemplateSummary({
    required this.id,
    required this.routeId,
    required this.title,
    required this.blurb,
    required this.city,
    required this.vibe,
    required this.budget,
    required this.durationLabel,
    required this.totalPriceFrom,
    required this.stepsPreview,
    required this.partnerOffersPreview,
    required this.nearestSessions,
    this.area,
    this.badgeLabel,
    this.coverUrl,
  });

  final String id;
  final String routeId;
  final String title;
  final String blurb;
  final String city;
  final String? area;
  final String? badgeLabel;
  final String? coverUrl;
  final String vibe;
  final String budget;
  final String durationLabel;
  final int totalPriceFrom;
  final List<EveningRouteTemplateStepPreview> stepsPreview;
  final List<EveningPartnerOfferPreview> partnerOffersPreview;
  final List<EveningRouteTemplateSession> nearestSessions;

  factory EveningRouteTemplateSummary.fromJson(Map<String, dynamic> json) {
    return EveningRouteTemplateSummary(
      id: json['id'] as String? ?? '',
      routeId: json['routeId'] as String? ?? '',
      title: json['title'] as String? ?? '',
      blurb: json['blurb'] as String? ?? '',
      city: json['city'] as String? ?? '',
      area: json['area'] as String?,
      badgeLabel: json['badgeLabel'] as String?,
      coverUrl: json['coverUrl'] as String?,
      vibe: json['vibe'] as String? ?? '',
      budget: json['budget'] as String? ?? '',
      durationLabel: json['durationLabel'] as String? ?? '',
      totalPriceFrom: (json['totalPriceFrom'] as num?)?.toInt() ?? 0,
      stepsPreview: ((json['stepsPreview'] as List?) ?? const [])
          .whereType<Map>()
          .map((item) => EveningRouteTemplateStepPreview.fromJson(
                Map<String, dynamic>.from(item),
              ))
          .toList(growable: false),
      partnerOffersPreview:
          ((json['partnerOffersPreview'] as List?) ?? const [])
              .whereType<Map>()
              .map((item) => EveningPartnerOfferPreview.fromJson(
                    Map<String, dynamic>.from(item),
                  ))
              .toList(growable: false),
      nearestSessions: ((json['nearestSessions'] as List?) ?? const [])
          .whereType<Map>()
          .map((item) => EveningRouteTemplateSession.fromJson(
                Map<String, dynamic>.from(item),
              ))
          .toList(growable: false),
    );
  }
}

class EveningRouteTemplateDetail extends EveningRouteTemplateSummary {
  const EveningRouteTemplateDetail({
    required super.id,
    required super.routeId,
    required super.title,
    required super.blurb,
    required super.city,
    required super.vibe,
    required super.budget,
    required super.durationLabel,
    required super.totalPriceFrom,
    required super.stepsPreview,
    required super.partnerOffersPreview,
    required super.nearestSessions,
    super.area,
    super.badgeLabel,
    super.coverUrl,
    required this.totalSavings,
    required this.goal,
    required this.mood,
    required this.steps,
    this.format,
    this.recommendedFor,
  });

  final int totalSavings;
  final String goal;
  final String mood;
  final String? format;
  final String? recommendedFor;
  final List<EveningRouteTemplateStep> steps;

  factory EveningRouteTemplateDetail.fromJson(Map<String, dynamic> json) {
    final summary = EveningRouteTemplateSummary.fromJson(json);
    return EveningRouteTemplateDetail(
      id: summary.id,
      routeId: summary.routeId,
      title: summary.title,
      blurb: summary.blurb,
      city: summary.city,
      vibe: summary.vibe,
      budget: summary.budget,
      durationLabel: summary.durationLabel,
      totalPriceFrom: summary.totalPriceFrom,
      stepsPreview: summary.stepsPreview,
      partnerOffersPreview: summary.partnerOffersPreview,
      nearestSessions: summary.nearestSessions,
      area: summary.area,
      badgeLabel: summary.badgeLabel,
      coverUrl: summary.coverUrl,
      totalSavings: (json['totalSavings'] as num?)?.toInt() ?? 0,
      goal: json['goal'] as String? ?? '',
      mood: json['mood'] as String? ?? '',
      format: json['format'] as String?,
      recommendedFor: json['recommendedFor'] as String?,
      steps: ((json['steps'] as List?) ?? const [])
          .whereType<Map>()
          .map((item) => EveningRouteTemplateStep.fromJson(
                Map<String, dynamic>.from(item),
              ))
          .toList(growable: false),
    );
  }
}

class EveningRouteTemplateStepPreview {
  const EveningRouteTemplateStepPreview({
    required this.title,
    required this.venue,
    required this.emoji,
  });

  final String title;
  final String venue;
  final String emoji;

  factory EveningRouteTemplateStepPreview.fromJson(Map<String, dynamic> json) {
    return EveningRouteTemplateStepPreview(
      title: json['title'] as String? ?? '',
      venue: json['venue'] as String? ?? '',
      emoji: json['emoji'] as String? ?? '✨',
    );
  }
}

class EveningPartnerOfferPreview {
  const EveningPartnerOfferPreview({
    required this.partnerId,
    required this.title,
    this.shortLabel,
  });

  final String partnerId;
  final String title;
  final String? shortLabel;

  factory EveningPartnerOfferPreview.fromJson(Map<String, dynamic> json) {
    return EveningPartnerOfferPreview(
      partnerId: json['partnerId'] as String? ?? '',
      title: json['title'] as String? ?? '',
      shortLabel: json['shortLabel'] as String?,
    );
  }
}

class EveningRouteTemplateSession {
  const EveningRouteTemplateSession({
    required this.sessionId,
    required this.startsAt,
    required this.joinedCount,
    required this.capacity,
  });

  final String sessionId;
  final String startsAt;
  final int joinedCount;
  final int capacity;

  factory EveningRouteTemplateSession.fromJson(Map<String, dynamic> json) {
    return EveningRouteTemplateSession(
      sessionId: json['sessionId'] as String? ?? '',
      startsAt: json['startsAt'] as String? ?? '',
      joinedCount: (json['joinedCount'] as num?)?.toInt() ?? 0,
      capacity: (json['capacity'] as num?)?.toInt() ?? 0,
    );
  }
}

class EveningRouteTemplateStep {
  const EveningRouteTemplateStep({
    required this.id,
    required this.time,
    required this.kind,
    required this.title,
    required this.venue,
    required this.address,
    required this.emoji,
    this.endTime,
    this.distance,
    this.walkMin,
    this.perk,
    this.perkShort,
    this.ticketPrice,
    this.ticketCommission,
    this.sponsored = false,
    this.premium = false,
    this.partnerId,
    this.description,
    this.vibeTag,
    this.lat,
    this.lng,
    this.venueId,
    this.partnerOfferId,
    this.offerTitle,
    this.offerDescription,
    this.offerTerms,
    this.offerShortLabel,
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
  final String? description;
  final String? vibeTag;
  final double? lat;
  final double? lng;
  final String? venueId;
  final String? partnerOfferId;
  final String? offerTitle;
  final String? offerDescription;
  final String? offerTerms;
  final String? offerShortLabel;

  factory EveningRouteTemplateStep.fromJson(Map<String, dynamic> json) {
    return EveningRouteTemplateStep(
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
      description: json['description'] as String?,
      vibeTag: json['vibeTag'] as String?,
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
      venueId: json['venueId'] as String?,
      partnerOfferId: json['partnerOfferId'] as String?,
      offerTitle: json['offerTitle'] as String?,
      offerDescription: json['offerDescription'] as String?,
      offerTerms: json['offerTerms'] as String?,
      offerShortLabel: json['offerShortLabel'] as String?,
    );
  }
}

class CreateEveningRouteTemplateSessionResult {
  const CreateEveningRouteTemplateSessionResult({
    required this.sessionId,
    required this.routeId,
    required this.routeTemplateId,
    required this.chatId,
    required this.phase,
    required this.chatPhase,
    required this.privacy,
    required this.mode,
    required this.totalSteps,
    required this.startsAt,
    required this.joinedCount,
    required this.maxGuests,
    this.inviteToken,
    this.currentStep,
    this.currentPlace,
    this.endsAt,
  });

  final String sessionId;
  final String routeId;
  final String routeTemplateId;
  final String chatId;
  final String phase;
  final MeetupPhase chatPhase;
  final EveningPrivacy privacy;
  final EveningLaunchMode mode;
  final String? inviteToken;
  final int? currentStep;
  final int totalSteps;
  final String? currentPlace;
  final String startsAt;
  final String? endsAt;
  final int joinedCount;
  final int maxGuests;

  factory CreateEveningRouteTemplateSessionResult.fromJson(
    Map<String, dynamic> json,
  ) {
    return CreateEveningRouteTemplateSessionResult(
      sessionId: json['sessionId'] as String? ?? '',
      routeId: json['routeId'] as String? ?? '',
      routeTemplateId: json['routeTemplateId'] as String? ?? '',
      chatId: json['chatId'] as String? ?? '',
      phase: json['phase'] as String? ?? 'scheduled',
      chatPhase: parseMeetupPhase(json['chatPhase'] as String?),
      privacy: parseEveningPrivacy(json['privacy'] as String?),
      mode: parseEveningLaunchMode(json['mode'] as String?),
      inviteToken: json['inviteToken'] as String?,
      currentStep: (json['currentStep'] as num?)?.toInt(),
      totalSteps: (json['totalSteps'] as num?)?.toInt() ?? 0,
      currentPlace: json['currentPlace'] as String?,
      startsAt: json['startsAt'] as String? ?? '',
      endsAt: json['endsAt'] as String?,
      joinedCount: (json['joinedCount'] as num?)?.toInt() ?? 0,
      maxGuests: (json['maxGuests'] as num?)?.toInt() ?? 0,
    );
  }
}

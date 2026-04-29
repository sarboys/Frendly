enum MeetupPhase { live, soon, upcoming, done }

enum EveningLaunchMode { auto, manual, hybrid }

enum EveningPrivacy { open, request, invite }

class MeetupChat {
  const MeetupChat({
    required this.id,
    required this.eventId,
    required this.title,
    required this.emoji,
    required this.time,
    required this.lastMessage,
    required this.lastAuthor,
    required this.lastTime,
    required this.unread,
    required this.members,
    this.status,
    this.typing = false,
    this.isAfterDark = false,
    this.afterDarkGlow,
    this.phase = MeetupPhase.upcoming,
    this.currentStep,
    this.totalSteps,
    this.currentPlace,
    this.endTime,
    this.startsInLabel,
    this.routeId,
    this.routeTemplateId,
    this.isCurated = false,
    this.badgeLabel,
    this.sessionId,
    this.mode = EveningLaunchMode.hybrid,
    this.privacy = EveningPrivacy.open,
    this.joinedCount,
    this.maxGuests,
    this.hostUserId,
    this.hostName,
    this.area,
  });

  final String id;
  final String? eventId;
  final String title;
  final String emoji;
  final String time;
  final String lastMessage;
  final String lastAuthor;
  final String lastTime;
  final int unread;
  final List<String> members;
  final String? status;
  final bool typing;
  final bool isAfterDark;
  final String? afterDarkGlow;
  final MeetupPhase phase;
  final int? currentStep;
  final int? totalSteps;
  final String? currentPlace;
  final String? endTime;
  final String? startsInLabel;
  final String? routeId;
  final String? routeTemplateId;
  final bool isCurated;
  final String? badgeLabel;
  final String? sessionId;
  final EveningLaunchMode mode;
  final EveningPrivacy privacy;
  final int? joinedCount;
  final int? maxGuests;
  final String? hostUserId;
  final String? hostName;
  final String? area;

  factory MeetupChat.fromJson(Map<String, dynamic> json) {
    return MeetupChat(
      id: json['id'] as String,
      eventId: json['eventId'] as String?,
      title: json['title'] as String? ?? '',
      emoji: json['emoji'] as String? ?? '💬',
      time: json['time'] as String? ?? '',
      lastMessage: json['lastMessage'] as String? ?? '',
      lastAuthor: json['lastAuthor'] as String? ?? '',
      lastTime: json['lastTime'] as String? ?? '',
      unread: (json['unread'] as num?)?.toInt() ?? 0,
      members: ((json['members'] as List?) ?? const [])
          .whereType<String>()
          .toList(growable: false),
      status: json['status'] as String?,
      typing: (json['typing'] as bool?) ?? false,
      isAfterDark: (json['isAfterDark'] as bool?) ?? false,
      afterDarkGlow: json['afterDarkGlow'] as String?,
      phase: parseMeetupPhase(_optionalString(json['phase']) ??
          _optionalString(json['meetupPhase'])),
      currentStep: (json['currentStep'] as num?)?.toInt(),
      totalSteps: (json['totalSteps'] as num?)?.toInt(),
      currentPlace: json['currentPlace'] as String?,
      endTime: json['endTime'] as String?,
      startsInLabel: json['startsInLabel'] as String?,
      routeId: json['routeId'] as String?,
      routeTemplateId: json['routeTemplateId'] as String?,
      isCurated: json['isCurated'] as bool? ?? false,
      badgeLabel: json['badgeLabel'] as String?,
      sessionId: json['sessionId'] as String?,
      mode: parseEveningLaunchMode(json['mode'] as String?),
      privacy: parseEveningPrivacy(json['privacy'] as String?),
      joinedCount: (json['joinedCount'] as num?)?.toInt(),
      maxGuests: (json['maxGuests'] as num?)?.toInt(),
      hostUserId: json['hostUserId'] as String?,
      hostName: json['hostName'] as String?,
      area: json['area'] as String?,
    );
  }

  MeetupChat copyWith({
    String? id,
    String? eventId,
    String? title,
    String? emoji,
    String? time,
    String? lastMessage,
    String? lastAuthor,
    String? lastTime,
    int? unread,
    List<String>? members,
    String? status,
    bool? typing,
    bool? isAfterDark,
    String? afterDarkGlow,
    MeetupPhase? phase,
    int? currentStep,
    int? totalSteps,
    String? currentPlace,
    String? endTime,
    String? startsInLabel,
    String? routeId,
    String? routeTemplateId,
    bool? isCurated,
    String? badgeLabel,
    String? sessionId,
    EveningLaunchMode? mode,
    EveningPrivacy? privacy,
    int? joinedCount,
    int? maxGuests,
    bool clearMaxGuests = false,
    String? hostUserId,
    String? hostName,
    String? area,
  }) {
    return MeetupChat(
      id: id ?? this.id,
      eventId: eventId ?? this.eventId,
      title: title ?? this.title,
      emoji: emoji ?? this.emoji,
      time: time ?? this.time,
      lastMessage: lastMessage ?? this.lastMessage,
      lastAuthor: lastAuthor ?? this.lastAuthor,
      lastTime: lastTime ?? this.lastTime,
      unread: unread ?? this.unread,
      members: members ?? this.members,
      status: status ?? this.status,
      typing: typing ?? this.typing,
      isAfterDark: isAfterDark ?? this.isAfterDark,
      afterDarkGlow: afterDarkGlow ?? this.afterDarkGlow,
      phase: phase ?? this.phase,
      currentStep: currentStep ?? this.currentStep,
      totalSteps: totalSteps ?? this.totalSteps,
      currentPlace: currentPlace ?? this.currentPlace,
      endTime: endTime ?? this.endTime,
      startsInLabel: startsInLabel ?? this.startsInLabel,
      routeId: routeId ?? this.routeId,
      routeTemplateId: routeTemplateId ?? this.routeTemplateId,
      isCurated: isCurated ?? this.isCurated,
      badgeLabel: badgeLabel ?? this.badgeLabel,
      sessionId: sessionId ?? this.sessionId,
      mode: mode ?? this.mode,
      privacy: privacy ?? this.privacy,
      joinedCount: joinedCount ?? this.joinedCount,
      maxGuests: clearMaxGuests ? null : maxGuests ?? this.maxGuests,
      hostUserId: hostUserId ?? this.hostUserId,
      hostName: hostName ?? this.hostName,
      area: area ?? this.area,
    );
  }
}

String? _optionalString(Object? value) {
  return value is String ? value : null;
}

MeetupPhase parseMeetupPhase(String? value) {
  switch (value) {
    case 'live':
      return MeetupPhase.live;
    case 'soon':
      return MeetupPhase.soon;
    case 'done':
      return MeetupPhase.done;
    case 'upcoming':
    default:
      return MeetupPhase.upcoming;
  }
}

String meetupPhaseToJson(MeetupPhase phase) {
  switch (phase) {
    case MeetupPhase.live:
      return 'live';
    case MeetupPhase.soon:
      return 'soon';
    case MeetupPhase.upcoming:
      return 'upcoming';
    case MeetupPhase.done:
      return 'done';
  }
}

EveningLaunchMode parseEveningLaunchMode(String? value) {
  switch (value) {
    case 'auto':
      return EveningLaunchMode.auto;
    case 'manual':
      return EveningLaunchMode.manual;
    case 'hybrid':
    default:
      return EveningLaunchMode.hybrid;
  }
}

String eveningLaunchModeToJson(EveningLaunchMode mode) {
  switch (mode) {
    case EveningLaunchMode.auto:
      return 'auto';
    case EveningLaunchMode.manual:
      return 'manual';
    case EveningLaunchMode.hybrid:
      return 'hybrid';
  }
}

EveningPrivacy parseEveningPrivacy(String? value) {
  switch (value) {
    case 'request':
      return EveningPrivacy.request;
    case 'invite':
      return EveningPrivacy.invite;
    case 'open':
    default:
      return EveningPrivacy.open;
  }
}

String eveningPrivacyToJson(EveningPrivacy privacy) {
  switch (privacy) {
    case EveningPrivacy.open:
      return 'open';
    case EveningPrivacy.request:
      return 'request';
    case EveningPrivacy.invite:
      return 'invite';
  }
}

import 'package:big_break_mobile/shared/models/backend_url.dart';
import 'package:big_break_mobile/shared/models/event.dart';

class EventDetail {
  const EventDetail({
    required this.id,
    required this.title,
    required this.emoji,
    required this.time,
    this.startsAtIso,
    required this.place,
    required this.distance,
    required this.vibe,
    required this.description,
    required this.hostNote,
    required this.joined,
    required this.partnerName,
    required this.partnerOffer,
    required this.capacity,
    required this.going,
    required this.chatId,
    required this.host,
    required this.attendees,
    this.lifestyle,
    this.priceMode,
    this.priceAmountFrom,
    this.priceAmountTo,
    this.accessMode,
    this.genderMode,
    this.visibilityMode,
    this.latitude,
    this.longitude,
    this.joinMode = EventJoinMode.open,
    this.joinRequestStatus,
    this.attendanceStatus = EventAttendanceStatus.notCheckedIn,
    this.liveStatus = EventLiveStatus.idle,
    this.isHost = false,
  });

  final String id;
  final String title;
  final String emoji;
  final String time;
  final String? startsAtIso;
  final String place;
  final String distance;
  final String vibe;
  final String description;
  final String? hostNote;
  final bool joined;
  final String? partnerName;
  final String? partnerOffer;
  final int capacity;
  final int going;
  final String? chatId;
  final EventHost host;
  final List<EventAttendee> attendees;
  final String? lifestyle;
  final String? priceMode;
  final int? priceAmountFrom;
  final int? priceAmountTo;
  final String? accessMode;
  final String? genderMode;
  final String? visibilityMode;
  final double? latitude;
  final double? longitude;
  final EventJoinMode joinMode;
  final EventJoinRequestStatus? joinRequestStatus;
  final EventAttendanceStatus attendanceStatus;
  final EventLiveStatus liveStatus;
  final bool isHost;

  factory EventDetail.fromJson(Map<String, dynamic> json) {
    return EventDetail(
      id: json['id'] as String,
      title: json['title'] as String,
      emoji: json['emoji'] as String,
      time: json['time'] as String,
      startsAtIso: json['startsAtIso'] as String?,
      place: json['place'] as String,
      distance: json['distance'] as String,
      vibe: json['vibe'] as String,
      description: json['description'] as String,
      hostNote: json['hostNote'] as String?,
      joined: (json['joined'] as bool?) ?? false,
      partnerName: json['partnerName'] as String?,
      partnerOffer: json['partnerOffer'] as String?,
      capacity: (json['capacity'] as num?)?.toInt() ?? 0,
      going: (json['going'] as num?)?.toInt() ?? 0,
      chatId: json['chatId'] as String?,
      host: EventHost.fromJson(json['host'] as Map<String, dynamic>),
      attendees: ((json['attendees'] as List?) ?? const [])
          .whereType<Map>()
          .map(
              (item) => EventAttendee.fromJson(Map<String, dynamic>.from(item)))
          .toList(growable: false),
      lifestyle: json['lifestyle'] as String?,
      priceMode: json['priceMode'] as String?,
      priceAmountFrom: (json['priceAmountFrom'] as num?)?.toInt(),
      priceAmountTo: (json['priceAmountTo'] as num?)?.toInt(),
      accessMode: json['accessMode'] as String?,
      genderMode: json['genderMode'] as String?,
      visibilityMode: json['visibilityMode'] as String?,
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      joinMode: Event.parseJoinMode(json['joinMode'] as String?),
      joinRequestStatus:
          Event.parseJoinRequestStatus(json['joinRequestStatus'] as String?),
      attendanceStatus:
          Event.parseAttendanceStatus(json['attendanceStatus'] as String?),
      liveStatus: Event.parseLiveStatus(json['liveStatus'] as String?),
      isHost: (json['isHost'] as bool?) ?? false,
    );
  }
}

class EventHost {
  const EventHost({
    required this.id,
    required this.displayName,
    required this.verified,
    required this.rating,
    required this.meetupCount,
    required this.avatarUrl,
  });

  final String id;
  final String displayName;
  final bool verified;
  final double rating;
  final int meetupCount;
  final String? avatarUrl;

  factory EventHost.fromJson(Map<String, dynamic> json) {
    return EventHost(
      id: json['id'] as String,
      displayName: json['displayName'] as String,
      verified: (json['verified'] as bool?) ?? false,
      rating: (json['rating'] as num?)?.toDouble() ?? 0,
      meetupCount: (json['meetupCount'] as num?)?.toInt() ?? 0,
      avatarUrl: resolveBackendUrl(json['avatarUrl'] as String?),
    );
  }
}

class EventAttendee {
  const EventAttendee({
    required this.id,
    required this.displayName,
    required this.avatarUrl,
  });

  final String id;
  final String displayName;
  final String? avatarUrl;

  factory EventAttendee.fromJson(Map<String, dynamic> json) {
    return EventAttendee(
      id: json['id'] as String,
      displayName: json['displayName'] as String,
      avatarUrl: resolveBackendUrl(json['avatarUrl'] as String?),
    );
  }
}

import 'package:big_break_mobile/shared/models/backend_url.dart';

class AfterPartyData {
  const AfterPartyData({
    required this.eventId,
    required this.title,
    required this.emoji,
    required this.saved,
    required this.vibe,
    required this.hostRating,
    required this.note,
    required this.favoriteUserIds,
    required this.attendees,
  });

  final String eventId;
  final String title;
  final String emoji;
  final bool saved;
  final String? vibe;
  final int? hostRating;
  final String? note;
  final List<String> favoriteUserIds;
  final List<AfterPartyAttendee> attendees;

  factory AfterPartyData.fromJson(Map<String, dynamic> json) {
    return AfterPartyData(
      eventId: json['eventId'] as String,
      title: json['title'] as String,
      emoji: json['emoji'] as String,
      saved: (json['saved'] as bool?) ?? false,
      vibe: json['vibe'] as String?,
      hostRating: (json['hostRating'] as num?)?.toInt(),
      note: json['note'] as String?,
      favoriteUserIds: ((json['favoriteUserIds'] as List?) ?? const [])
          .whereType<String>()
          .toList(growable: false),
      attendees: ((json['attendees'] as List?) ?? const [])
          .whereType<Map>()
          .map((item) =>
              AfterPartyAttendee.fromJson(Map<String, dynamic>.from(item)))
          .toList(growable: false),
    );
  }
}

class AfterPartyAttendee {
  const AfterPartyAttendee({
    required this.userId,
    required this.displayName,
    required this.avatarUrl,
  });

  final String userId;
  final String displayName;
  final String? avatarUrl;

  factory AfterPartyAttendee.fromJson(Map<String, dynamic> json) {
    return AfterPartyAttendee(
      userId: json['userId'] as String,
      displayName: json['displayName'] as String,
      avatarUrl: resolveBackendUrl(json['avatarUrl'] as String?),
    );
  }
}

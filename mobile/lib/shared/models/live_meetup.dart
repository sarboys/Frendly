import 'package:big_break_mobile/shared/models/backend_url.dart';
import 'package:big_break_mobile/shared/models/event.dart';

class LiveMeetupData {
  const LiveMeetupData({
    required this.eventId,
    required this.title,
    required this.place,
    required this.chatId,
    required this.status,
    required this.startedAt,
    required this.elapsedMinutes,
    required this.storiesCount,
    required this.attendees,
  });

  final String eventId;
  final String title;
  final String place;
  final String? chatId;
  final EventLiveStatus status;
  final DateTime? startedAt;
  final int elapsedMinutes;
  final int storiesCount;
  final List<LiveMeetupAttendee> attendees;

  factory LiveMeetupData.fromJson(Map<String, dynamic> json) {
    return LiveMeetupData(
      eventId: json['eventId'] as String,
      title: json['title'] as String,
      place: json['place'] as String,
      chatId: json['chatId'] as String?,
      status: Event.parseLiveStatus(json['status'] as String?),
      startedAt: json['startedAt'] == null
          ? null
          : DateTime.parse(json['startedAt'] as String),
      elapsedMinutes: (json['elapsedMinutes'] as num?)?.toInt() ?? 0,
      storiesCount: (json['storiesCount'] as num?)?.toInt() ?? 0,
      attendees: ((json['attendees'] as List?) ?? const [])
          .whereType<Map>()
          .map((item) =>
              LiveMeetupAttendee.fromJson(Map<String, dynamic>.from(item)))
          .toList(growable: false),
    );
  }
}

class LiveMeetupAttendee {
  const LiveMeetupAttendee({
    required this.userId,
    required this.displayName,
    required this.avatarUrl,
    required this.verified,
    required this.online,
    required this.attendanceStatus,
  });

  final String userId;
  final String displayName;
  final String? avatarUrl;
  final bool verified;
  final bool online;
  final EventAttendanceStatus attendanceStatus;

  factory LiveMeetupAttendee.fromJson(Map<String, dynamic> json) {
    return LiveMeetupAttendee(
      userId: json['userId'] as String,
      displayName: json['displayName'] as String,
      avatarUrl: resolveBackendUrl(json['avatarUrl'] as String?),
      verified: (json['verified'] as bool?) ?? false,
      online: (json['online'] as bool?) ?? false,
      attendanceStatus:
          Event.parseAttendanceStatus(json['attendanceStatus'] as String?),
    );
  }
}

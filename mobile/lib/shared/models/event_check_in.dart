import 'package:big_break_mobile/shared/models/backend_url.dart';
import 'package:big_break_mobile/shared/models/event.dart';

class EventCheckInData {
  const EventCheckInData({
    required this.eventId,
    required this.title,
    required this.place,
    required this.latitude,
    required this.longitude,
    required this.status,
    required this.code,
    required this.attendees,
  });

  final String eventId;
  final String title;
  final String place;
  final double? latitude;
  final double? longitude;
  final EventAttendanceStatus status;
  final String code;
  final List<EventCheckInAttendee> attendees;

  factory EventCheckInData.fromJson(Map<String, dynamic> json) {
    return EventCheckInData(
      eventId: json['eventId'] as String,
      title: json['title'] as String,
      place: json['place'] as String,
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      status: Event.parseAttendanceStatus(json['status'] as String?),
      code: json['code'] as String,
      attendees: ((json['attendees'] as List?) ?? const [])
          .whereType<Map>()
          .map((item) =>
              EventCheckInAttendee.fromJson(Map<String, dynamic>.from(item)))
          .toList(growable: false),
    );
  }
}

class EventCheckInAttendee {
  const EventCheckInAttendee({
    required this.userId,
    required this.displayName,
    required this.avatarUrl,
    required this.attendanceStatus,
    required this.verified,
    required this.online,
  });

  final String userId;
  final String displayName;
  final String? avatarUrl;
  final EventAttendanceStatus attendanceStatus;
  final bool verified;
  final bool online;

  factory EventCheckInAttendee.fromJson(Map<String, dynamic> json) {
    return EventCheckInAttendee(
      userId: json['userId'] as String,
      displayName: json['displayName'] as String,
      avatarUrl: resolveBackendUrl(json['avatarUrl'] as String?),
      attendanceStatus:
          Event.parseAttendanceStatus(json['attendanceStatus'] as String?),
      verified: (json['verified'] as bool?) ?? false,
      online: (json['online'] as bool?) ?? false,
    );
  }
}

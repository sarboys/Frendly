import 'package:big_break_mobile/shared/models/event.dart';

import 'package:big_break_mobile/shared/models/backend_url.dart';

class HostDashboardData {
  const HostDashboardData({
    required this.stats,
    required this.pendingRequestsCount,
    required this.requests,
    required this.events,
  });

  final HostDashboardStats stats;
  final int pendingRequestsCount;
  final List<HostJoinRequest> requests;
  final List<Event> events;

  factory HostDashboardData.fromJson(Map<String, dynamic> json) {
    return HostDashboardData(
      stats: HostDashboardStats.fromJson(
        Map<String, dynamic>.from(json['stats'] as Map),
      ),
      pendingRequestsCount:
          (json['pendingRequestsCount'] as num?)?.toInt() ?? 0,
      requests: ((json['requests'] as List?) ?? const [])
          .whereType<Map>()
          .map((item) =>
              HostJoinRequest.fromJson(Map<String, dynamic>.from(item)))
          .toList(growable: false),
      events: ((json['events'] as List?) ?? const [])
          .whereType<Map>()
          .map((item) => Event.fromJson(Map<String, dynamic>.from(item)))
          .toList(growable: false),
    );
  }
}

class HostDashboardStats {
  const HostDashboardStats({
    required this.meetupsCount,
    required this.rating,
    required this.fillRate,
  });

  final int meetupsCount;
  final double rating;
  final int fillRate;

  factory HostDashboardStats.fromJson(Map<String, dynamic> json) {
    return HostDashboardStats(
      meetupsCount: (json['meetupsCount'] as num?)?.toInt() ?? 0,
      rating: (json['rating'] as num?)?.toDouble() ?? 0,
      fillRate: (json['fillRate'] as num?)?.toInt() ?? 0,
    );
  }
}

class HostJoinRequest {
  const HostJoinRequest({
    required this.id,
    required this.eventId,
    required this.eventTitle,
    required this.note,
    required this.status,
    required this.compatibilityScore,
    required this.createdAt,
    required this.reviewedAt,
    required this.userId,
    required this.userName,
    required this.avatarUrl,
  });

  final String id;
  final String eventId;
  final String eventTitle;
  final String? note;
  final EventJoinRequestStatus status;
  final int compatibilityScore;
  final DateTime createdAt;
  final DateTime? reviewedAt;
  final String userId;
  final String userName;
  final String? avatarUrl;

  factory HostJoinRequest.fromJson(Map<String, dynamic> json) {
    return HostJoinRequest(
      id: json['id'] as String,
      eventId: json['eventId'] as String,
      eventTitle: json['eventTitle'] as String,
      note: json['note'] as String?,
      status: Event.parseJoinRequestStatus(json['status'] as String?) ??
          EventJoinRequestStatus.pending,
      compatibilityScore: (json['compatibilityScore'] as num?)?.toInt() ?? 0,
      createdAt: DateTime.parse(json['createdAt'] as String),
      reviewedAt: json['reviewedAt'] == null
          ? null
          : DateTime.parse(json['reviewedAt'] as String),
      userId: json['userId'] as String,
      userName: json['userName'] as String,
      avatarUrl: resolveBackendUrl(json['avatarUrl'] as String?),
    );
  }
}

class HostEventData {
  const HostEventData({
    required this.event,
    required this.chatId,
    required this.liveStatus,
    required this.requests,
    required this.attendees,
  });

  final Event event;
  final String? chatId;
  final EventLiveStatus liveStatus;
  final List<HostJoinRequest> requests;
  final List<HostEventAttendee> attendees;

  factory HostEventData.fromJson(Map<String, dynamic> json) {
    return HostEventData(
      event: Event.fromJson(Map<String, dynamic>.from(json['event'] as Map)),
      chatId: json['chatId'] as String?,
      liveStatus: Event.parseLiveStatus(json['liveStatus'] as String?),
      requests: ((json['requests'] as List?) ?? const [])
          .whereType<Map>()
          .map((item) =>
              HostJoinRequest.fromJson(Map<String, dynamic>.from(item)))
          .toList(growable: false),
      attendees: ((json['attendees'] as List?) ?? const [])
          .whereType<Map>()
          .map((item) =>
              HostEventAttendee.fromJson(Map<String, dynamic>.from(item)))
          .toList(growable: false),
    );
  }
}

class HostEventAttendee {
  const HostEventAttendee({
    required this.userId,
    required this.displayName,
    required this.avatarUrl,
    required this.verified,
    required this.online,
    required this.attendanceStatus,
    required this.checkedInAt,
  });

  final String userId;
  final String displayName;
  final String? avatarUrl;
  final bool verified;
  final bool online;
  final EventAttendanceStatus attendanceStatus;
  final DateTime? checkedInAt;

  factory HostEventAttendee.fromJson(Map<String, dynamic> json) {
    return HostEventAttendee(
      userId: json['userId'] as String,
      displayName: json['displayName'] as String,
      avatarUrl: resolveBackendUrl(json['avatarUrl'] as String?),
      verified: (json['verified'] as bool?) ?? false,
      online: (json['online'] as bool?) ?? false,
      attendanceStatus:
          Event.parseAttendanceStatus(json['attendanceStatus'] as String?),
      checkedInAt: json['checkedInAt'] == null
          ? null
          : DateTime.parse(json['checkedInAt'] as String),
    );
  }
}

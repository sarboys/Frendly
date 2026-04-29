enum EventTone { warm, evening, sage }

enum EventJoinMode { open, request }

enum EventJoinRequestStatus { pending, approved, rejected, canceled }

enum EventAttendanceStatus { notCheckedIn, checkedIn, left }

enum EventLiveStatus { idle, live, finished }

class Event {
  const Event({
    required this.id,
    required this.title,
    required this.emoji,
    required this.time,
    this.startsAtIso,
    required this.place,
    required this.distance,
    required this.attendees,
    required this.going,
    required this.capacity,
    required this.vibe,
    required this.tone,
    this.lifestyle,
    this.priceMode,
    this.priceAmountFrom,
    this.priceAmountTo,
    this.accessMode,
    this.genderMode,
    this.visibilityMode,
    this.hostNote,
    this.latitude,
    this.longitude,
    required this.joined,
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
  final List<String> attendees;
  final int going;
  final int capacity;
  final String vibe;
  final EventTone tone;
  final String? lifestyle;
  final String? priceMode;
  final int? priceAmountFrom;
  final int? priceAmountTo;
  final String? accessMode;
  final String? genderMode;
  final String? visibilityMode;
  final String? hostNote;
  final double? latitude;
  final double? longitude;
  final bool joined;
  final EventJoinMode joinMode;
  final EventJoinRequestStatus? joinRequestStatus;
  final EventAttendanceStatus attendanceStatus;
  final EventLiveStatus liveStatus;
  final bool isHost;

  factory Event.fromJson(Map<String, dynamic> json) {
    return Event(
      id: json['id'] as String,
      title: json['title'] as String,
      emoji: json['emoji'] as String,
      time: json['time'] as String,
      startsAtIso: json['startsAtIso'] as String?,
      place: json['place'] as String,
      distance: json['distance'] as String,
      attendees: ((json['attendees'] as List?) ?? const [])
          .whereType<String>()
          .toList(growable: false),
      going: (json['going'] as num?)?.toInt() ?? 0,
      capacity: (json['capacity'] as num?)?.toInt() ?? 0,
      vibe: json['vibe'] as String,
      tone: parseTone(json['tone'] as String?),
      lifestyle: json['lifestyle'] as String?,
      priceMode: json['priceMode'] as String?,
      priceAmountFrom: (json['priceAmountFrom'] as num?)?.toInt(),
      priceAmountTo: (json['priceAmountTo'] as num?)?.toInt(),
      accessMode: json['accessMode'] as String?,
      genderMode: json['genderMode'] as String?,
      visibilityMode: json['visibilityMode'] as String?,
      hostNote: json['hostNote'] as String?,
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      joined: (json['joined'] as bool?) ?? false,
      joinMode: parseJoinMode(json['joinMode'] as String?),
      joinRequestStatus:
          parseJoinRequestStatus(json['joinRequestStatus'] as String?),
      attendanceStatus:
          parseAttendanceStatus(json['attendanceStatus'] as String?),
      liveStatus: parseLiveStatus(json['liveStatus'] as String?),
      isHost: (json['isHost'] as bool?) ?? false,
    );
  }

  static EventTone parseTone(String? raw) {
    switch (raw) {
      case 'evening':
        return EventTone.evening;
      case 'sage':
        return EventTone.sage;
      case 'warm':
      default:
        return EventTone.warm;
    }
  }

  static EventJoinMode parseJoinMode(String? raw) {
    switch (raw) {
      case 'request':
        return EventJoinMode.request;
      case 'open':
      default:
        return EventJoinMode.open;
    }
  }

  static EventJoinRequestStatus? parseJoinRequestStatus(String? raw) {
    switch (raw) {
      case 'pending':
        return EventJoinRequestStatus.pending;
      case 'approved':
        return EventJoinRequestStatus.approved;
      case 'rejected':
        return EventJoinRequestStatus.rejected;
      case 'canceled':
        return EventJoinRequestStatus.canceled;
      default:
        return null;
    }
  }

  static EventAttendanceStatus parseAttendanceStatus(String? raw) {
    switch (raw) {
      case 'checked_in':
        return EventAttendanceStatus.checkedIn;
      case 'left':
        return EventAttendanceStatus.left;
      case 'not_checked_in':
      default:
        return EventAttendanceStatus.notCheckedIn;
    }
  }

  static EventLiveStatus parseLiveStatus(String? raw) {
    switch (raw) {
      case 'live':
        return EventLiveStatus.live;
      case 'finished':
        return EventLiveStatus.finished;
      case 'idle':
      default:
        return EventLiveStatus.idle;
    }
  }
}

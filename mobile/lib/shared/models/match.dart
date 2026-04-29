import 'package:big_break_mobile/shared/models/backend_url.dart';

class MatchData {
  const MatchData({
    required this.userId,
    required this.displayName,
    required this.avatarUrl,
    required this.area,
    required this.vibe,
    required this.score,
    required this.commonInterests,
    required this.eventId,
    required this.eventTitle,
  });

  final String userId;
  final String displayName;
  final String? avatarUrl;
  final String? area;
  final String? vibe;
  final int score;
  final List<String> commonInterests;
  final String eventId;
  final String eventTitle;

  factory MatchData.fromJson(Map<String, dynamic> json) {
    return MatchData(
      userId: json['userId'] as String,
      displayName: json['displayName'] as String,
      avatarUrl: resolveBackendUrl(json['avatarUrl'] as String?),
      area: json['area'] as String?,
      vibe: json['vibe'] as String?,
      score: (json['score'] as num?)?.toInt() ?? 0,
      commonInterests: ((json['commonInterests'] as List?) ?? const [])
          .whereType<String>()
          .toList(growable: false),
      eventId: json['eventId'] as String,
      eventTitle: json['eventTitle'] as String,
    );
  }
}

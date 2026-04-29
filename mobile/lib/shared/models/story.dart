import 'package:big_break_mobile/shared/models/backend_url.dart';

class StoryData {
  const StoryData({
    required this.id,
    required this.eventId,
    required this.authorId,
    required this.authorName,
    required this.avatarUrl,
    required this.caption,
    required this.emoji,
    required this.createdAt,
  });

  final String id;
  final String eventId;
  final String authorId;
  final String authorName;
  final String? avatarUrl;
  final String caption;
  final String emoji;
  final DateTime createdAt;

  factory StoryData.fromJson(Map<String, dynamic> json) {
    return StoryData(
      id: json['id'] as String,
      eventId: json['eventId'] as String,
      authorId: json['authorId'] as String,
      authorName: json['authorName'] as String,
      avatarUrl: resolveBackendUrl(json['avatarUrl'] as String?),
      caption: json['caption'] as String,
      emoji: json['emoji'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

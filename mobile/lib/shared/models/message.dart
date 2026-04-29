import 'dart:convert';
import 'dart:typed_data';

import 'package:big_break_mobile/shared/models/backend_url.dart';

class Message {
  const Message({
    required this.id,
    required this.chatId,
    required this.clientMessageId,
    required this.authorId,
    required this.author,
    required this.text,
    required this.time,
    required this.attachments,
    this.authorAvatarUrl,
    this.replyTo,
    this.createdAt,
    this.mine = false,
    this.showAuthor = false,
    this.showAvatar = false,
    this.isPending = false,
    this.isSystem = false,
  });

  final String id;
  final String chatId;
  final String clientMessageId;
  final String authorId;
  final String author;
  final String? authorAvatarUrl;
  final String text;
  final String time;
  final DateTime? createdAt;
  final bool mine;
  final List<MessageAttachment> attachments;
  final MessageReplyPreview? replyTo;
  final bool showAuthor;
  final bool showAvatar;
  final bool isPending;
  final bool isSystem;

  factory Message.fromJson(
    Map<String, dynamic> json, {
    required String currentUserId,
  }) {
    final authorId = json['senderId'] as String;
    final isSystem = json['kind'] == 'system' || json['system'] == true;
    final clientMessageId =
        json['clientMessageId'] as String? ?? json['id'] as String;
    final rawText = json['text'] as String? ?? '';
    final displayText = _displayTextForSystemMessage(
      rawText,
      clientMessageId: clientMessageId,
      authorId: authorId,
      currentUserId: currentUserId,
      isSystem: isSystem,
    );
    final locationAttachment = _locationAttachmentFromMessageText(
      rawText,
      messageId: json['id'] as String,
      createdAt: json['createdAt'] as String,
    );
    final text = locationAttachment == null ? displayText : '';
    return Message(
      id: json['id'] as String,
      chatId: json['chatId'] as String,
      clientMessageId: clientMessageId,
      authorId: authorId,
      author: json['senderName'] as String,
      authorAvatarUrl: resolveBackendUrl(json['senderAvatarUrl'] as String?),
      text: text,
      time: _formatTime(json['createdAt'] as String),
      createdAt: DateTime.parse(json['createdAt'] as String).toLocal(),
      mine: !isSystem && authorId == currentUserId,
      replyTo: json['replyTo'] is Map
          ? MessageReplyPreview.fromJson(
              Map<String, dynamic>.from(json['replyTo'] as Map),
              currentUserId: currentUserId,
            )
          : null,
      attachments: [
        if (locationAttachment != null) locationAttachment,
        ...((json['attachments'] as List?) ?? const []).whereType<Map>().map(
            (item) =>
                MessageAttachment.fromJson(Map<String, dynamic>.from(item))),
      ],
      isSystem: isSystem,
    );
  }

  Message copyWith({
    String? id,
    String? clientMessageId,
    String? text,
    String? time,
    String? authorAvatarUrl,
    DateTime? createdAt,
    List<MessageAttachment>? attachments,
    MessageReplyPreview? replyTo,
    bool? showAuthor,
    bool? showAvatar,
    bool? isPending,
    bool? isSystem,
  }) {
    return Message(
      id: id ?? this.id,
      chatId: chatId,
      clientMessageId: clientMessageId ?? this.clientMessageId,
      authorId: authorId,
      author: author,
      authorAvatarUrl: authorAvatarUrl ?? this.authorAvatarUrl,
      text: text ?? this.text,
      time: time ?? this.time,
      createdAt: createdAt ?? this.createdAt,
      mine: mine,
      attachments: attachments ?? this.attachments,
      replyTo: replyTo ?? this.replyTo,
      showAuthor: showAuthor ?? this.showAuthor,
      showAvatar: showAvatar ?? this.showAvatar,
      isPending: isPending ?? this.isPending,
      isSystem: isSystem ?? this.isSystem,
    );
  }

  static String _formatTime(String raw) {
    final dt = DateTime.parse(raw).toLocal();
    final hh = dt.hour.toString().padLeft(2, '0');
    final mm = dt.minute.toString().padLeft(2, '0');
    return '$hh:$mm';
  }
}

String _displayTextForSystemMessage(
  String rawText, {
  required String clientMessageId,
  required String authorId,
  required String currentUserId,
  required bool isSystem,
}) {
  if (!isSystem ||
      authorId != currentUserId ||
      !clientMessageId.startsWith('evening-session:') ||
      !clientMessageId.contains(':join:')) {
    return rawText;
  }

  const separator = ' · ';
  final separatorIndex = rawText.indexOf(separator);
  final suffix = separatorIndex < 0 ? '' : rawText.substring(separatorIndex);
  return 'Ты присоединился$suffix';
}

class MessageReplyPreview {
  const MessageReplyPreview({
    required this.id,
    required this.author,
    required this.text,
    required this.isVoice,
    this.authorId,
    this.mine = false,
  });

  final String id;
  final String? authorId;
  final String author;
  final String text;
  final bool isVoice;
  final bool mine;

  factory MessageReplyPreview.fromJson(
    Map<String, dynamic> json, {
    String? currentUserId,
  }) {
    final authorId = json['authorId'] as String?;
    return MessageReplyPreview(
      id: json['id'] as String,
      authorId: authorId,
      author: json['author'] as String? ?? '',
      text: json['text'] as String? ?? '',
      isVoice: (json['isVoice'] as bool?) ?? false,
      mine: (json['mine'] as bool?) ??
          false || (currentUserId != null && authorId == currentUserId),
    );
  }
}

class MessageAttachment {
  const MessageAttachment({
    required this.id,
    required this.kind,
    required this.status,
    required this.url,
    this.downloadUrlPath,
    required this.mimeType,
    required this.byteSize,
    required this.fileName,
    this.title,
    this.subtitle,
    this.latitude,
    this.longitude,
    this.expiresAt,
    this.localBytes,
    this.localPath,
    this.durationMs,
    this.waveform,
  });

  final String id;
  final String kind;
  final String status;
  final String? url;
  final String? downloadUrlPath;
  final String mimeType;
  final int byteSize;
  final String fileName;
  final String? title;
  final String? subtitle;
  final double? latitude;
  final double? longitude;
  final DateTime? expiresAt;
  final Uint8List? localBytes;
  final String? localPath;
  final int? durationMs;
  final List<double>? waveform;

  bool get isLocation =>
      kind == 'chat_location' && latitude != null && longitude != null;

  bool get isVoice => kind == 'chat_voice' && durationMs != null;

  bool get isExpired =>
      expiresAt != null && expiresAt!.isBefore(DateTime.now());

  factory MessageAttachment.fromJson(Map<String, dynamic> json) {
    final hasWaveform = json.containsKey('waveform');
    return MessageAttachment(
      id: json['id'] as String,
      kind: json['kind'] as String? ?? 'chat_attachment',
      status: json['status'] as String? ?? 'pending',
      url: resolveBackendUrl(json['url'] as String?),
      downloadUrlPath: json['downloadUrlPath'] as String?,
      mimeType: json['mimeType'] as String? ?? 'application/octet-stream',
      byteSize: (json['byteSize'] as num?)?.toInt() ?? 0,
      fileName: json['fileName'] as String? ?? '',
      title: json['title'] as String?,
      subtitle: json['subtitle'] as String?,
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      expiresAt: json['expiresAt'] == null
          ? null
          : DateTime.parse(json['expiresAt'] as String).toLocal(),
      durationMs: (json['durationMs'] as num?)?.toInt(),
      waveform: !hasWaveform
          ? null
          : ((json['waveform'] as List?) ?? const [])
              .whereType<num>()
              .map((item) => item.toDouble())
              .toList(growable: false),
      localBytes: null,
      localPath: null,
    );
  }

  MessageAttachment copyWith({
    String? id,
    String? kind,
    String? status,
    String? url,
    String? downloadUrlPath,
    String? mimeType,
    int? byteSize,
    String? fileName,
    String? title,
    String? subtitle,
    double? latitude,
    double? longitude,
    DateTime? expiresAt,
    Uint8List? localBytes,
    String? localPath,
    int? durationMs,
    List<double>? waveform,
  }) {
    return MessageAttachment(
      id: id ?? this.id,
      kind: kind ?? this.kind,
      status: status ?? this.status,
      url: url ?? this.url,
      downloadUrlPath: downloadUrlPath ?? this.downloadUrlPath,
      mimeType: mimeType ?? this.mimeType,
      byteSize: byteSize ?? this.byteSize,
      fileName: fileName ?? this.fileName,
      title: title ?? this.title,
      subtitle: subtitle ?? this.subtitle,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      expiresAt: expiresAt ?? this.expiresAt,
      localBytes: localBytes ?? this.localBytes,
      localPath: localPath ?? this.localPath,
      durationMs: durationMs ?? this.durationMs,
      waveform: waveform ?? this.waveform,
    );
  }
}

const _locationPayloadPrefix = '__bb_location__:';

String encodeLocationMessagePayload({
  required double latitude,
  required double longitude,
  required String title,
  required String subtitle,
}) {
  return '$_locationPayloadPrefix${jsonEncode({
        'latitude': latitude,
        'longitude': longitude,
        'title': title,
        'subtitle': subtitle,
      })}';
}

MessageAttachment? _locationAttachmentFromMessageText(
  String rawText, {
  required String messageId,
  required String createdAt,
}) {
  if (!rawText.startsWith(_locationPayloadPrefix)) {
    return null;
  }

  final payload = rawText.substring(_locationPayloadPrefix.length);
  final decoded = _tryDecodeLocationPayload(payload);
  if (decoded == null) {
    return null;
  }

  final latitude = (decoded['latitude'] as num?)?.toDouble();
  final longitude = (decoded['longitude'] as num?)?.toDouble();
  if (latitude == null || longitude == null) {
    return null;
  }

  final title = decoded['title'] as String? ?? 'Ты здесь';
  final subtitle = decoded['subtitle'] as String? ?? '';

  return MessageAttachment(
    id: 'location-$messageId',
    kind: 'chat_location',
    status: 'ready',
    url: null,
    mimeType: 'application/vnd.bigbreak.location',
    byteSize: 0,
    fileName: title,
    title: title,
    subtitle: subtitle,
    latitude: latitude,
    longitude: longitude,
    expiresAt: DateTime.parse(createdAt).toLocal().add(
          const Duration(minutes: 5),
        ),
    localBytes: null,
    localPath: null,
    durationMs: null,
    waveform: null,
  );
}

Map<String, dynamic>? _tryDecodeLocationPayload(String payload) {
  try {
    final decoded = jsonDecode(payload);
    if (decoded is Map<String, dynamic>) {
      return decoded;
    }
    if (decoded is Map) {
      return Map<String, dynamic>.from(decoded);
    }
  } catch (_) {
    return null;
  }
  return null;
}

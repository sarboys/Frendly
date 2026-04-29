import 'package:big_break_mobile/app/core/config/backend_config.dart';
import 'package:big_break_mobile/shared/models/message.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('message maps sender avatar url from backend payload', () {
    final message = Message.fromJson(
      const {
        'id': 'message-1',
        'chatId': 'chat-1',
        'clientMessageId': 'client-1',
        'senderId': 'user-anya',
        'senderName': 'Аня К',
        'senderAvatarUrl': '/media/avatar-1',
        'text': 'Привет',
        'createdAt': '2026-04-24T12:33:00.000Z',
        'attachments': [],
      },
      currentUserId: 'user-me',
    );

    expect(
      message.authorAvatarUrl,
      '${BackendConfig.apiBaseUrl}/media/avatar-1',
    );
  });

  test('system message is never treated as mine', () {
    final message = Message.fromJson(
      const {
        'id': 'message-system',
        'chatId': 'chat-1',
        'clientMessageId': 'evening-session:s1:start',
        'senderId': 'user-me',
        'senderName': 'Frendly',
        'senderAvatarUrl': null,
        'text': 'Вечер начался',
        'kind': 'system',
        'createdAt': '2026-04-24T12:33:00.000Z',
        'attachments': [],
      },
      currentUserId: 'user-me',
    );

    expect(message.isSystem, isTrue);
    expect(message.mine, isFalse);
    expect(message.author, 'Frendly');
  });

  test('own evening late join system message uses personal wording', () {
    final message = Message.fromJson(
      const {
        'id': 'message-system-join',
        'chatId': 'chat-1',
        'clientMessageId': 'evening-session:s1:join:user-me',
        'senderId': 'user-me',
        'senderName': 'Frendly',
        'senderAvatarUrl': null,
        'text': 'Марк присоединился · шаг 2/4',
        'kind': 'system',
        'createdAt': '2026-04-24T12:33:00.000Z',
        'attachments': [],
      },
      currentUserId: 'user-me',
    );

    expect(message.text, 'Ты присоединился · шаг 2/4');
    expect(message.isSystem, isTrue);
    expect(message.mine, isFalse);
  });

  test('message attachment keeps backend download url path', () {
    final attachment = MessageAttachment.fromJson(
      const {
        'id': 'asset-1',
        'kind': 'chat_voice',
        'status': 'ready',
        'url': '/media/asset-1',
        'downloadUrlPath': '/media/asset-1/download-url',
        'mimeType': 'audio/mp4',
        'byteSize': 2048,
        'fileName': 'voice.m4a',
        'durationMs': 7000,
      },
    );

    expect(attachment.downloadUrlPath, '/media/asset-1/download-url');
    expect(
      attachment.copyWith(status: 'pending').downloadUrlPath,
      '/media/asset-1/download-url',
    );
  });
}

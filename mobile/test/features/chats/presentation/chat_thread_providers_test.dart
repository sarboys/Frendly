import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:big_break_mobile/app/core/device/app_attachment_service.dart';
import 'package:big_break_mobile/app/core/network/chat_socket_client.dart';
import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/features/chats/presentation/chat_thread_providers.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/meetup_chat.dart';
import 'package:big_break_mobile/shared/models/message.dart';
import 'package:big_break_mobile/shared/models/paginated_response.dart';
import 'package:big_break_mobile/shared/models/recorded_voice_draft.dart';
import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeChatThreadRepository extends BackendRepository {
  _FakeChatThreadRepository({
    required super.ref,
    required super.dio,
    this.lastEventId,
    this.fetchedMessages = const [],
  });

  var voiceUploadCalls = 0;
  String? lastVoiceChatId;
  int? lastVoiceDurationMs;
  String? lastVoiceFileName;
  var markReadCalls = 0;
  String? lastMarkedReadChatId;
  String? lastMarkedReadMessageId;
  final String? lastEventId;
  final List<Message> fetchedMessages;

  @override
  Future<PaginatedResponse<Message>> fetchMessages(
    String chatId, {
    String? cursor,
    int limit = 100,
  }) async {
    return PaginatedResponse(
      items: fetchedMessages,
      nextCursor: null,
      lastEventId: lastEventId,
    );
  }

  @override
  Future<void> markChatRead(String chatId, String messageId) async {
    markReadCalls += 1;
    lastMarkedReadChatId = chatId;
    lastMarkedReadMessageId = messageId;
  }

  @override
  Future<String> uploadChatAttachment(
    PlatformFile file, {
    required String chatId,
  }) async {
    return 'asset-1';
  }

  @override
  Future<String> uploadChatVoice(
    PlatformFile file, {
    required String chatId,
    required int durationMs,
    required List<double> waveform,
  }) async {
    voiceUploadCalls += 1;
    lastVoiceChatId = chatId;
    lastVoiceDurationMs = durationMs;
    lastVoiceFileName = file.name;
    return 'voice-asset-1';
  }
}

class _DelayedChatThreadRepository extends BackendRepository {
  _DelayedChatThreadRepository({
    required super.ref,
    required super.dio,
    required this.completer,
  });

  final Completer<PaginatedResponse<Message>> completer;

  @override
  Future<PaginatedResponse<Message>> fetchMessages(
    String chatId, {
    String? cursor,
    int limit = 100,
  }) {
    return completer.future;
  }
}

class _SequentialChatThreadRepository extends BackendRepository {
  _SequentialChatThreadRepository({
    required super.ref,
    required super.dio,
    required this.responses,
  });

  final List<PaginatedResponse<Message>> responses;
  var fetchMessagesCalls = 0;

  @override
  Future<PaginatedResponse<Message>> fetchMessages(
    String chatId, {
    String? cursor,
    int limit = 100,
  }) async {
    final index = fetchMessagesCalls < responses.length
        ? fetchMessagesCalls
        : responses.length - 1;
    fetchMessagesCalls += 1;
    return responses[index];
  }
}

class _FakeAttachmentService implements AppAttachmentService {
  final warmedAttachmentIds = <String>[];

  @override
  Future<void> clearPrivateCache() async {}

  @override
  Future<File> getCachedFile(MessageAttachment attachment) {
    throw UnimplementedError();
  }

  @override
  Future<String?> getDownloadUrl(MessageAttachment attachment) async => null;

  @override
  Future<File?> getLocalFileIfAvailable(MessageAttachment attachment) async =>
      null;

  @override
  Future<void> openAttachment(MessageAttachment attachment) async {}

  @override
  Future<String> saveAttachmentToDevice(MessageAttachment attachment) {
    throw UnimplementedError();
  }

  @override
  Future<void> warmCache(MessageAttachment attachment) async {
    warmedAttachmentIds.add(attachment.id);
  }
}

class _ControllableChatSocketClient extends ChatSocketClient {
  _ControllableChatSocketClient()
      : _events = StreamController<Map<String, dynamic>>.broadcast(),
        super(accessTokenProvider: _token);

  final StreamController<Map<String, dynamic>> _events;

  String? lastClientMessageId;
  String? lastText;
  List<String> lastAttachmentIds = const [];
  String? lastReplyToMessageId;
  String? lastReadChatId;
  String? lastReadMessageId;
  String? lastRequestedSyncChatId;
  String? lastRequestedSyncCursor;
  String? lastRememberedSyncChatId;
  String? lastRememberedSyncCursor;
  String? lastEditedMessageId;
  String? lastEditedText;
  String? lastDeletedMessageId;

  static Future<String> _token() async => 'token';

  @override
  Stream<Map<String, dynamic>> get events => _events.stream;

  @override
  Future<void> connect() async {}

  @override
  void subscribe(String chatId) {}

  @override
  void unsubscribe(String chatId) {}

  @override
  void requestSync({required String chatId, String? sinceEventId}) {
    lastRequestedSyncChatId = chatId;
    lastRequestedSyncCursor = sinceEventId;
  }

  @override
  void rememberSyncCursor({required String chatId, String? eventId}) {
    lastRememberedSyncChatId = chatId;
    lastRememberedSyncCursor = eventId;
  }

  @override
  Future<void> sendMessage({
    required String chatId,
    required String text,
    required String clientMessageId,
    List<String> attachmentIds = const [],
    String? replyToMessageId,
  }) async {
    lastClientMessageId = clientMessageId;
    lastText = text;
    lastAttachmentIds = attachmentIds;
    lastReplyToMessageId = replyToMessageId;
  }

  @override
  Future<void> editMessage({
    required String chatId,
    required String messageId,
    required String text,
  }) async {
    lastEditedMessageId = messageId;
    lastEditedText = text;
  }

  @override
  Future<void> deleteMessage({
    required String chatId,
    required String messageId,
  }) async {
    lastDeletedMessageId = messageId;
  }

  void emit(Map<String, dynamic> envelope) {
    _events.add(envelope);
  }

  @override
  void markRead({
    required String chatId,
    required String messageId,
  }) {
    lastReadChatId = chatId;
    lastReadMessageId = messageId;
  }

  @override
  Future<void> dispose() async {
    await _events.close();
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('chat thread keeps local image bytes after socket echo replaces message',
      () async {
    final socket = _ControllableChatSocketClient();
    final container = ProviderContainer(
      overrides: [
        authBootstrapProvider.overrideWith((ref) async {}),
        currentUserIdProvider.overrideWith((ref) => 'user-me'),
        backendRepositoryProvider.overrideWith(
          (ref) => _FakeChatThreadRepository(ref: ref, dio: Dio()),
        ),
        appAttachmentServiceProvider
            .overrideWith((ref) => _FakeAttachmentService()),
        chatSocketClientProvider.overrideWith((ref) => socket),
      ],
    );
    addTearDown(() async {
      await socket.dispose();
      container.dispose();
    });

    final subscription = container.listen(
      chatThreadProvider('mc1'),
      (_, __) {},
      fireImmediately: true,
    );
    addTearDown(subscription.close);

    final notifier = container.read(chatThreadProvider('mc1').notifier);
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    await notifier.sendAttachment(
      PlatformFile(
        name: 'photo.jpg',
        size: _pngBytes.length,
        bytes: Uint8List.fromList(_pngBytes),
        path: '/tmp/photo.jpg',
      ),
    );

    socket.emit({
      'type': 'message.created',
      'payload': {
        'id': 'server-1',
        'chatId': 'mc1',
        'clientMessageId': socket.lastClientMessageId,
        'senderId': 'user-me',
        'senderName': 'Ты',
        'text': 'photo.jpg',
        'createdAt': '2026-04-20T21:09:00Z',
        'attachments': [
          {
            'id': 'server-a1',
            'kind': 'chat_attachment',
            'status': 'pending',
            'url': null,
            'mimeType': 'image/jpeg',
            'byteSize': _pngBytes.length,
            'fileName': 'photo.jpg',
          },
        ],
      },
    });
    await Future<void>.delayed(Duration.zero);

    final messages = container.read(chatThreadProvider('mc1')).valueOrNull;
    expect(messages, isNotNull);
    expect(messages, hasLength(1));
    expect(messages!.single.attachments.single.localBytes, isNotNull);
  });

  test('chat thread sends reply message and preserves reply preview after echo',
      () async {
    final socket = _ControllableChatSocketClient();
    final container = ProviderContainer(
      overrides: [
        authBootstrapProvider.overrideWith((ref) async {}),
        currentUserIdProvider.overrideWith((ref) => 'user-me'),
        backendRepositoryProvider.overrideWith(
          (ref) => _FakeChatThreadRepository(ref: ref, dio: Dio()),
        ),
        appAttachmentServiceProvider
            .overrideWith((ref) => _FakeAttachmentService()),
        chatSocketClientProvider.overrideWith((ref) => socket),
      ],
    );
    addTearDown(() async {
      await socket.dispose();
      container.dispose();
    });

    final subscription = container.listen(
      chatThreadProvider('mc1'),
      (_, __) {},
      fireImmediately: true,
    );
    addTearDown(subscription.close);

    final notifier = container.read(chatThreadProvider('mc1').notifier);
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    const replyTo = MessageReplyPreview(
      id: 'p1',
      author: 'Аня К',
      text: 'Исходное сообщение',
      isVoice: false,
    );

    await notifier.sendMessage(
      'Отвечаю',
      replyTo: replyTo,
    );

    expect(socket.lastReplyToMessageId, 'p1');

    socket.emit({
      'type': 'message.created',
      'payload': {
        'id': 'server-reply-1',
        'chatId': 'mc1',
        'clientMessageId': socket.lastClientMessageId,
        'senderId': 'user-me',
        'senderName': 'Ты',
        'text': 'Отвечаю',
        'createdAt': '2026-04-21T12:25:00Z',
        'replyTo': {
          'id': 'p1',
          'author': 'Аня К',
          'text': 'Исходное сообщение',
          'isVoice': false,
        },
        'attachments': const [],
      },
    });
    await Future<void>.delayed(Duration.zero);

    final messages = container.read(chatThreadProvider('mc1')).valueOrNull;
    expect(messages, isNotNull);
    expect(messages!.single.replyTo?.id, 'p1');
    expect(messages.single.replyTo?.text, 'Исходное сообщение');
  });

  test(
      'chat thread clears stale meetup override when echo belongs to unknown chat',
      () async {
    final socket = _ControllableChatSocketClient();
    final container = ProviderContainer(
      overrides: [
        authBootstrapProvider.overrideWith((ref) async {}),
        currentUserIdProvider.overrideWith((ref) => 'user-me'),
        backendRepositoryProvider.overrideWith(
          (ref) => _FakeChatThreadRepository(ref: ref, dio: Dio()),
        ),
        appAttachmentServiceProvider
            .overrideWith((ref) => _FakeAttachmentService()),
        chatSocketClientProvider.overrideWith((ref) => socket),
        meetupChatsLocalStateProvider.overrideWith(
          (ref) => const <MeetupChat>[],
        ),
      ],
    );
    addTearDown(() async {
      await socket.dispose();
      container.dispose();
    });

    final subscription = container.listen(
      chatThreadProvider('evening-chat-new'),
      (_, __) {},
      fireImmediately: true,
    );
    addTearDown(subscription.close);

    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    socket.emit({
      'type': 'message.created',
      'payload': {
        'id': 'server-new-1',
        'chatId': 'evening-chat-new',
        'clientMessageId': 'server-new-1',
        'senderId': 'user-me',
        'senderName': 'Ты',
        'text': 'Я на месте',
        'createdAt': '2026-04-21T12:30:00Z',
        'attachments': const [],
      },
    });
    await Future<void>.delayed(Duration.zero);

    expect(container.read(meetupChatsLocalStateProvider), isNull);
  });

  test('chat thread requests sync from last fetched realtime event id',
      () async {
    final socket = _ControllableChatSocketClient();
    final container = ProviderContainer(
      overrides: [
        authBootstrapProvider.overrideWith((ref) async {}),
        currentUserIdProvider.overrideWith((ref) => 'user-me'),
        backendRepositoryProvider.overrideWith(
          (ref) => _FakeChatThreadRepository(
            ref: ref,
            dio: Dio(),
            lastEventId: '77',
          ),
        ),
        appAttachmentServiceProvider
            .overrideWith((ref) => _FakeAttachmentService()),
        chatSocketClientProvider.overrideWith((ref) => socket),
      ],
    );
    addTearDown(() async {
      await socket.dispose();
      container.dispose();
    });

    final subscription = container.listen(
      chatThreadProvider('mc1'),
      (_, __) {},
      fireImmediately: true,
    );
    addTearDown(subscription.close);

    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    expect(socket.lastRequestedSyncChatId, 'mc1');
    expect(socket.lastRequestedSyncCursor, '77');
  });

  test('chat thread requests next sync page when snapshot has more events',
      () async {
    final socket = _ControllableChatSocketClient();
    final container = ProviderContainer(
      overrides: [
        authBootstrapProvider.overrideWith((ref) async {}),
        currentUserIdProvider.overrideWith((ref) => 'user-me'),
        backendRepositoryProvider.overrideWith(
          (ref) => _FakeChatThreadRepository(ref: ref, dio: Dio()),
        ),
        appAttachmentServiceProvider
            .overrideWith((ref) => _FakeAttachmentService()),
        chatSocketClientProvider.overrideWith((ref) => socket),
      ],
    );
    addTearDown(() async {
      await socket.dispose();
      container.dispose();
    });

    final subscription = container.listen(
      chatThreadProvider('mc1'),
      (_, __) {},
      fireImmediately: true,
    );
    addTearDown(subscription.close);

    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    socket.emit({
      'type': 'sync.snapshot',
      'payload': {
        'chatId': 'mc1',
        'hasMore': true,
        'nextEventId': '99',
        'events': [
          {
            'id': '99',
            'type': 'message.created',
            'payload': {
              'id': 'server-sync-1',
              'chatId': 'mc1',
              'clientMessageId': 'sync-1',
              'senderId': 'user-anya',
              'senderName': 'Аня',
              'text': 'Из первой пачки',
              'createdAt': '2026-04-21T12:11:00Z',
              'attachments': const [],
            },
          },
        ],
      },
    });
    await Future<void>.delayed(Duration.zero);

    expect(socket.lastRememberedSyncCursor, '99');
    expect(socket.lastRequestedSyncChatId, 'mc1');
    expect(socket.lastRequestedSyncCursor, '99');
  });

  test(
      'chat thread sends voice message with empty text and preserves local voice metadata after echo',
      () async {
    final socket = _ControllableChatSocketClient();
    late _FakeChatThreadRepository repository;
    final container = ProviderContainer(
      overrides: [
        authBootstrapProvider.overrideWith((ref) async {}),
        currentUserIdProvider.overrideWith((ref) => 'user-me'),
        backendRepositoryProvider.overrideWith((ref) {
          repository = _FakeChatThreadRepository(ref: ref, dio: Dio());
          return repository;
        }),
        appAttachmentServiceProvider
            .overrideWith((ref) => _FakeAttachmentService()),
        chatSocketClientProvider.overrideWith((ref) => socket),
      ],
    );
    addTearDown(() async {
      await socket.dispose();
      container.dispose();
    });

    final subscription = container.listen(
      chatThreadProvider('mc1'),
      (_, __) {},
      fireImmediately: true,
    );
    addTearDown(subscription.close);

    final notifier = container.read(chatThreadProvider('mc1').notifier);
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    await notifier.sendVoiceMessage(
      RecordedVoiceDraft(
        file: PlatformFile(
          name: 'voice.m4a',
          size: 2048,
          path: '/tmp/voice.m4a',
        ),
        duration: const Duration(seconds: 7),
        waveform: const [0.3, 0.6, 0.4, 0.8],
      ),
    );

    expect(repository.voiceUploadCalls, 1);
    expect(repository.lastVoiceChatId, 'mc1');
    expect(repository.lastVoiceDurationMs, 7000);
    expect(repository.lastVoiceFileName, 'voice.m4a');
    expect(socket.lastText, '');
    expect(socket.lastAttachmentIds, ['voice-asset-1']);

    var messages = container.read(chatThreadProvider('mc1')).valueOrNull;
    expect(messages, isNotNull);
    expect(messages, hasLength(1));
    expect(messages!.single.attachments.single.kind, 'chat_voice');
    expect(messages.single.attachments.single.durationMs, 7000);
    expect(messages.single.attachments.single.waveform, isNotEmpty);
    expect(messages.single.attachments.single.localPath, '/tmp/voice.m4a');

    socket.emit({
      'type': 'message.created',
      'payload': {
        'id': 'server-voice-1',
        'chatId': 'mc1',
        'clientMessageId': socket.lastClientMessageId,
        'senderId': 'user-me',
        'senderName': 'Ты',
        'text': '',
        'createdAt': '2026-04-21T12:00:00Z',
        'attachments': [
          {
            'id': 'server-voice-a1',
            'kind': 'chat_voice',
            'status': 'ready',
            'url': 'https://example.com/voice.m4a',
            'mimeType': 'audio/mp4',
            'byteSize': 2048,
            'fileName': 'voice.m4a',
            'durationMs': 7000,
          },
        ],
      },
    });
    await Future<void>.delayed(Duration.zero);

    messages = container.read(chatThreadProvider('mc1')).valueOrNull;
    expect(messages, isNotNull);
    expect(messages, hasLength(1));
    expect(messages!.single.attachments.single.url,
        'https://example.com/voice.m4a');
    expect(messages.single.attachments.single.localPath, '/tmp/voice.m4a');
    expect(messages.single.attachments.single.waveform, isNotEmpty);
    expect(messages.single.attachments.single.durationMs, 7000);
  });

  test('chat thread warms remote voice attachments in cache after initial load',
      () async {
    final socket = _ControllableChatSocketClient();
    final attachmentService = _FakeAttachmentService();
    final fetchedMessages = [
      Message.fromJson(
        {
          'id': 'server-voice-1',
          'chatId': 'mc1',
          'clientMessageId': 'server-voice-1',
          'senderId': 'user-sonya',
          'senderName': 'Соня',
          'text': '',
          'createdAt': '2026-04-21T12:00:00Z',
          'attachments': [
            {
              'id': 'server-voice-a1',
              'kind': 'chat_voice',
              'status': 'ready',
              'url': 'https://example.com/voice.m4a',
              'mimeType': 'audio/mp4',
              'byteSize': 2048,
              'fileName': 'voice.m4a',
              'durationMs': 7000,
            },
          ],
        },
        currentUserId: 'user-me',
      ),
    ];

    final container = ProviderContainer(
      overrides: [
        authBootstrapProvider.overrideWith((ref) async {}),
        currentUserIdProvider.overrideWith((ref) => 'user-me'),
        backendRepositoryProvider.overrideWith(
          (ref) => _FakeChatThreadRepository(
            ref: ref,
            dio: Dio(),
            fetchedMessages: fetchedMessages,
          ),
        ),
        appAttachmentServiceProvider.overrideWith((ref) => attachmentService),
        chatSocketClientProvider.overrideWith((ref) => socket),
      ],
    );
    addTearDown(() async {
      await socket.dispose();
      container.dispose();
    });

    final subscription = container.listen(
      chatThreadProvider('mc1'),
      (_, __) {},
      fireImmediately: true,
    );
    addTearDown(subscription.close);

    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    expect(attachmentService.warmedAttachmentIds, ['server-voice-a1']);
  });

  test('chat thread marks incoming message as read through socket only',
      () async {
    final socket = _ControllableChatSocketClient();
    late _FakeChatThreadRepository repository;
    final container = ProviderContainer(
      overrides: [
        authBootstrapProvider.overrideWith((ref) async {}),
        currentUserIdProvider.overrideWith((ref) => 'user-me'),
        backendRepositoryProvider.overrideWith((ref) {
          repository = _FakeChatThreadRepository(ref: ref, dio: Dio());
          return repository;
        }),
        appAttachmentServiceProvider
            .overrideWith((ref) => _FakeAttachmentService()),
        chatSocketClientProvider.overrideWith((ref) => socket),
      ],
    );
    addTearDown(() async {
      await socket.dispose();
      container.dispose();
    });

    final subscription = container.listen(
      chatThreadProvider('mc1'),
      (_, __) {},
      fireImmediately: true,
    );
    addTearDown(subscription.close);

    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    socket.emit({
      'type': 'message.created',
      'payload': {
        'id': 'server-read-1',
        'chatId': 'mc1',
        'clientMessageId': 'incoming-1',
        'senderId': 'user-anya',
        'senderName': 'Аня',
        'text': 'Привет',
        'createdAt': '2026-04-21T12:10:00Z',
        'attachments': const [],
      },
    });
    await Future<void>.delayed(const Duration(milliseconds: 300));

    expect(socket.lastReadChatId, 'mc1');
    expect(socket.lastReadMessageId, 'server-read-1');
    expect(repository.markReadCalls, 0);
  });

  test('chat thread remembers latest sync cursor from snapshot and live events',
      () async {
    final socket = _ControllableChatSocketClient();
    final container = ProviderContainer(
      overrides: [
        authBootstrapProvider.overrideWith((ref) async {}),
        currentUserIdProvider.overrideWith((ref) => 'user-me'),
        backendRepositoryProvider.overrideWith(
          (ref) => _FakeChatThreadRepository(ref: ref, dio: Dio()),
        ),
        appAttachmentServiceProvider
            .overrideWith((ref) => _FakeAttachmentService()),
        chatSocketClientProvider.overrideWith((ref) => socket),
      ],
    );
    addTearDown(() async {
      await socket.dispose();
      container.dispose();
    });

    final subscription = container.listen(
      chatThreadProvider('mc1'),
      (_, __) {},
      fireImmediately: true,
    );
    addTearDown(subscription.close);

    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    socket.emit({
      'type': 'sync.snapshot',
      'payload': {
        'chatId': 'mc1',
        'events': [
          {
            'id': '99',
            'type': 'message.created',
            'payload': {
              'id': 'server-sync-1',
              'chatId': 'mc1',
              'clientMessageId': 'sync-1',
              'senderId': 'user-anya',
              'senderName': 'Аня',
              'text': 'Из снапшота',
              'createdAt': '2026-04-21T12:11:00Z',
              'attachments': const [],
            },
          },
        ],
      },
    });
    await Future<void>.delayed(Duration.zero);

    expect(socket.lastRememberedSyncChatId, 'mc1');
    expect(socket.lastRememberedSyncCursor, '99');

    socket.emit({
      'type': 'message.created',
      'payload': {
        'id': 'server-live-1',
        'chatId': 'mc1',
        'clientMessageId': 'live-1',
        'senderId': 'user-anya',
        'senderName': 'Аня',
        'text': 'Живое',
        'createdAt': '2026-04-21T12:12:00Z',
        'eventId': '100',
        'attachments': const [],
      },
    });
    await Future<void>.delayed(Duration.zero);

    expect(socket.lastRememberedSyncChatId, 'mc1');
    expect(socket.lastRememberedSyncCursor, '100');
  });

  test('chat thread reloads messages after sync reset snapshot', () async {
    final socket = _ControllableChatSocketClient();
    late _SequentialChatThreadRepository repository;
    final oldMessage = Message.fromJson(
      {
        'id': 'old-message',
        'chatId': 'mc1',
        'clientMessageId': 'old-message',
        'senderId': 'user-anya',
        'senderName': 'Аня',
        'text': 'До reset',
        'createdAt': '2026-04-21T12:00:00Z',
        'attachments': const [],
      },
      currentUserId: 'user-me',
    );
    final freshMessage = Message.fromJson(
      {
        'id': 'fresh-message',
        'chatId': 'mc1',
        'clientMessageId': 'fresh-message',
        'senderId': 'user-anya',
        'senderName': 'Аня',
        'text': 'После reset',
        'createdAt': '2026-04-21T12:05:00Z',
        'attachments': const [],
      },
      currentUserId: 'user-me',
    );
    final container = ProviderContainer(
      overrides: [
        authBootstrapProvider.overrideWith((ref) async {}),
        currentUserIdProvider.overrideWith((ref) => 'user-me'),
        backendRepositoryProvider.overrideWith(
          (ref) {
            repository = _SequentialChatThreadRepository(
              ref: ref,
              dio: Dio(),
              responses: [
                PaginatedResponse(
                  items: [oldMessage],
                  nextCursor: null,
                  lastEventId: 'event-old',
                ),
                PaginatedResponse(
                  items: [freshMessage],
                  nextCursor: null,
                  lastEventId: 'event-fresh',
                ),
              ],
            );
            return repository;
          },
        ),
        appAttachmentServiceProvider
            .overrideWith((ref) => _FakeAttachmentService()),
        chatSocketClientProvider.overrideWith((ref) => socket),
      ],
    );
    addTearDown(() async {
      await socket.dispose();
      container.dispose();
    });

    final subscription = container.listen(
      chatThreadProvider('mc1'),
      (_, __) {},
      fireImmediately: true,
    );
    addTearDown(subscription.close);

    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    expect(
      container.read(chatThreadProvider('mc1')).valueOrNull?.single.text,
      'До reset',
    );

    socket.emit({
      'type': 'sync.snapshot',
      'payload': {
        'chatId': 'mc1',
        'reset': true,
        'events': const [],
      },
    });
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    expect(repository.fetchMessagesCalls, 2);
    expect(
      container.read(chatThreadProvider('mc1')).valueOrNull?.single.text,
      'После reset',
    );
    expect(socket.lastRememberedSyncChatId, 'mc1');
    expect(socket.lastRememberedSyncCursor, 'event-fresh');
    expect(socket.lastRequestedSyncChatId, 'mc1');
    expect(socket.lastRequestedSyncCursor, 'event-fresh');
  });

  test(
      'chat thread exposes empty list immediately while initial fetch is pending',
      () async {
    final socket = _ControllableChatSocketClient();
    final completer = Completer<PaginatedResponse<Message>>();
    final container = ProviderContainer(
      overrides: [
        authBootstrapProvider.overrideWith((ref) async {}),
        currentUserIdProvider.overrideWith((ref) => 'user-me'),
        backendRepositoryProvider.overrideWith(
          (ref) => _DelayedChatThreadRepository(
            ref: ref,
            dio: Dio(),
            completer: completer,
          ),
        ),
        appAttachmentServiceProvider
            .overrideWith((ref) => _FakeAttachmentService()),
        chatSocketClientProvider.overrideWith((ref) => socket),
      ],
    );
    addTearDown(() async {
      await socket.dispose();
      container.dispose();
    });

    final subscription = container.listen(
      chatThreadProvider('mc1'),
      (_, __) {},
      fireImmediately: true,
    );
    addTearDown(subscription.close);

    await Future<void>.delayed(Duration.zero);

    expect(
      container.read(chatThreadProvider('mc1')).valueOrNull,
      isEmpty,
    );
  });

  test('chat thread edits my message locally and sends edit command', () async {
    final socket = _ControllableChatSocketClient();
    final fetchedMessages = [
      Message.fromJson(
        {
          'id': 'server-edit-1',
          'chatId': 'mc1',
          'clientMessageId': 'server-edit-1',
          'senderId': 'user-me',
          'senderName': 'Ты',
          'text': 'Старый текст',
          'createdAt': '2026-04-21T12:00:00Z',
          'attachments': const [],
        },
        currentUserId: 'user-me',
      ),
    ];
    final container = ProviderContainer(
      overrides: [
        authBootstrapProvider.overrideWith((ref) async {}),
        currentUserIdProvider.overrideWith((ref) => 'user-me'),
        backendRepositoryProvider.overrideWith(
          (ref) => _FakeChatThreadRepository(
            ref: ref,
            dio: Dio(),
            fetchedMessages: fetchedMessages,
          ),
        ),
        appAttachmentServiceProvider
            .overrideWith((ref) => _FakeAttachmentService()),
        chatSocketClientProvider.overrideWith((ref) => socket),
      ],
    );
    addTearDown(() async {
      await socket.dispose();
      container.dispose();
    });

    final subscription = container.listen(
      chatThreadProvider('mc1'),
      (_, __) {},
      fireImmediately: true,
    );
    addTearDown(subscription.close);

    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    final notifier = container.read(chatThreadProvider('mc1').notifier);
    await notifier.editMessage(
      fetchedMessages.single,
      '  Новый текст  ',
    );

    expect(socket.lastEditedMessageId, 'server-edit-1');
    expect(socket.lastEditedText, 'Новый текст');
    expect(
      container.read(chatThreadProvider('mc1')).valueOrNull?.single.text,
      'Новый текст',
    );
  });

  test('chat thread removes my message locally and sends delete command',
      () async {
    final socket = _ControllableChatSocketClient();
    final fetchedMessages = [
      Message.fromJson(
        {
          'id': 'server-delete-1',
          'chatId': 'mc1',
          'clientMessageId': 'server-delete-1',
          'senderId': 'user-me',
          'senderName': 'Ты',
          'text': 'Удалить меня',
          'createdAt': '2026-04-21T12:00:00Z',
          'attachments': const [],
        },
        currentUserId: 'user-me',
      ),
    ];
    final container = ProviderContainer(
      overrides: [
        authBootstrapProvider.overrideWith((ref) async {}),
        currentUserIdProvider.overrideWith((ref) => 'user-me'),
        backendRepositoryProvider.overrideWith(
          (ref) => _FakeChatThreadRepository(
            ref: ref,
            dio: Dio(),
            fetchedMessages: fetchedMessages,
          ),
        ),
        appAttachmentServiceProvider
            .overrideWith((ref) => _FakeAttachmentService()),
        chatSocketClientProvider.overrideWith((ref) => socket),
      ],
    );
    addTearDown(() async {
      await socket.dispose();
      container.dispose();
    });

    final subscription = container.listen(
      chatThreadProvider('mc1'),
      (_, __) {},
      fireImmediately: true,
    );
    addTearDown(subscription.close);

    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    final notifier = container.read(chatThreadProvider('mc1').notifier);
    await notifier.deleteMessage(fetchedMessages.single);

    expect(socket.lastDeletedMessageId, 'server-delete-1');
    expect(container.read(chatThreadProvider('mc1')).valueOrNull, isEmpty);
  });

  test('chat thread patches meetup summary locally after last message delete',
      () async {
    final socket = _ControllableChatSocketClient();
    final fetchedMessages = [
      Message.fromJson(
        {
          'id': 'server-older-1',
          'chatId': 'mc1',
          'clientMessageId': 'server-older-1',
          'senderId': 'user-anya',
          'senderName': 'Аня',
          'text': 'Предыдущее',
          'createdAt': '2026-04-21T12:00:00Z',
          'attachments': const [],
        },
        currentUserId: 'user-me',
      ),
      Message.fromJson(
        {
          'id': 'server-delete-1',
          'chatId': 'mc1',
          'clientMessageId': 'server-delete-1',
          'senderId': 'user-me',
          'senderName': 'Ты',
          'text': 'Удалить меня',
          'createdAt': '2026-04-21T12:01:00Z',
          'attachments': const [],
        },
        currentUserId: 'user-me',
      ),
    ];
    final container = ProviderContainer(
      overrides: [
        authBootstrapProvider.overrideWith((ref) async {}),
        currentUserIdProvider.overrideWith((ref) => 'user-me'),
        backendRepositoryProvider.overrideWith(
          (ref) => _FakeChatThreadRepository(
            ref: ref,
            dio: Dio(),
            fetchedMessages: fetchedMessages,
          ),
        ),
        appAttachmentServiceProvider
            .overrideWith((ref) => _FakeAttachmentService()),
        chatSocketClientProvider.overrideWith((ref) => socket),
        meetupChatsLocalStateProvider.overrideWith(
          (ref) => const [
            MeetupChat(
              id: 'mc1',
              eventId: 'event-1',
              title: 'Встреча',
              emoji: '🍷',
              time: '20:00',
              lastMessage: 'Удалить меня',
              lastAuthor: 'Ты',
              lastTime: '15:01',
              unread: 3,
              members: ['Аня', 'Ты'],
              status: 'Сегодня',
              typing: true,
            ),
          ],
        ),
      ],
    );
    addTearDown(() async {
      await socket.dispose();
      container.dispose();
    });

    final subscription = container.listen(
      chatThreadProvider('mc1'),
      (_, __) {},
      fireImmediately: true,
    );
    addTearDown(subscription.close);

    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    socket.emit({
      'type': 'message.deleted',
      'payload': {
        'chatId': 'mc1',
        'messageId': 'server-delete-1',
        'eventId': 'event-delete-1',
      },
    });
    await Future<void>.delayed(Duration.zero);

    final messages = container.read(chatThreadProvider('mc1')).valueOrNull;
    expect(messages, hasLength(1));
    expect(messages!.single.id, 'server-older-1');

    final meetupChats = container.read(meetupChatsLocalStateProvider);
    expect(meetupChats, isNotNull);
    expect(meetupChats!.single.lastMessage, 'Предыдущее');
    expect(meetupChats.single.lastAuthor, 'Аня');
    expect(meetupChats.single.unread, 0);
    expect(meetupChats.single.typing, isFalse);
  });

  test('chat thread applies realtime message updated and deleted events',
      () async {
    final socket = _ControllableChatSocketClient();
    final fetchedMessages = [
      Message.fromJson(
        {
          'id': 'server-live-1',
          'chatId': 'mc1',
          'clientMessageId': 'server-live-1',
          'senderId': 'user-anya',
          'senderName': 'Аня',
          'text': 'До правки',
          'createdAt': '2026-04-21T12:00:00Z',
          'attachments': const [],
        },
        currentUserId: 'user-me',
      ),
    ];
    final container = ProviderContainer(
      overrides: [
        authBootstrapProvider.overrideWith((ref) async {}),
        currentUserIdProvider.overrideWith((ref) => 'user-me'),
        backendRepositoryProvider.overrideWith(
          (ref) => _FakeChatThreadRepository(
            ref: ref,
            dio: Dio(),
            fetchedMessages: fetchedMessages,
          ),
        ),
        appAttachmentServiceProvider
            .overrideWith((ref) => _FakeAttachmentService()),
        chatSocketClientProvider.overrideWith((ref) => socket),
      ],
    );
    addTearDown(() async {
      await socket.dispose();
      container.dispose();
    });

    final subscription = container.listen(
      chatThreadProvider('mc1'),
      (_, __) {},
      fireImmediately: true,
    );
    addTearDown(subscription.close);

    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    socket.emit({
      'type': 'message.updated',
      'payload': {
        'id': 'server-live-1',
        'chatId': 'mc1',
        'clientMessageId': 'server-live-1',
        'senderId': 'user-anya',
        'senderName': 'Аня',
        'text': 'После правки',
        'createdAt': '2026-04-21T12:00:00Z',
        'attachments': const [],
      },
    });
    await Future<void>.delayed(Duration.zero);

    expect(
      container.read(chatThreadProvider('mc1')).valueOrNull?.single.text,
      'После правки',
    );

    socket.emit({
      'type': 'message.deleted',
      'payload': {
        'chatId': 'mc1',
        'messageId': 'server-live-1',
        'senderId': 'user-anya',
      },
    });
    await Future<void>.delayed(Duration.zero);

    expect(container.read(chatThreadProvider('mc1')).valueOrNull, isEmpty);
  });
}

const _pngBytes = <int>[
  0x89,
  0x50,
  0x4E,
  0x47,
  0x0D,
  0x0A,
  0x1A,
  0x0A,
  0x00,
  0x00,
  0x00,
  0x0D,
  0x49,
  0x48,
  0x44,
  0x52,
  0x00,
  0x00,
  0x00,
  0x01,
  0x00,
  0x00,
  0x00,
  0x01,
  0x08,
  0x06,
  0x00,
  0x00,
  0x00,
  0x1F,
  0x15,
  0xC4,
  0x89,
  0x00,
  0x00,
  0x00,
  0x0D,
  0x49,
  0x44,
  0x41,
  0x54,
  0x78,
  0x9C,
  0x63,
  0xF8,
  0xCF,
  0xC0,
  0x00,
  0x00,
  0x03,
  0x01,
  0x01,
  0x00,
  0x18,
  0xDD,
  0x8D,
  0xB1,
  0x00,
  0x00,
  0x00,
  0x00,
  0x49,
  0x45,
  0x4E,
  0x44,
  0xAE,
  0x42,
  0x60,
  0x82,
];

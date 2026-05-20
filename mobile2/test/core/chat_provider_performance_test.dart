import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile2/app/core/local_cache/app_local_database.dart';
import 'package:mobile2/app/core/local_cache/chat_local_store.dart';
import 'package:mobile2/app/core/network/chat_socket_client.dart';
import 'package:mobile2/app/core/providers/core_providers.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/data/backend_repository.dart';
import 'package:mobile2/shared/models/backend_models.dart';

void main() {
  late AppLocalDatabase database;
  late ChatLocalStore chatStore;

  setUp(() {
    database = AppLocalDatabase.forTesting(NativeDatabase.memory());
    chatStore = ChatLocalStore(database);
  });

  tearDown(() async {
    await database.close();
  });

  test('chat messages wait for REST when local cache is empty', () async {
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          if (options.path == '/chats/chat-1/messages') {
            return _jsonResponse(options, {
              'currentUserId': 'u1',
              'items': [
                {
                  'id': 'm1',
                  'chatId': 'chat-1',
                  'senderId': 'u2',
                  'senderName': 'Nina',
                  'text': 'Fresh message',
                  'createdAt': '2026-05-19T09:00:00.000Z',
                },
              ],
              'nextCursor': null,
            });
          }
          if (options.path == '/chats/chat-1/read') {
            return _jsonResponse(options, {'ok': true});
          }
          return _jsonResponse(options, {});
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        chatLocalStoreProvider.overrideWithValue(chatStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);

    final firstData = Completer<List<BackendChatMessage>>();
    final subscription = container.listen(
      chatMessagesProvider('chat-1'),
      (_, next) {
        final messages = next.valueOrNull;
        if (messages != null && !firstData.isCompleted) {
          firstData.complete(messages);
        }
      },
      fireImmediately: true,
    );
    addTearDown(subscription.close);

    final messages = await firstData.future.timeout(
      const Duration(seconds: 2),
    );

    expect(messages, hasLength(1));
    expect(messages.single.id, 'm1');
    expect(messages.single.text, 'Fresh message');
  });

  test('chat messages emit cached recent messages before slow REST', () async {
    await chatStore.upsertMessages(
      userId: 'u1',
      chatId: 'chat-1',
      messages: [
        {
          'id': 'cached-message',
          'chatId': 'chat-1',
          'senderId': 'u2',
          'senderName': 'Nina',
          'text': 'Cached message',
          'createdAt': '2026-05-19T09:00:00.000Z',
        },
      ],
    );
    final releaseRefresh = Completer<void>();
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          if (options.path == '/chats/chat-1/messages') {
            await releaseRefresh.future;
            return _jsonResponse(options, {
              'currentUserId': 'u1',
              'items': [
                {
                  'id': 'fresh-message',
                  'chatId': 'chat-1',
                  'senderId': 'u2',
                  'senderName': 'Nina',
                  'text': 'Fresh message',
                  'createdAt': '2026-05-19T09:01:00.000Z',
                },
              ],
              'nextCursor': null,
            });
          }
          if (options.path == '/chats/chat-1/read') {
            return _jsonResponse(options, {'ok': true});
          }
          return _jsonResponse(options, {});
        }),
    );
    addTearDown(() {
      if (!releaseRefresh.isCompleted) {
        releaseRefresh.complete();
      }
    });
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        chatLocalStoreProvider.overrideWithValue(chatStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);

    final firstData = Completer<List<BackendChatMessage>>();
    final subscription = container.listen(
      chatMessagesProvider('chat-1'),
      (_, next) {
        final messages = next.valueOrNull;
        if (messages != null && !firstData.isCompleted) {
          firstData.complete(messages);
        }
      },
      fireImmediately: true,
    );
    addTearDown(subscription.close);

    final messages = await firstData.future.timeout(
      const Duration(milliseconds: 200),
    );

    expect(messages.map((message) => message.id), ['cached-message']);
    releaseRefresh.complete();
  });

  test('combined chat list emits ready cached kind before slow kind', () async {
    await chatStore.replaceSummaries(
      userId: 'u1',
      kind: 'meetups',
      summaries: [
        {
          'id': 'meetup-1',
          'title': 'Meetup chat',
          'kind': 'meetup',
        },
      ],
    );
    final releasePersonal = Completer<void>();
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          if (options.path == '/chats/personal') {
            await releasePersonal.future;
          }
          return _jsonResponse(options, {'items': <Object?>[]});
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        chatLocalStoreProvider.overrideWithValue(chatStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);

    final firstPage = Completer<BackendPage<BackendChatSummary>>();
    final subscription = container.listen(
      chatListProvider(ChatListKind.all),
      (_, next) {
        final page = next.valueOrNull;
        if (page != null && !firstPage.isCompleted) {
          firstPage.complete(page);
        }
      },
      fireImmediately: true,
    );
    addTearDown(subscription.close);

    final page = await firstPage.future.timeout(
      const Duration(milliseconds: 200),
    );

    expect(page.items.map((item) => item.id), ['meetup-1']);
    releasePersonal.complete();
  });

  test('personal chat list emits cached summaries before slow REST refresh',
      () async {
    await chatStore.replaceSummaries(
      userId: 'u1',
      kind: 'personal',
      summaries: [
        {
          'id': 'personal-1',
          'title': 'Nina',
          'kind': 'personal',
          'unreadCount': 1,
        },
      ],
    );
    final releasePersonal = Completer<void>();
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          if (options.path == '/chats/personal') {
            await releasePersonal.future;
          }
          return _jsonResponse(options, {
            'items': [
              {
                'id': 'personal-2',
                'title': 'Maya',
                'kind': 'personal',
              },
            ],
          });
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        chatLocalStoreProvider.overrideWithValue(chatStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);

    final firstPage = Completer<BackendPage<BackendChatSummary>>();
    final subscription = container.listen(
      chatListProvider(ChatListKind.personal),
      (_, next) {
        final page = next.valueOrNull;
        if (page != null && !firstPage.isCompleted) {
          firstPage.complete(page);
        }
      },
      fireImmediately: true,
    );
    addTearDown(subscription.close);

    final page = await firstPage.future.timeout(
      const Duration(milliseconds: 200),
    );

    expect(page.items.single.id, 'personal-1');
    expect(page.items.single.kind, 'personal');
    expect(page.items.single.unreadCount, 1);

    releasePersonal.complete();
  });

  test('all chat list renders cached personal and meetup summaries first',
      () async {
    await chatStore.replaceSummaries(
      userId: 'u1',
      kind: 'meetups',
      summaries: [
        {
          'id': 'meetup-1',
          'title': 'Coffee meetup',
          'kind': 'meetup',
        },
      ],
    );
    await chatStore.replaceSummaries(
      userId: 'u1',
      kind: 'personal',
      summaries: [
        {
          'id': 'personal-1',
          'title': 'Nina',
          'kind': 'personal',
        },
      ],
    );
    final releaseRefresh = Completer<void>();
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          if (options.path == '/chats/meetups' ||
              options.path == '/chats/personal') {
            await releaseRefresh.future;
          }
          return _jsonResponse(options, {'items': <Object?>[]});
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        chatLocalStoreProvider.overrideWithValue(chatStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);

    final firstPage = Completer<BackendPage<BackendChatSummary>>();
    final subscription = container.listen(
      chatListProvider(ChatListKind.all),
      (_, next) {
        final page = next.valueOrNull;
        if (page != null && page.items.length == 2 && !firstPage.isCompleted) {
          firstPage.complete(page);
        }
      },
      fireImmediately: true,
    );
    addTearDown(subscription.close);

    final page = await firstPage.future.timeout(
      const Duration(milliseconds: 200),
    );

    expect(
        page.items.map((item) => item.id),
        containsAll([
          'meetup-1',
          'personal-1',
        ]));
    expect(
        page.items.map((item) => item.kind),
        containsAll([
          'meetup',
          'personal',
        ]));

    releaseRefresh.complete();
  });

  test('chat list REST refresh replaces cached summaries', () async {
    await chatStore.replaceSummaries(
      userId: 'u1',
      kind: 'meetups',
      summaries: [
        {
          'id': 'meetup-old',
          'title': 'Old meetup',
          'kind': 'meetup',
        },
      ],
    );
    final releaseRefresh = Completer<void>();
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          if (options.path == '/chats/meetups') {
            await releaseRefresh.future;
            return _jsonResponse(options, {
              'items': [
                {
                  'id': 'meetup-new',
                  'title': 'Fresh meetup',
                  'kind': 'meetup',
                },
              ],
            });
          }
          return _jsonResponse(options, {'items': <Object?>[]});
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        chatLocalStoreProvider.overrideWithValue(chatStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);

    final pages = <BackendPage<BackendChatSummary>>[];
    final freshPage = Completer<BackendPage<BackendChatSummary>>();
    final subscription = container.listen(
      chatListProvider(ChatListKind.meetups),
      (_, next) {
        final page = next.valueOrNull;
        if (page == null) {
          return;
        }
        pages.add(page);
        if (page.items.any((item) => item.id == 'meetup-new') &&
            !freshPage.isCompleted) {
          freshPage.complete(page);
        }
      },
      fireImmediately: true,
    );
    addTearDown(subscription.close);

    await Future<void>.delayed(Duration.zero);
    expect(pages.first.items.single.id, 'meetup-old');

    releaseRefresh.complete();
    final refreshed = await freshPage.future.timeout(
      const Duration(milliseconds: 500),
    );

    expect(refreshed.items.map((item) => item.id), ['meetup-new']);
    expect(
      await chatStore.watchSummaries(userId: 'u1', kind: 'meetups').first,
      [
        containsPair('id', 'meetup-new'),
      ],
    );
  });

  test('chat list realtime waits until visible ids are loaded', () async {
    final releaseList = Completer<void>();
    var socketStarts = 0;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          if (options.path == '/chats/meetups') {
            await releaseList.future;
            return _jsonResponse(options, {
              'items': [
                {
                  'id': 'chat-1',
                  'title': 'Coffee meetup',
                  'kind': 'meetup',
                },
              ],
            });
          }
          return _jsonResponse(options, {'items': <Object?>[]});
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        chatLocalStoreProvider.overrideWithValue(chatStore),
        initialAuthTokensProvider.overrideWithValue(
          const AuthTokens(accessToken: 'access', refreshToken: 'refresh'),
        ),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
        chatSocketTransportFactoryProvider.overrideWithValue((_) {
          socketStarts += 1;
          return _FakeChatTransport();
        }),
      ],
    );
    addTearDown(container.dispose);

    final realtimeSubscription = container.listen(
      chatListRealtimeProvider(ChatListKind.meetups),
      (_, __) {},
      fireImmediately: true,
    );
    addTearDown(realtimeSubscription.close);

    await Future<void>.delayed(Duration.zero);
    expect(
        container.read(chatListRealtimeProvider(ChatListKind.meetups)), isNull);
    expect(socketStarts, 0);

    releaseList.complete();
    await container.read(chatListProvider(ChatListKind.meetups).future);
    await _waitForValue(() => socketStarts == 1);

    expect(
      container.read(chatListRealtimeProvider(ChatListKind.meetups)),
      isNotNull,
    );
  });

  test('chat list realtime subscriptions are capped', () async {
    await chatStore.replaceSummaries(
      userId: 'u1',
      kind: 'meetups',
      summaries: List.generate(60, (index) {
        return {
          'id': 'chat-${index.toString().padLeft(2, '0')}',
          'title': 'Chat $index',
          'kind': 'meetup',
        };
      }),
    );
    _FakeChatTransport? transport;
    final releaseRefresh = Completer<void>();
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          if (options.path == '/chats/meetups') {
            await releaseRefresh.future;
          }
          return _jsonResponse(options, {'items': <Object?>[]});
        }),
    );
    addTearDown(() {
      if (!releaseRefresh.isCompleted) {
        releaseRefresh.complete();
      }
    });
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        chatLocalStoreProvider.overrideWithValue(chatStore),
        initialAuthTokensProvider.overrideWithValue(
          const AuthTokens(accessToken: 'access', refreshToken: 'refresh'),
        ),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
        chatSocketTransportFactoryProvider.overrideWithValue((_) {
          transport = _FakeChatTransport();
          return transport!;
        }),
      ],
    );
    addTearDown(container.dispose);

    final realtimeSubscription = container.listen(
      chatListRealtimeProvider(ChatListKind.meetups),
      (_, __) {},
      fireImmediately: true,
    );
    addTearDown(realtimeSubscription.close);

    await _waitForValue(() => transport != null);
    transport!.emit({'type': 'session.authenticated'});
    await _waitForValue(
      () =>
          transport!.sent
              .where((item) => item['type'] == 'chat.subscribe')
              .length ==
          50,
    );

    final subscribedIds = transport!.sent
        .where((item) => item['type'] == 'chat.subscribe')
        .map((item) => (item['payload'] as Map)['chatId'])
        .toList(growable: false);

    expect(subscribedIds, hasLength(50));
    expect(subscribedIds.toSet(), hasLength(50));
    expect(subscribedIds, isNot(contains('chat-59')));
    releaseRefresh.complete();
  });

  test('unread chat list uses cached summary unread counts first', () async {
    await chatStore.replaceSummaries(
      userId: 'u1',
      kind: 'meetups',
      summaries: [
        {
          'id': 'meetup-read',
          'title': 'Read meetup',
          'kind': 'meetup',
          'unreadCount': 0,
        },
        {
          'id': 'meetup-unread',
          'title': 'Unread meetup',
          'kind': 'meetup',
          'unreadCount': 2,
        },
      ],
    );
    await chatStore.replaceSummaries(
      userId: 'u1',
      kind: 'personal',
      summaries: [
        {
          'id': 'personal-read',
          'title': 'Read personal',
          'kind': 'personal',
          'unreadCount': 0,
        },
        {
          'id': 'personal-unread',
          'title': 'Unread personal',
          'kind': 'personal',
          'unreadCount': 1,
        },
      ],
    );
    final releaseRefresh = Completer<void>();
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          if (options.path == '/chats/meetups' ||
              options.path == '/chats/personal') {
            await releaseRefresh.future;
          }
          return _jsonResponse(options, {'items': <Object?>[]});
        }),
    );
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        chatLocalStoreProvider.overrideWithValue(chatStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);

    final firstPage = Completer<BackendPage<BackendChatSummary>>();
    final subscription = container.listen(
      chatListProvider(ChatListKind.unread),
      (_, next) {
        final page = next.valueOrNull;
        if (page != null && page.items.length == 2 && !firstPage.isCompleted) {
          firstPage.complete(page);
        }
      },
      fireImmediately: true,
    );
    addTearDown(subscription.close);

    final page = await firstPage.future.timeout(
      const Duration(milliseconds: 200),
    );

    expect(
      page.items.map((item) => item.id),
      containsAll([
        'meetup-unread',
        'personal-unread',
      ]),
    );
    expect(page.items.every((item) => item.unreadCount > 0), true);
    releaseRefresh.complete();
  });

  test('text sender stores optimistic message as mine', () async {
    final repository =
        BackendRepository(Dio(BaseOptions(baseUrl: 'https://api.test')));
    final container = ProviderContainer(
      overrides: [
        backendRepositoryProvider.overrideWithValue(repository),
        chatLocalStoreProvider.overrideWithValue(chatStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);

    await container.read(chatMessageSenderProvider).sendText(
          chatId: 'chat-1',
          text: 'привет',
        );

    final rows = await chatStore.readRecentMessages(
      userId: 'u1',
      chatId: 'chat-1',
    );

    expect(rows.single['mine'], true);
  });

  test('warm chat snapshot reads the latest bounded message window', () async {
    await chatStore.upsertMessages(
      userId: 'u1',
      chatId: 'chat-1',
      messages: List.generate(70, (index) {
        final padded = index.toString().padLeft(2, '0');
        return {
          'id': 'm$padded',
          'chatId': 'chat-1',
          'senderId': 'u2',
          'text': 'message $padded',
          'createdAt': '2026-05-19T09:$padded:00.000Z',
        };
      }),
    );

    final rows = await chatStore.readRecentMessages(
      userId: 'u1',
      chatId: 'chat-1',
      limit: 20,
    );

    expect(rows, hasLength(20));
    expect(rows.first['id'], 'm50');
    expect(rows.last['id'], 'm69');
  });
}

class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter(this.handle);

  final Future<ResponseBody> Function(RequestOptions options) handle;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) {
    return handle(options);
  }

  @override
  void close({bool force = false}) {}
}

class _FakeChatTransport implements ChatSocketTransport {
  final StreamController<Object?> _controller = StreamController<Object?>();
  final List<Map<String, Object?>> sent = <Map<String, Object?>>[];

  @override
  Stream<Object?> get stream => _controller.stream;

  @override
  void send(String data) {
    final decoded = jsonDecode(data);
    if (decoded is Map) {
      sent.add(decoded.map((key, value) => MapEntry('$key', value)));
    }
  }

  void emit(Map<String, Object?> event) {
    _controller.add(jsonEncode(event));
  }

  @override
  Future<void> close() async {
    await _controller.close();
  }
}

Future<void> _waitForValue(
  bool Function() predicate, {
  Duration timeout = const Duration(seconds: 2),
}) async {
  final deadline = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(deadline)) {
    if (predicate()) {
      return;
    }
    await Future<void>.delayed(const Duration(milliseconds: 10));
  }
  if (!predicate()) {
    throw StateError('Timed out waiting for value');
  }
}

ResponseBody _jsonResponse(RequestOptions options, Object? json) {
  return ResponseBody.fromString(
    jsonEncode(json),
    200,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );
}

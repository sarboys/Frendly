import 'dart:async';
import 'dart:convert';

import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile2/app/core/local_cache/app_local_database.dart';
import 'package:mobile2/app/core/local_cache/chat_local_store.dart';
import 'package:mobile2/app/core/network/chat_socket_client.dart';

void main() {
  late AppLocalDatabase database;
  late ChatLocalStore store;
  late _FakeChatTransport transport;

  setUp(() {
    database = AppLocalDatabase.forTesting(NativeDatabase.memory());
    store = ChatLocalStore(database);
    transport = _FakeChatTransport();
  });

  tearDown(() async {
    await transport.close();
    await database.close();
  });

  test('authenticates, subscribes, syncs and flushes scoped outbox', () async {
    await store.setSyncCursor(userId: 'u1', chatId: 'chat-1', cursor: '7');
    await store.enqueuePendingCommand(
      userId: 'u1',
      commandId: 'cmd-1',
      dedupeKey: 'message.send:chat-1:cmd-1',
      payload: {
        'type': 'message.send',
        'payload': {
          'chatId': 'chat-1',
          'text': 'Hi',
          'clientMessageId': 'cmd-1',
        },
      },
    );
    await store.enqueuePendingCommand(
      userId: 'u1',
      commandId: 'cmd-2',
      dedupeKey: 'message.send:chat-2:cmd-2',
      payload: {
        'type': 'message.send',
        'payload': {
          'chatId': 'chat-2',
          'text': 'No',
          'clientMessageId': 'cmd-2',
        },
      },
    );

    final session = ChatRealtimeSession(
      transport: transport,
      store: store,
      userId: 'u1',
      chatId: 'chat-1',
      accessToken: 'access',
    );

    await session.start();

    expect(transport.sent[0]['type'], 'session.authenticate');
    expect(transport.sent[0]['payload'], {'accessToken': 'access'});
    expect(transport.sent.length, 1);

    transport.emit({'type': 'session.authenticated'});
    await Future<void>.delayed(Duration.zero);

    expect(transport.sent[1]['type'], 'chat.subscribe');
    expect(transport.sent[1]['payload'], {'chatId': 'chat-1'});
    expect(transport.sent[2]['type'], 'sync.request');
    expect(transport.sent[2]['payload'], {
      'chatId': 'chat-1',
      'sinceEventId': '7',
      'limit': 100,
    });
    expect(transport.sent[3]['type'], 'message.send');
    expect((transport.sent[3]['payload'] as Map)['chatId'], 'chat-1');
    expect(transport.sent.length, 4);
  });

  test('stores server ack and removes matching pending command', () async {
    await store.replaceSummaries(
      userId: 'u1',
      kind: 'meetups',
      summaries: [
        {
          'id': 'chat-1',
          'title': 'Coffee',
          'lastMessage': 'Old',
          'unreadCount': 0,
        },
      ],
    );
    await store.enqueuePendingCommand(
      userId: 'u1',
      commandId: 'cmd-1',
      dedupeKey: 'message.send:chat-1:cmd-1',
      payload: {
        'type': 'message.send',
        'payload': {
          'chatId': 'chat-1',
          'text': 'Hi',
          'clientMessageId': 'cmd-1',
        },
      },
    );
    final session = ChatRealtimeSession(
      transport: transport,
      store: store,
      userId: 'u1',
      chatId: 'chat-1',
      accessToken: 'access',
    );

    await session.start();
    transport.emit({'type': 'session.authenticated'});
    await Future<void>.delayed(Duration.zero);
    transport.emit({
      'type': 'message.created',
      'payload': {
        'id': 'm1',
        'chatId': 'chat-1',
        'senderId': 'u1',
        'text': 'Hi',
        'clientMessageId': 'cmd-1',
        'createdAt': '2026-05-19T10:00:00.000Z',
      },
    });
    await Future<void>.delayed(Duration.zero);

    final messages =
        await store.watchRecentMessages(userId: 'u1', chatId: 'chat-1').first;
    final summary =
        await store.watchSummary(userId: 'u1', chatId: 'chat-1').first;
    final commands = await store.pendingCommands(userId: 'u1');

    expect(messages.single['id'], 'm1');
    expect(messages.single['clientMessageId'], 'cmd-1');
    expect(summary?['lastMessage'], 'Hi');
    expect(summary?['preview'], 'Hi');
    expect(summary?['unreadCount'], 0);
    expect(commands, isEmpty);
  });

  test('does not increment unread for current user message echoes', () async {
    await store.replaceSummaries(
      userId: 'u1',
      kind: 'meetups',
      summaries: [
        {
          'id': 'chat-1',
          'title': 'Coffee',
          'lastMessage': 'Old',
          'unreadCount': 2,
        },
      ],
    );
    final session = ChatRealtimeSession(
      transport: transport,
      store: store,
      userId: 'u1',
      chatId: 'chat-1',
      accessToken: 'access',
    );

    await session.start();
    transport.emit({'type': 'session.authenticated'});
    await Future<void>.delayed(Duration.zero);
    transport.emit({
      'type': 'message.created',
      'payload': {
        'id': 'm-own',
        'chatId': 'chat-1',
        'senderId': 'u1',
        'text': 'Own echo',
        'createdAt': '2026-05-19T10:03:00.000Z',
      },
    });
    await Future<void>.delayed(Duration.zero);

    final summary =
        await store.watchSummary(userId: 'u1', chatId: 'chat-1').first;
    final messages =
        await store.watchRecentMessages(userId: 'u1', chatId: 'chat-1').first;

    expect(summary?['lastMessage'], 'Own echo');
    expect(summary?['unreadCount'], 2);
    expect(messages.single['mine'], true);
  });

  test('message updates refresh preview without incrementing unread', () async {
    await store.replaceSummaries(
      userId: 'u1',
      kind: 'meetups',
      summaries: [
        {
          'id': 'chat-1',
          'title': 'Coffee',
          'lastMessage': 'Old',
          'unreadCount': 1,
        },
      ],
    );
    final session = ChatRealtimeSession(
      transport: transport,
      store: store,
      userId: 'u1',
      chatId: 'chat-1',
      accessToken: 'access',
    );

    await session.start();
    transport.emit({'type': 'session.authenticated'});
    await Future<void>.delayed(Duration.zero);
    transport.emit({
      'type': 'message.updated',
      'payload': {
        'id': 'm2',
        'chatId': 'chat-1',
        'senderId': 'u2',
        'text': 'Edited preview',
        'createdAt': '2026-05-19T10:04:00.000Z',
      },
    });
    await Future<void>.delayed(Duration.zero);

    final summary =
        await store.watchSummary(userId: 'u1', chatId: 'chat-1').first;

    expect(summary?['lastMessage'], 'Edited preview');
    expect(summary?['unreadCount'], 1);
  });

  test('applies unread realtime updates to cached chat summary', () async {
    await store.replaceSummaries(
      userId: 'u1',
      kind: 'meetups',
      summaries: [
        {
          'id': 'chat-1',
          'title': 'Coffee',
          'lastMessage': 'Old',
          'unreadCount': 4,
        },
      ],
    );
    final session = ChatRealtimeSession(
      transport: transport,
      store: store,
      userId: 'u1',
      chatId: 'chat-1',
      accessToken: 'access',
    );

    await session.start();
    transport.emit({'type': 'session.authenticated'});
    await Future<void>.delayed(Duration.zero);
    transport.emit({
      'type': 'unread.updated',
      'payload': {
        'chatId': 'chat-1',
        'unreadCount': 0,
      },
    });
    await Future<void>.delayed(Duration.zero);

    final summary =
        await store.watchSummary(userId: 'u1', chatId: 'chat-1').first;

    expect(summary?['unreadCount'], 0);
    expect(summary?['unread'], 0);
  });

  test('forwards realtime notification created payload', () async {
    Map<String, Object?>? received;
    final session = ChatRealtimeSession(
      transport: transport,
      store: store,
      userId: 'u1',
      chatId: 'chat-1',
      accessToken: 'access',
      onNotificationCreated: (payload) {
        received = payload;
      },
    );

    await session.start();
    transport.emit({'type': 'session.authenticated'});
    transport.emit({
      'type': 'notification.created',
      'payload': {
        'userId': 'u1',
        'notificationId': 'n1',
        'kind': 'like',
        'title': 'New match',
        'body': 'Someone liked you',
        'payload': {'userId': 'u2'},
        'readAt': null,
        'createdAt': '2026-05-19T09:00:00.000Z',
      },
    });
    await Future<void>.delayed(Duration.zero);

    expect(received?['notificationId'], 'n1');
    expect(received?['kind'], 'like');
    expect(received?['payload'], {'userId': 'u2'});
  });

  test('subscribes a visible chat list with one socket session', () async {
    await store.replaceSummaries(
      userId: 'u1',
      kind: 'meetups',
      summaries: [
        {
          'id': 'chat-1',
          'title': 'Coffee',
          'lastMessage': 'Old 1',
          'unreadCount': 0,
        },
        {
          'id': 'chat-2',
          'title': 'Dinner',
          'lastMessage': 'Old 2',
          'unreadCount': 0,
        },
      ],
    );
    await store.setSyncCursor(userId: 'u1', chatId: 'chat-2', cursor: '12');
    final session = ChatRealtimeSession(
      transport: transport,
      store: store,
      userId: 'u1',
      chatId: 'chat-1',
      chatIds: const ['chat-1', 'chat-2'],
      accessToken: 'access',
    );

    await session.start();
    transport.emit({'type': 'session.authenticated'});
    await Future<void>.delayed(Duration.zero);
    transport.emit({
      'type': 'message.created',
      'payload': {
        'id': 'm2',
        'chatId': 'chat-2',
        'text': 'List update',
        'createdAt': '2026-05-19T10:02:00.000Z',
      },
    });
    await Future<void>.delayed(Duration.zero);

    final subscribedIds = transport.sent
        .where((item) => item['type'] == 'chat.subscribe')
        .map((item) => (item['payload'] as Map)['chatId'])
        .toList(growable: false);
    final syncForChat2 = transport.sent.firstWhere(
      (item) =>
          item['type'] == 'sync.request' &&
          (item['payload'] as Map)['chatId'] == 'chat-2',
    );
    final summary =
        await store.watchSummary(userId: 'u1', chatId: 'chat-2').first;

    expect(subscribedIds, ['chat-1', 'chat-2']);
    expect((syncForChat2['payload'] as Map)['sinceEventId'], '12');
    expect(summary?['lastMessage'], 'List update');
    expect(summary?['unreadCount'], 1);
  });

  test('applies sync snapshot messages and stores last event cursor', () async {
    final session = ChatRealtimeSession(
      transport: transport,
      store: store,
      userId: 'u1',
      chatId: 'chat-1',
      accessToken: 'access',
    );

    await session.start();
    transport.emit({'type': 'session.authenticated'});
    await Future<void>.delayed(Duration.zero);
    transport.emit({
      'type': 'sync.snapshot',
      'payload': {
        'chatId': 'chat-1',
        'events': [
          {
            'id': '8',
            'type': 'message.created',
            'payload': {
              'id': 'm8',
              'chatId': 'chat-1',
              'text': 'From sync',
              'createdAt': '2026-05-19T10:01:00.000Z',
            },
          },
        ],
      },
    });
    await Future<void>.delayed(Duration.zero);

    final messages =
        await store.watchRecentMessages(userId: 'u1', chatId: 'chat-1').first;

    expect(messages.single['id'], 'm8');
    expect(await store.getSyncCursor(userId: 'u1', chatId: 'chat-1'), '8');
  });

  test('sync snapshot reset replaces local chat history', () async {
    await store.upsertMessages(
      userId: 'u1',
      chatId: 'chat-1',
      messages: [
        {
          'id': 'old-message',
          'chatId': 'chat-1',
          'text': 'Old local',
          'createdAt': '2026-05-19T09:00:00.000Z',
        },
      ],
    );
    final session = ChatRealtimeSession(
      transport: transport,
      store: store,
      userId: 'u1',
      chatId: 'chat-1',
      accessToken: 'access',
    );

    await session.start();
    transport.emit({'type': 'session.authenticated'});
    await Future<void>.delayed(Duration.zero);
    transport.emit({
      'type': 'sync.snapshot',
      'payload': {
        'chatId': 'chat-1',
        'reset': true,
        'events': [
          {
            'id': '9',
            'type': 'message.created',
            'payload': {
              'id': 'fresh-message',
              'chatId': 'chat-1',
              'text': 'Fresh snapshot',
              'createdAt': '2026-05-19T10:01:00.000Z',
            },
          },
        ],
      },
    });
    await Future<void>.delayed(Duration.zero);

    final messages =
        await store.watchRecentMessages(userId: 'u1', chatId: 'chat-1').first;

    expect(messages.map((item) => item['id']), ['fresh-message']);
    expect(await store.getSyncCursor(userId: 'u1', chatId: 'chat-1'), '9');
  });

  test('reconnects, resubscribes, syncs from cursor and flushes outbox',
      () async {
    final reconnectTransport = _FakeChatTransport();
    await store.setSyncCursor(userId: 'u1', chatId: 'chat-1', cursor: '8');
    await store.enqueuePendingCommand(
      userId: 'u1',
      commandId: 'cmd-1',
      dedupeKey: 'message.send:chat-1:cmd-1',
      payload: {
        'type': 'message.send',
        'payload': {
          'chatId': 'chat-1',
          'text': 'After reconnect',
          'clientMessageId': 'cmd-1',
        },
      },
    );
    var reconnectCount = 0;
    final session = ChatRealtimeSession(
      transport: transport,
      store: store,
      userId: 'u1',
      chatId: 'chat-1',
      accessToken: 'access',
      reconnectTransportFactory: (_) {
        reconnectCount += 1;
        return reconnectTransport;
      },
      reconnectUri: Uri.parse('wss://chat.test/ws'),
      reconnectDelay: (_) => Duration.zero,
    );

    await session.start();
    transport.emit({'type': 'session.authenticated'});
    await Future<void>.delayed(Duration.zero);
    await transport.close();
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);
    reconnectTransport.emit({'type': 'session.authenticated'});
    await Future<void>.delayed(Duration.zero);

    expect(reconnectCount, 1);
    expect(reconnectTransport.sent[0]['type'], 'session.authenticate');
    expect(reconnectTransport.sent[1]['type'], 'chat.subscribe');
    expect(reconnectTransport.sent[1]['payload'], {'chatId': 'chat-1'});
    expect(reconnectTransport.sent[2]['type'], 'sync.request');
    expect(reconnectTransport.sent[2]['payload'], {
      'chatId': 'chat-1',
      'sinceEventId': '8',
      'limit': 100,
    });
    expect(reconnectTransport.sent[3]['type'], 'message.send');
    expect((reconnectTransport.sent[3]['payload'] as Map)['chatId'], 'chat-1');

    await session.close();
    await reconnectTransport.close();
  });
}

class _FakeChatTransport implements ChatSocketTransport {
  final StreamController<Object?> _controller = StreamController<Object?>();
  final List<Map<String, Object?>> sent = <Map<String, Object?>>[];
  bool _closed = false;

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
    if (_closed) {
      return;
    }
    _closed = true;
    await _controller.close();
  }
}

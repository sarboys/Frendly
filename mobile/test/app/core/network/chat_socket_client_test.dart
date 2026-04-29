import 'dart:async';
import 'dart:convert';

import 'package:big_break_mobile/app/core/network/chat_socket_client.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

void main() {
  test(
    'refreshes auth session after stale access token and reconnects with new token',
    () async {
      final firstChannel = _FakeWebSocketChannel();
      final secondChannel = _FakeWebSocketChannel();
      final channels = <_FakeWebSocketChannel>[firstChannel, secondChannel];
      var token = 'stale-token';
      var refreshCalls = 0;

      final client = ChatSocketClient(
        accessTokenProvider: () async => token,
        refreshSession: () async {
          refreshCalls += 1;
          token = 'fresh-token';
        },
        channelFactory: () => channels.removeAt(0),
        reconnectDelay: Duration.zero,
      );
      addTearDown(client.dispose);

      final connectFuture = client.connect();
      Object? connectError;
      unawaited(connectFuture.catchError((Object error) {
        connectError = error;
      }));
      await _waitFor(
        () => firstChannel.decodedOutbound.isNotEmpty || connectError != null,
      );
      if (connectError != null) {
        throw connectError!;
      }

      expect(
        firstChannel.decodedOutbound.single,
        isA<Map<String, dynamic>>().having(
          (event) => event['payload']['accessToken'],
          'accessToken',
          'stale-token',
        ),
      );

      firstChannel.serverSend({
        'type': 'error',
        'payload': {
          'code': 'stale_access_token',
          'message': 'Access token is stale',
        },
      });

      await _drainMicrotasks();

      expect(refreshCalls, 1);
      expect(
        secondChannel.decodedOutbound.single,
        isA<Map<String, dynamic>>().having(
          (event) => event['payload']['accessToken'],
          'accessToken',
          'fresh-token',
        ),
      );

      secondChannel.serverSend({
        'type': 'session.authenticated',
        'payload': {'userId': 'user-me'},
      });

      await expectLater(connectFuture, completes);
    },
  );

  test(
    'reconnects, resubscribes chat and replays sync cursor after disconnect',
    () async {
      final firstChannel = _FakeWebSocketChannel();
      final secondChannel = _FakeWebSocketChannel();
      final channels = <_FakeWebSocketChannel>[firstChannel, secondChannel];

      final client = ChatSocketClient(
        accessTokenProvider: () async => 'token',
        channelFactory: () => channels.removeAt(0),
        reconnectDelay: Duration.zero,
      );
      addTearDown(client.dispose);

      client.subscribe('chat-1');
      client.requestSync(chatId: 'chat-1', sinceEventId: '42');

      final connectFuture = client.connect();
      Object? connectError;
      unawaited(connectFuture.catchError((Object error) {
        connectError = error;
      }));
      await _waitFor(
        () => firstChannel.decodedOutbound.isNotEmpty || connectError != null,
      );
      if (connectError != null) {
        throw connectError!;
      }
      firstChannel.serverSend({
        'type': 'session.authenticated',
        'payload': {'userId': 'user-me'},
      });
      await expectLater(connectFuture, completes);

      expect(
        firstChannel.decodedOutbound.map((event) => event['type']).toList(),
        containsAllInOrder([
          'session.authenticate',
          'chat.subscribe',
          'sync.request',
        ]),
      );

      firstChannel.serverClose();
      await _waitFor(() => secondChannel.decodedOutbound.isNotEmpty);

      expect(
        secondChannel.decodedOutbound.single['type'],
        'session.authenticate',
      );

      secondChannel.serverSend({
        'type': 'session.authenticated',
        'payload': {'userId': 'user-me'},
      });
      await _drainMicrotasks();

      final outboundTypes =
          secondChannel.decodedOutbound.map((event) => event['type']).toList();
      expect(
          outboundTypes,
          containsAllInOrder(
              ['session.authenticate', 'chat.subscribe', 'sync.request']));
      expect(
        secondChannel.decodedOutbound.last['payload']['sinceEventId'],
        '42',
      );
    },
  );

  test(
    'persists outgoing message until server echo and replays it after restart',
    () async {
      final storage = _FakeChatOutboxStorage();
      final firstChannel = _FakeWebSocketChannel();
      final secondChannel = _FakeWebSocketChannel();
      final channels = <_FakeWebSocketChannel>[firstChannel, secondChannel];

      final firstClient = ChatSocketClient(
        accessTokenProvider: () async => 'token',
        channelFactory: () => channels.removeAt(0),
        reconnectDelay: Duration.zero,
        outboxStorage: storage,
      );

      final firstConnect = firstClient.connect();
      await _waitFor(() => firstChannel.decodedOutbound.isNotEmpty);
      firstChannel.serverSend({
        'type': 'session.authenticated',
        'payload': {'userId': 'user-me'},
      });
      await expectLater(firstConnect, completes);

      await firstClient.sendMessage(
        chatId: 'chat-1',
        text: '',
        clientMessageId: 'voice-1',
        attachmentIds: const ['asset-1'],
      );

      expect(storage.commands, hasLength(1));
      await firstClient.dispose();

      final secondClient = ChatSocketClient(
        accessTokenProvider: () async => 'token',
        channelFactory: () => channels.removeAt(0),
        reconnectDelay: Duration.zero,
        outboxStorage: storage,
      );
      addTearDown(secondClient.dispose);

      final secondConnect = secondClient.connect();
      await _waitFor(() => secondChannel.decodedOutbound.isNotEmpty);
      secondChannel.serverSend({
        'type': 'session.authenticated',
        'payload': {'userId': 'user-me'},
      });
      await expectLater(secondConnect, completes);

      await _waitFor(
        () => secondChannel.decodedOutbound.any(
          (event) => event['type'] == 'message.send',
        ),
      );

      expect(
        secondChannel.decodedOutbound.last['payload']['clientMessageId'],
        'voice-1',
      );

      secondChannel.serverSend({
        'type': 'message.created',
        'payload': {
          'chatId': 'chat-1',
          'clientMessageId': 'voice-1',
        },
      });

      await _waitFor(() => storage.commands.isEmpty);
    },
  );

  test('sends edit and delete message commands over websocket', () async {
    final channel = _FakeWebSocketChannel();
    final client = ChatSocketClient(
      accessTokenProvider: () async => 'token',
      channelFactory: () => channel,
      reconnectDelay: Duration.zero,
    );
    addTearDown(client.dispose);

    final connect = client.connect();
    await _waitFor(() => channel.decodedOutbound.isNotEmpty);
    channel.serverSend({
      'type': 'session.authenticated',
      'payload': {'userId': 'user-me'},
    });
    await expectLater(connect, completes);

    await client.editMessage(
      chatId: 'chat-1',
      messageId: 'message-1',
      text: 'Новый текст',
    );
    await client.deleteMessage(
      chatId: 'chat-1',
      messageId: 'message-1',
    );

    final outbound = channel.decodedOutbound;
    expect(outbound[outbound.length - 2], {
      'type': 'message.edit',
      'payload': {
        'chatId': 'chat-1',
        'messageId': 'message-1',
        'text': 'Новый текст',
      },
    });
    expect(outbound.last, {
      'type': 'message.delete',
      'payload': {
        'chatId': 'chat-1',
        'messageId': 'message-1',
      },
    });
  });

  test('persists edit and delete commands until realtime ack after restart',
      () async {
    final storage = _FakeChatOutboxStorage();
    final firstChannel = _FakeWebSocketChannel();
    final secondChannel = _FakeWebSocketChannel();
    final channels = <_FakeWebSocketChannel>[firstChannel, secondChannel];

    final firstClient = ChatSocketClient(
      accessTokenProvider: () async => 'token',
      channelFactory: () => channels.removeAt(0),
      reconnectDelay: Duration.zero,
      outboxStorage: storage,
    );

    final firstConnect = firstClient.connect();
    await _waitFor(() => firstChannel.decodedOutbound.isNotEmpty);
    firstChannel.serverSend({
      'type': 'session.authenticated',
      'payload': {'userId': 'user-me'},
    });
    await expectLater(firstConnect, completes);

    await firstClient.editMessage(
      chatId: 'chat-1',
      messageId: 'message-1',
      text: 'Исправленный текст',
    );

    expect(storage.commands, hasLength(1));
    await firstClient.dispose();

    final secondClient = ChatSocketClient(
      accessTokenProvider: () async => 'token',
      channelFactory: () => channels.removeAt(0),
      reconnectDelay: Duration.zero,
      outboxStorage: storage,
    );
    addTearDown(secondClient.dispose);

    final secondConnect = secondClient.connect();
    await _waitFor(() => secondChannel.decodedOutbound.isNotEmpty);
    secondChannel.serverSend({
      'type': 'session.authenticated',
      'payload': {'userId': 'user-me'},
    });
    await expectLater(secondConnect, completes);

    await _waitFor(
      () => secondChannel.decodedOutbound.any(
        (event) => event['type'] == 'message.edit',
      ),
    );

    secondChannel.serverSend({
      'type': 'message.updated',
      'payload': {
        'chatId': 'chat-1',
        'id': 'message-1',
      },
    });
    await _waitFor(() => storage.commands.isEmpty);

    await secondClient.deleteMessage(
      chatId: 'chat-1',
      messageId: 'message-1',
    );
    expect(storage.commands, hasLength(1));

    secondChannel.serverSend({
      'type': 'message.deleted',
      'payload': {
        'chatId': 'chat-1',
        'messageId': 'message-1',
      },
    });

    await _waitFor(() => storage.commands.isEmpty);
  });
}

Future<void> _drainMicrotasks() async {
  await Future<void>.delayed(Duration.zero);
  await Future<void>.delayed(Duration.zero);
  await Future<void>.delayed(const Duration(milliseconds: 1));
}

Future<void> _waitFor(bool Function() condition) async {
  for (var attempt = 0; attempt < 100; attempt++) {
    if (condition()) {
      return;
    }
    await Future<void>.delayed(const Duration(milliseconds: 10));
  }
  throw StateError('Condition was not met in time');
}

class _FakeWebSocketChannel implements WebSocketChannel {
  _FakeWebSocketChannel() : sink = _FakeWebSocketSink() {
    sink._onClose = () async {
      await _controller.close();
    };
  }

  final _controller = StreamController<String>.broadcast();

  @override
  final _FakeWebSocketSink sink;

  @override
  int? closeCode;

  @override
  String? closeReason;

  @override
  String? protocol;

  @override
  Future<void> get ready async {}

  @override
  Stream get stream => _controller.stream;

  List<Map<String, dynamic>> get decodedOutbound => sink.sent
      .map((event) => jsonDecode(event) as Map<String, dynamic>)
      .toList(growable: false);

  void serverSend(Map<String, dynamic> event) {
    _controller.add(jsonEncode(event));
  }

  void serverClose() {
    sink.close();
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _FakeChatOutboxStorage implements ChatOutboxStorage {
  List<Map<String, dynamic>> commands = const [];

  @override
  Future<List<Map<String, dynamic>>> readCommands() async {
    return commands;
  }

  @override
  Future<void> writeCommands(List<Map<String, dynamic>> nextCommands) async {
    commands = nextCommands;
  }
}

class _FakeWebSocketSink implements WebSocketSink {
  final sent = <String>[];
  final _doneCompleter = Completer<void>();
  Future<void> Function()? _onClose;

  @override
  Future get done => _doneCompleter.future;

  @override
  void add(data) {
    sent.add(data as String);
  }

  @override
  void addError(error, [StackTrace? stackTrace]) {}

  @override
  Future<void> addStream(Stream stream) async {
    await for (final event in stream) {
      add(event);
    }
  }

  @override
  Future close([int? closeCode, String? closeReason]) async {
    if (_onClose != null) {
      await _onClose!();
    }
    if (!_doneCompleter.isCompleted) {
      _doneCompleter.complete();
    }
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

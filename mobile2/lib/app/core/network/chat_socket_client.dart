import 'dart:async';
import 'dart:convert';

import 'package:mobile2/app/core/local_cache/chat_local_store.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

typedef ChatSocketTransportFactory = ChatSocketTransport Function(Uri uri);
typedef ChatReconnectDelay = Duration Function(int attempt);
typedef ChatNotificationCreatedHandler = void Function(
  Map<String, Object?> payload,
);

abstract class ChatSocketTransport {
  Stream<Object?> get stream;

  void send(String data);

  Future<void> close();
}

class WebSocketChatTransport implements ChatSocketTransport {
  WebSocketChatTransport._(this._channel);

  final WebSocketChannel _channel;

  static WebSocketChatTransport connect(Uri uri) {
    return WebSocketChatTransport._(WebSocketChannel.connect(uri));
  }

  @override
  Stream<Object?> get stream => _channel.stream;

  @override
  void send(String data) {
    _channel.sink.add(data);
  }

  @override
  Future<void> close() async {
    await _channel.sink.close();
  }
}

class ChatRealtimeSession {
  ChatRealtimeSession({
    required this.transport,
    required this.store,
    required this.userId,
    required this.chatId,
    Iterable<String>? chatIds,
    required this.accessToken,
    this.reconnectTransportFactory,
    this.reconnectUri,
    this.reconnectDelay,
    this.onNotificationCreated,
  }) : _chatIds = _normalizeChatIds(chatId, chatIds);

  ChatSocketTransport transport;
  final ChatLocalStore store;
  final String userId;
  final String chatId;
  final Set<String> _chatIds;
  final String accessToken;
  final ChatSocketTransportFactory? reconnectTransportFactory;
  final Uri? reconnectUri;
  final ChatReconnectDelay? reconnectDelay;
  final ChatNotificationCreatedHandler? onNotificationCreated;

  StreamSubscription<Object?>? _subscription;
  Timer? _reconnectTimer;
  int _reconnectAttempt = 0;
  bool _closed = false;
  bool _authenticated = false;

  Future<void> start() async {
    _listenToTransport();
    _send('session.authenticate', {'accessToken': accessToken});
  }

  void _listenToTransport() {
    _subscription = transport.stream.listen(
      _handleSocketData,
      onError: (_) => _scheduleReconnect(),
      onDone: _scheduleReconnect,
    );
  }

  Future<void> _openAuthenticatedSession() async {
    for (final activeChatId in _chatIds) {
      _send('chat.subscribe', {'chatId': activeChatId});
      final cursor = await store.getSyncCursor(
        userId: userId,
        chatId: activeChatId,
      );
      _send('sync.request', {
        'chatId': activeChatId,
        if (cursor != null && cursor.isNotEmpty) 'sinceEventId': cursor,
        'limit': 100,
      });
    }
    await flushOutbox();
  }

  Future<void> flushOutbox() async {
    if (!_authenticated) {
      return;
    }
    final commands = await store.pendingCommands(userId: userId);
    for (final command in commands) {
      final payload = _map(command['payload']);
      final commandChatId = payload['chatId']?.toString();
      if (commandChatId == null || !_chatIds.contains(commandChatId)) {
        continue;
      }
      transport.send(jsonEncode(command));
    }
  }

  Future<void> close() async {
    if (_closed) {
      return;
    }
    _closed = true;
    _reconnectTimer?.cancel();
    await _subscription?.cancel();
    for (final activeChatId in _chatIds) {
      _send('chat.unsubscribe', {'chatId': activeChatId});
    }
    await transport.close();
  }

  void _scheduleReconnect() {
    if (_closed ||
        reconnectTransportFactory == null ||
        reconnectUri == null ||
        _reconnectTimer != null) {
      return;
    }
    _authenticated = false;
    unawaited(_subscription?.cancel());
    _reconnectAttempt += 1;
    final delay = reconnectDelay?.call(_reconnectAttempt) ??
        Duration(seconds: _defaultBackoffSeconds(_reconnectAttempt));
    _reconnectTimer = Timer(delay, () {
      _reconnectTimer = null;
      unawaited(_reconnect());
    });
  }

  Future<void> _reconnect() async {
    if (_closed || reconnectTransportFactory == null || reconnectUri == null) {
      return;
    }
    try {
      await transport.close();
      transport = reconnectTransportFactory!(reconnectUri!);
      _listenToTransport();
      _send('session.authenticate', {'accessToken': accessToken});
    } catch (_) {
      _scheduleReconnect();
    }
  }

  int _defaultBackoffSeconds(int attempt) {
    if (attempt <= 1) {
      return 1;
    }
    if (attempt == 2) {
      return 2;
    }
    if (attempt == 3) {
      return 4;
    }
    return 8;
  }

  void _send(String type, Map<String, Object?> payload) {
    if (_closed) {
      return;
    }
    transport.send(jsonEncode({'type': type, 'payload': payload}));
  }

  void _handleSocketData(Object? data) {
    final event = _decode(data);
    if (event.isEmpty) {
      return;
    }
    final type = event['type']?.toString();
    final payload = _map(event['payload']);
    switch (type) {
      case 'session.authenticated':
        _authenticated = true;
        _reconnectAttempt = 0;
        unawaited(_openAuthenticatedSession());
        return;
      case 'message.created':
        unawaited(_storeMessage(payload, incrementUnread: true));
        return;
      case 'message.updated':
        unawaited(_storeMessage(payload, incrementUnread: false));
        return;
      case 'unread.updated':
        unawaited(_storeUnread(payload));
        return;
      case 'notification.created':
        onNotificationCreated?.call(payload);
        return;
      case 'sync.snapshot':
        unawaited(_handleSnapshot(payload));
        return;
    }
  }

  Future<void> _handleSnapshot(Map<String, Object?> payload) async {
    final eventChatId = payload['chatId']?.toString();
    if (eventChatId == null || !_chatIds.contains(eventChatId)) {
      return;
    }
    final events = payload['events'];
    if (events is! List) {
      return;
    }
    if (payload['reset'] == true) {
      await store.clearMessages(userId: userId, chatId: eventChatId);
    }
    String? lastEventId;
    for (final rawEvent in events.whereType<Map>()) {
      final event = _map(rawEvent);
      lastEventId = event['id']?.toString() ?? lastEventId;
      final type = event['type']?.toString();
      final eventPayload = _map(event['payload']);
      if (type == 'message.created') {
        await _storeMessage(eventPayload, incrementUnread: true);
      } else if (type == 'message.updated') {
        await _storeMessage(eventPayload, incrementUnread: false);
      }
    }
    if (lastEventId != null && lastEventId.isNotEmpty) {
      await store.setSyncCursor(
        userId: userId,
        chatId: eventChatId,
        cursor: lastEventId,
      );
    }
  }

  Future<void> _storeMessage(
    Map<String, Object?> payload, {
    required bool incrementUnread,
  }) async {
    final eventChatId = payload['chatId']?.toString();
    if (eventChatId == null || !_chatIds.contains(eventChatId)) {
      return;
    }
    final message = {
      ...payload,
      if (_isOwnMessage(payload)) 'mine': true,
    };
    await store.upsertMessages(
      userId: userId,
      chatId: eventChatId,
      messages: [message],
    );
    await _patchSummaryForMessage(
      eventChatId,
      message,
      incrementUnread: incrementUnread,
    );
    final clientMessageId = message['clientMessageId']?.toString();
    if (clientMessageId != null && clientMessageId.isNotEmpty) {
      await store.deletePendingCommand(
        userId: userId,
        commandId: clientMessageId,
      );
    }
  }

  Future<void> _patchSummaryForMessage(
    String eventChatId,
    Map<String, Object?> payload, {
    required bool incrementUnread,
  }) {
    final text = payload['text']?.toString() ?? '';
    final createdAt = payload['createdAt']?.toString();
    final shouldIncrementUnread = incrementUnread && !_isOwnMessage(payload);
    return store.patchSummary(
      userId: userId,
      chatId: eventChatId,
      patch: (summary) {
        final currentUnread =
            int.tryParse(summary['unreadCount']?.toString() ?? '') ??
                int.tryParse(summary['unread']?.toString() ?? '') ??
                0;
        return {
          ...summary,
          if (text.isNotEmpty) 'lastMessage': text,
          if (text.isNotEmpty) 'preview': text,
          if (createdAt != null && createdAt.isNotEmpty)
            'lastMessageAt': createdAt,
          'unreadCount':
              shouldIncrementUnread ? currentUnread + 1 : currentUnread,
          'unread': shouldIncrementUnread ? currentUnread + 1 : currentUnread,
        };
      },
    );
  }

  bool _isOwnMessage(Map<String, Object?> payload) {
    final sender = _map(payload['sender']);
    final senderId = payload['senderId']?.toString() ??
        payload['userId']?.toString() ??
        sender['id']?.toString() ??
        sender['userId']?.toString();
    return senderId == userId;
  }

  Future<void> _storeUnread(Map<String, Object?> payload) async {
    final eventChatId = payload['chatId']?.toString();
    if (eventChatId == null || !_chatIds.contains(eventChatId)) {
      return;
    }
    final count = int.tryParse(payload['unreadCount']?.toString() ?? '') ??
        int.tryParse(payload['unread']?.toString() ?? '') ??
        0;
    await store.patchSummary(
      userId: userId,
      chatId: eventChatId,
      patch: (summary) => {
        ...summary,
        'unreadCount': count,
        'unread': count,
      },
    );
  }

  Map<String, Object?> _decode(Object? data) {
    if (data is Map) {
      return _map(data);
    }
    if (data is! String) {
      return const {};
    }
    final decoded = jsonDecode(data);
    return decoded is Map ? _map(decoded) : const {};
  }

  Map<String, Object?> _map(Object? value) {
    if (value is Map) {
      return value.map((key, value) => MapEntry('$key', value));
    }
    return const {};
  }

  static Set<String> _normalizeChatIds(
    String primaryChatId,
    Iterable<String>? chatIds,
  ) {
    final values = <String>{};
    void add(String id) {
      final trimmed = id.trim();
      if (trimmed.isNotEmpty) {
        values.add(trimmed);
      }
    }

    add(primaryChatId);
    if (chatIds != null) {
      for (final id in chatIds) {
        add(id);
      }
    }
    return values;
  }
}

import 'dart:async';
import 'dart:convert';

import 'package:big_break_mobile/app/core/config/backend_config.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

typedef ChatSocketChannelFactory = WebSocketChannel Function();

abstract class ChatOutboxStorage {
  Future<List<Map<String, dynamic>>> readCommands();
  Future<void> writeCommands(List<Map<String, dynamic>> commands);
}

class SharedPreferencesChatOutboxStorage implements ChatOutboxStorage {
  const SharedPreferencesChatOutboxStorage(this._preferences);

  static const _storageKey = 'chat.outbox.commands';
  final SharedPreferences _preferences;

  static Future<void> clearStoredCommands(
      SharedPreferences? preferences) async {
    await preferences?.remove(_storageKey);
  }

  @override
  Future<List<Map<String, dynamic>>> readCommands() async {
    final raw = _preferences.getString(_storageKey);
    if (raw == null || raw.isEmpty) {
      return const [];
    }

    final decoded = jsonDecode(raw);
    if (decoded is! List) {
      return const [];
    }

    return decoded
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList(growable: false);
  }

  @override
  Future<void> writeCommands(List<Map<String, dynamic>> commands) async {
    if (commands.isEmpty) {
      await _preferences.remove(_storageKey);
      return;
    }

    await _preferences.setString(_storageKey, jsonEncode(commands));
  }
}

class ChatSocketClient {
  ChatSocketClient({
    required Future<String> Function() accessTokenProvider,
    Future<void> Function()? refreshSession,
    ChatSocketChannelFactory? channelFactory,
    Duration reconnectDelay = const Duration(seconds: 1),
    ChatOutboxStorage? outboxStorage,
  })  : _accessTokenProvider = accessTokenProvider,
        _refreshSession = refreshSession,
        _channelFactory = channelFactory ??
            (() =>
                WebSocketChannel.connect(Uri.parse(BackendConfig.chatWsUrl))),
        _reconnectDelay = reconnectDelay,
        _outboxStorage = outboxStorage;

  final Future<String> Function() _accessTokenProvider;
  final Future<void> Function()? _refreshSession;
  final ChatSocketChannelFactory _channelFactory;
  final Duration _reconnectDelay;
  final ChatOutboxStorage? _outboxStorage;
  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  final _events = StreamController<Map<String, dynamic>>.broadcast();
  Future<void>? _connectFuture;
  Timer? _reconnectTimer;
  bool _authenticated = false;
  bool _disposed = false;
  bool _reconnectRequested = false;
  final _subscriptions = <String>{};
  final _syncCursorByChat = <String, String?>{};
  final _pendingCommands = <_QueuedCommand>[];
  Future<void>? _restoreOutboxFuture;

  Stream<Map<String, dynamic>> get events => _events.stream;

  Future<void> connect() async {
    if (_disposed) {
      throw StateError('chat_socket_disposed');
    }

    _reconnectRequested = true;
    await _restoreOutbox();

    if (_channel != null && _authenticated) {
      return;
    }

    final pendingConnect = _connectFuture;
    if (pendingConnect != null) {
      return pendingConnect;
    }

    final future = _connectWithRecovery();
    _connectFuture = future;

    try {
      await future;
    } finally {
      if (identical(_connectFuture, future)) {
        _connectFuture = null;
      }
    }
  }

  void subscribe(String chatId) {
    _subscriptions.add(chatId);
    _queueOrSend(
      'chat.subscribe',
      {'chatId': chatId},
      dedupeKey: 'subscribe:$chatId',
    );
    unawaited(connect());
  }

  void unsubscribe(String chatId) {
    _subscriptions.remove(chatId);
    _syncCursorByChat.remove(chatId);
    _removeQueued('subscribe:$chatId');
    _removeQueued('sync:$chatId');
    _queueOrSend(
      'chat.unsubscribe',
      {'chatId': chatId},
      dedupeKey: 'unsubscribe:$chatId',
      keepQueued: false,
    );
  }

  Future<void> sendMessage({
    required String chatId,
    required String text,
    required String clientMessageId,
    List<String> attachmentIds = const [],
    String? replyToMessageId,
  }) async {
    final payload = {
      'chatId': chatId,
      'text': text,
      'clientMessageId': clientMessageId,
      if (attachmentIds.isNotEmpty) 'attachmentIds': attachmentIds,
      if (replyToMessageId != null) 'replyToMessageId': replyToMessageId,
    };
    final dedupeKey = _messageDedupeKey(chatId, clientMessageId);

    await _restoreOutbox();
    await _persistCommand(
      _QueuedCommand(
        type: 'message.send',
        payload: payload,
        dedupeKey: dedupeKey,
      ),
    );

    try {
      await connect();
    } catch (_) {
      return;
    }

    _queueOrSend(
      'message.send',
      payload,
      dedupeKey: dedupeKey,
    );
  }

  Future<void> editMessage({
    required String chatId,
    required String messageId,
    required String text,
  }) async {
    final dedupeKey = _editMessageDedupeKey(chatId, messageId);
    final payload = {
      'chatId': chatId,
      'messageId': messageId,
      'text': text,
    };

    await _restoreOutbox();
    await _persistCommand(
      _QueuedCommand(
        type: 'message.edit',
        payload: payload,
        dedupeKey: dedupeKey,
      ),
    );

    try {
      await connect();
    } catch (_) {
      return;
    }

    _queueOrSend(
      'message.edit',
      payload,
      dedupeKey: dedupeKey,
    );
  }

  Future<void> deleteMessage({
    required String chatId,
    required String messageId,
  }) async {
    final editDedupeKey = _editMessageDedupeKey(chatId, messageId);
    final deleteDedupeKey = _deleteMessageDedupeKey(chatId, messageId);
    final payload = {
      'chatId': chatId,
      'messageId': messageId,
    };

    await _restoreOutbox();
    await _removePersistedCommand(editDedupeKey);
    await _persistCommand(
      _QueuedCommand(
        type: 'message.delete',
        payload: payload,
        dedupeKey: deleteDedupeKey,
      ),
    );

    try {
      await connect();
    } catch (_) {
      return;
    }

    _queueOrSend(
      'message.delete',
      payload,
      dedupeKey: deleteDedupeKey,
    );
  }

  void markRead({
    required String chatId,
    required String messageId,
  }) {
    _queueOrSend(
        'message.read',
        {
          'chatId': chatId,
          'messageId': messageId,
        },
        dedupeKey: 'read:$chatId');
  }

  void requestSync({
    required String chatId,
    String? sinceEventId,
  }) {
    _syncCursorByChat[chatId] = sinceEventId;
    _queueOrSend(
        'sync.request',
        {
          'chatId': chatId,
          if (sinceEventId != null) 'sinceEventId': sinceEventId,
        },
        dedupeKey: 'sync:$chatId');
  }

  void rememberSyncCursor({
    required String chatId,
    String? eventId,
  }) {
    if (!_subscriptions.contains(chatId)) {
      return;
    }
    _syncCursorByChat[chatId] = eventId;
  }

  Future<void> dispose() async {
    _disposed = true;
    _reconnectRequested = false;
    _reconnectTimer?.cancel();
    await _subscription?.cancel();
    await _channel?.sink.close();
    _authenticated = false;
    _channel = null;
    _subscription = null;
    _connectFuture = null;
    _pendingCommands.clear();
    _subscriptions.clear();
    _syncCursorByChat.clear();
    await _events.close();
  }

  Future<void> _connectWithRecovery() async {
    var refreshed = false;

    while (!_disposed) {
      try {
        await _openAndAuthenticate();
        return;
      } on _AuthHandshakeException catch (error) {
        if (_canRefreshFor(error.code, refreshed)) {
          refreshed = true;
          await _refreshSession!.call();
          continue;
        }
        rethrow;
      }
    }

    throw StateError('chat_socket_disposed');
  }

  Future<void> _openAndAuthenticate() async {
    final token = await _accessTokenProvider();
    final channel = _channelFactory();
    final authCompleter = Completer<void>();
    var handshakeFinished = false;

    _channel = channel;
    _authenticated = false;

    _subscription = channel.stream.listen(
      (event) {
        final decoded = jsonDecode(event as String) as Map<String, dynamic>;
        final type = decoded['type'] as String?;

        if (!handshakeFinished && type == 'session.authenticated') {
          handshakeFinished = true;
          _authenticated = true;
          authCompleter.complete();
          _restoreStateAfterAuth();
        } else if (!handshakeFinished && type == 'error') {
          final payload = decoded['payload'] as Map<String, dynamic>?;
          final code = payload?['code'] as String? ?? 'auth_failed';
          handshakeFinished = true;
          authCompleter.completeError(_AuthHandshakeException(code));
          unawaited(_resetConnection());
        }

        if (type == 'message.created') {
          final payload = decoded['payload'] as Map<String, dynamic>?;
          final chatId = payload?['chatId'] as String?;
          final clientMessageId = payload?['clientMessageId'] as String?;
          if (chatId != null && clientMessageId != null) {
            unawaited(
              _removePersistedCommand(
                  _messageDedupeKey(chatId, clientMessageId)),
            );
          }
        }

        if (type == 'message.updated') {
          final payload = decoded['payload'] as Map<String, dynamic>?;
          final chatId = payload?['chatId'] as String?;
          final messageId = payload?['id'] as String?;
          if (chatId != null && messageId != null) {
            unawaited(
              _removePersistedCommand(
                _editMessageDedupeKey(chatId, messageId),
              ),
            );
          }
        }

        if (type == 'message.deleted') {
          final payload = decoded['payload'] as Map<String, dynamic>?;
          final chatId = payload?['chatId'] as String?;
          final messageId = payload?['messageId'] as String?;
          if (chatId != null && messageId != null) {
            unawaited(
              _removePersistedCommand(
                _editMessageDedupeKey(chatId, messageId),
              ),
            );
            unawaited(
              _removePersistedCommand(
                _deleteMessageDedupeKey(chatId, messageId),
              ),
            );
          }
        }

        _events.add(decoded);
      },
      onError: (Object error, StackTrace stackTrace) {
        if (!handshakeFinished) {
          handshakeFinished = true;
          authCompleter.completeError(error, stackTrace);
        }
        _handleDisconnect();
      },
      onDone: () {
        if (!handshakeFinished) {
          handshakeFinished = true;
          authCompleter.completeError(StateError('socket_closed'));
        }
        _handleDisconnect();
      },
      cancelOnError: false,
    );

    channel.sink.add(
      jsonEncode({
        'type': 'session.authenticate',
        'payload': {'accessToken': token},
      }),
    );

    try {
      await authCompleter.future;
    } catch (_) {
      await _subscription?.cancel();
      _subscription = null;
      rethrow;
    }
  }

  void _restoreStateAfterAuth() {
    for (final chatId in _subscriptions) {
      _removeQueued('subscribe:$chatId');
      _sendNow('chat.subscribe', {'chatId': chatId});
    }

    for (final chatId in _subscriptions) {
      if (_syncCursorByChat.containsKey(chatId)) {
        _removeQueued('sync:$chatId');
        final cursor = _syncCursorByChat[chatId];
        _sendNow('sync.request', {
          'chatId': chatId,
          if (cursor != null) 'sinceEventId': cursor,
        });
      }
    }

    _flushPendingCommands();
  }

  void _flushPendingCommands() {
    if (_channel == null || !_authenticated) {
      return;
    }

    final queued = List<_QueuedCommand>.from(_pendingCommands, growable: false);
    _pendingCommands.clear();

    for (final command in queued) {
      _sendNow(command.type, command.payload);
    }
  }

  void _queueOrSend(
    String type,
    Map<String, dynamic> payload, {
    String? dedupeKey,
    bool keepQueued = true,
  }) {
    if (_channel != null && _authenticated) {
      _sendNow(type, payload);
      return;
    }

    if (!keepQueued) {
      return;
    }

    final command = _QueuedCommand(
      type: type,
      payload: payload,
      dedupeKey: dedupeKey,
    );

    if (dedupeKey != null) {
      final index = _pendingCommands.indexWhere(
        (item) => item.dedupeKey == dedupeKey,
      );
      if (index != -1) {
        _pendingCommands[index] = command;
        return;
      }
    }

    _pendingCommands.add(command);
  }

  void _removeQueued(String dedupeKey) {
    _pendingCommands.removeWhere((item) => item.dedupeKey == dedupeKey);
  }

  String _messageDedupeKey(String chatId, String clientMessageId) {
    return 'message:$chatId:$clientMessageId';
  }

  String _editMessageDedupeKey(String chatId, String messageId) {
    return 'edit:$chatId:$messageId';
  }

  String _deleteMessageDedupeKey(String chatId, String messageId) {
    return 'delete:$chatId:$messageId';
  }

  Future<void> _restoreOutbox() async {
    final pending = _restoreOutboxFuture;
    if (pending != null) {
      return pending;
    }

    final future = _restoreOutboxInternal();
    _restoreOutboxFuture = future;
    try {
      await future;
    } finally {
      if (identical(_restoreOutboxFuture, future)) {
        _restoreOutboxFuture = null;
      }
    }
  }

  Future<void> _restoreOutboxInternal() async {
    if (_outboxStorage == null) {
      return;
    }

    final commands = await _outboxStorage.readCommands();
    for (final item in commands) {
      final type = item['type'] as String?;
      final payload = item['payload'];
      final dedupeKey = item['dedupeKey'] as String?;
      if (type == null || payload is! Map) {
        continue;
      }
      final command = _QueuedCommand(
        type: type,
        payload: Map<String, dynamic>.from(payload),
        dedupeKey: dedupeKey,
      );
      if (dedupeKey != null) {
        final index = _pendingCommands.indexWhere(
          (entry) => entry.dedupeKey == dedupeKey,
        );
        if (index != -1) {
          _pendingCommands[index] = command;
          continue;
        }
      }
      _pendingCommands.add(command);
    }
  }

  Future<void> _persistCommand(_QueuedCommand command) async {
    if (_outboxStorage == null) {
      return;
    }

    final current = await _outboxStorage.readCommands();
    final next = [...current];
    if (command.dedupeKey != null) {
      final index = next.indexWhere(
        (item) => item['dedupeKey'] == command.dedupeKey,
      );
      final encoded = command.toJson();
      if (index != -1) {
        next[index] = encoded;
      } else {
        next.add(encoded);
      }
    } else {
      next.add(command.toJson());
    }

    await _outboxStorage.writeCommands(next);
  }

  Future<void> _removePersistedCommand(String dedupeKey) async {
    _removeQueued(dedupeKey);
    if (_outboxStorage == null) {
      return;
    }

    final current = await _outboxStorage.readCommands();
    final next = current
        .where((item) => item['dedupeKey'] != dedupeKey)
        .toList(growable: false);
    await _outboxStorage.writeCommands(next);
  }

  void _sendNow(String type, Map<String, dynamic> payload) {
    if (_channel == null || !_authenticated) {
      throw StateError('chat_socket_not_ready');
    }

    _channel!.sink.add(
      jsonEncode({
        'type': type,
        'payload': payload,
      }),
    );
  }

  bool _canRefreshFor(String code, bool refreshed) {
    if (refreshed || _refreshSession == null) {
      return false;
    }

    return code == 'stale_access_token' || code == 'invalid_access_token';
  }

  void _handleDisconnect() {
    _authenticated = false;
    unawaited(_resetConnection());

    if (_disposed || !_reconnectRequested) {
      return;
    }

    if (_subscriptions.isEmpty) {
      return;
    }

    if (_reconnectTimer != null) {
      return;
    }

    _reconnectTimer = Timer(_reconnectDelay, () {
      _reconnectTimer = null;
      if (_disposed || !_reconnectRequested || _subscriptions.isEmpty) {
        return;
      }
      unawaited(connect());
    });
  }

  Future<void> _resetConnection() async {
    final subscription = _subscription;
    final channel = _channel;

    _subscription = null;
    _channel = null;

    await subscription?.cancel();
    await channel?.sink.close();
  }
}

class _QueuedCommand {
  const _QueuedCommand({
    required this.type,
    required this.payload,
    this.dedupeKey,
  });

  final String type;
  final Map<String, dynamic> payload;
  final String? dedupeKey;

  Map<String, dynamic> toJson() {
    return {
      'type': type,
      'payload': payload,
      'dedupeKey': dedupeKey,
    };
  }
}

class _AuthHandshakeException implements Exception {
  const _AuthHandshakeException(this.code);

  final String code;
}

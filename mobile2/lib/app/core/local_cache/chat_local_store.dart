import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:mobile2/app/core/local_cache/app_local_database.dart';

class ChatLocalStore {
  ChatLocalStore(this._database);

  final AppLocalDatabase _database;

  Stream<List<Map<String, Object?>>> watchSummaries({
    required String userId,
    required String kind,
  }) {
    return (_database.select(_database.chatSummaries)
          ..where(
              (table) => table.userId.equals(userId) & table.kind.equals(kind))
          ..orderBy([(table) => OrderingTerm.desc(table.updatedAt)]))
        .watch()
        .map((rows) => rows.map((row) => _decode(row.jsonValue)).toList());
  }

  Stream<Map<String, Object?>?> watchSummary({
    required String userId,
    required String chatId,
  }) {
    return (_database.select(_database.chatSummaries)
          ..where(
            (table) =>
                table.userId.equals(userId) & table.chatId.equals(chatId),
          )
          ..limit(1))
        .watch()
        .map((rows) => rows.isEmpty ? null : _decode(rows.first.jsonValue));
  }

  Future<void> replaceSummaries({
    required String userId,
    required String kind,
    required List<Map<String, Object?>> summaries,
  }) async {
    await _database.transaction(() async {
      await (_database.delete(_database.chatSummaries)
            ..where(
              (table) => table.userId.equals(userId) & table.kind.equals(kind),
            ))
          .go();
      for (final summary in summaries) {
        final chatId =
            summary['id']?.toString() ?? summary['chatId']?.toString();
        if (chatId == null || chatId.isEmpty) {
          continue;
        }
        await _database.into(_database.chatSummaries).insertOnConflictUpdate(
              ChatSummariesCompanion(
                userId: Value(userId),
                kind: Value(kind),
                chatId: Value(chatId),
                jsonValue: Value(jsonEncode(summary)),
                updatedAt: Value(DateTime.now()),
              ),
            );
      }
    });
  }

  Future<void> markSummaryRead({
    required String userId,
    required String chatId,
  }) async {
    final rows = await (_database.select(_database.chatSummaries)
          ..where(
            (table) =>
                table.userId.equals(userId) & table.chatId.equals(chatId),
          ))
        .get();
    for (final row in rows) {
      final json = _decode(row.jsonValue);
      await _database.into(_database.chatSummaries).insertOnConflictUpdate(
            ChatSummariesCompanion(
              userId: Value(row.userId),
              kind: Value(row.kind),
              chatId: Value(row.chatId),
              jsonValue: Value(jsonEncode({
                ...json,
                'unreadCount': 0,
                'unread': 0,
              })),
              updatedAt: Value(DateTime.now()),
            ),
          );
    }
  }

  Future<void> setSummaryPinned({
    required String userId,
    required String chatId,
    required bool isPinned,
  }) async {
    final rows = await (_database.select(_database.chatSummaries)
          ..where(
            (table) =>
                table.userId.equals(userId) & table.chatId.equals(chatId),
          ))
        .get();
    for (final row in rows) {
      final json = _decode(row.jsonValue);
      await _database.into(_database.chatSummaries).insertOnConflictUpdate(
            ChatSummariesCompanion(
              userId: Value(row.userId),
              kind: Value(row.kind),
              chatId: Value(row.chatId),
              jsonValue: Value(jsonEncode({
                ...json,
                'isPinned': isPinned,
              })),
              updatedAt: Value(DateTime.now()),
            ),
          );
    }
  }

  Future<void> patchSummary({
    required String userId,
    required String chatId,
    required Map<String, Object?> Function(Map<String, Object?> summary) patch,
  }) async {
    final rows = await (_database.select(_database.chatSummaries)
          ..where(
            (table) =>
                table.userId.equals(userId) & table.chatId.equals(chatId),
          ))
        .get();
    for (final row in rows) {
      final json = _decode(row.jsonValue);
      await _database.into(_database.chatSummaries).insertOnConflictUpdate(
            ChatSummariesCompanion(
              userId: Value(row.userId),
              kind: Value(row.kind),
              chatId: Value(row.chatId),
              jsonValue: Value(jsonEncode(patch(json))),
              updatedAt: Value(DateTime.now()),
            ),
          );
    }
  }

  Future<void> deleteChat({
    required String userId,
    required String chatId,
  }) async {
    await _database.transaction(() async {
      await (_database.delete(_database.chatSummaries)
            ..where(
              (table) =>
                  table.userId.equals(userId) & table.chatId.equals(chatId),
            ))
          .go();
      await (_database.delete(_database.chatMessages)
            ..where(
              (table) =>
                  table.userId.equals(userId) & table.chatId.equals(chatId),
            ))
          .go();
      await (_database.delete(_database.syncCursors)
            ..where(
              (table) =>
                  table.userId.equals(userId) &
                  table.scope.equals('chat:$chatId'),
            ))
          .go();
      await (_database.delete(_database.pendingCommands)
            ..where(
              (table) =>
                  table.userId.equals(userId) &
                  table.dedupeKey.like('%:$chatId:%'),
            ))
          .go();
    });
  }

  Future<List<Map<String, Object?>>> readSummariesForChat({
    required String userId,
    required String chatId,
  }) async {
    final rows = await (_database.select(_database.chatSummaries)
          ..where(
            (table) =>
                table.userId.equals(userId) & table.chatId.equals(chatId),
          ))
        .get();
    return rows
        .map((row) => <String, Object?>{
              'kind': row.kind,
              'summary': _decode(row.jsonValue),
            })
        .toList(growable: false);
  }

  Future<void> restoreSummaries({
    required String userId,
    required List<Map<String, Object?>> rows,
  }) async {
    for (final row in rows) {
      final kind = row['kind']?.toString();
      final summary = row['summary'];
      if (kind == null || summary is! Map<String, Object?>) {
        continue;
      }
      final chatId = summary['id']?.toString() ?? summary['chatId']?.toString();
      if (chatId == null || chatId.isEmpty) {
        continue;
      }
      await _database.into(_database.chatSummaries).insertOnConflictUpdate(
            ChatSummariesCompanion(
              userId: Value(userId),
              kind: Value(kind),
              chatId: Value(chatId),
              jsonValue: Value(jsonEncode(summary)),
              updatedAt: Value(DateTime.now()),
            ),
          );
    }
  }

  Stream<List<Map<String, Object?>>> watchRecentMessages({
    required String userId,
    required String chatId,
  }) {
    return (_database.select(_database.chatMessages)
          ..where(
            (table) =>
                table.userId.equals(userId) & table.chatId.equals(chatId),
          )
          ..orderBy([(table) => OrderingTerm.asc(table.createdAt)]))
        .watch()
        .map((rows) => rows.map((row) => _decode(row.jsonValue)).toList());
  }

  Future<List<Map<String, Object?>>> readRecentMessages({
    required String userId,
    required String chatId,
    int? limit,
  }) async {
    final query = _database.select(_database.chatMessages)
      ..where(
        (table) => table.userId.equals(userId) & table.chatId.equals(chatId),
      )
      ..orderBy([
        (table) => limit == null
            ? OrderingTerm.asc(table.createdAt)
            : OrderingTerm.desc(table.createdAt),
      ]);
    if (limit != null) {
      query.limit(limit);
    }
    final rows = await query.get();
    final orderedRows = limit == null ? rows : rows.reversed;
    return orderedRows
        .map((row) => _decode(row.jsonValue))
        .toList(growable: false);
  }

  Future<void> upsertMessages({
    required String userId,
    required String chatId,
    required List<Map<String, Object?>> messages,
  }) async {
    for (final message in messages) {
      final messageId =
          message['id']?.toString() ?? message['messageId']?.toString();
      final clientMessageId = message['clientMessageId']?.toString();
      final localKey = messageId ?? clientMessageId;
      if (localKey == null || localKey.isEmpty) {
        continue;
      }
      if (clientMessageId != null && messageId != null) {
        await (_database.delete(_database.chatMessages)
              ..where(
                (table) =>
                    table.userId.equals(userId) &
                    table.chatId.equals(chatId) &
                    table.clientMessageId.equals(clientMessageId),
              ))
            .go();
      }
      await _database.into(_database.chatMessages).insertOnConflictUpdate(
            ChatMessagesCompanion(
              userId: Value(userId),
              chatId: Value(chatId),
              localKey: Value(localKey),
              messageId: Value(messageId),
              clientMessageId: Value(clientMessageId),
              jsonValue: Value(jsonEncode(message)),
              createdAt: Value(_date(message['createdAt']) ?? DateTime.now()),
            ),
          );
    }
  }

  Future<void> clearMessages({
    required String userId,
    required String chatId,
  }) async {
    await (_database.delete(_database.chatMessages)
          ..where(
            (table) =>
                table.userId.equals(userId) & table.chatId.equals(chatId),
          ))
        .go();
  }

  Future<void> setSyncCursor({
    required String userId,
    required String chatId,
    required String cursor,
  }) async {
    await _database.into(_database.syncCursors).insertOnConflictUpdate(
          SyncCursorsCompanion(
            userId: Value(userId),
            scope: Value('chat:$chatId'),
            cursor: Value(cursor),
            updatedAt: Value(DateTime.now()),
          ),
        );
  }

  Future<String?> getSyncCursor({
    required String userId,
    required String chatId,
  }) async {
    final row = await (_database.select(_database.syncCursors)
          ..where(
            (table) =>
                table.userId.equals(userId) &
                table.scope.equals('chat:$chatId'),
          ))
        .getSingleOrNull();
    return row?.cursor;
  }

  Future<void> enqueuePendingCommand({
    required String userId,
    required String commandId,
    required String dedupeKey,
    required Map<String, Object?> payload,
  }) async {
    await _database.into(_database.pendingCommands).insertOnConflictUpdate(
          PendingCommandsCompanion(
            userId: Value(userId),
            commandId: Value(commandId),
            dedupeKey: Value(dedupeKey),
            jsonValue: Value(jsonEncode(payload)),
            createdAt: Value(DateTime.now()),
          ),
        );
  }

  Future<List<Map<String, Object?>>> pendingCommands({
    required String userId,
  }) async {
    final rows = await (_database.select(_database.pendingCommands)
          ..where((table) => table.userId.equals(userId))
          ..orderBy([(table) => OrderingTerm.asc(table.createdAt)]))
        .get();
    return rows.map((row) => _decode(row.jsonValue)).toList(growable: false);
  }

  Future<void> deletePendingCommand({
    required String userId,
    required String commandId,
  }) async {
    await (_database.delete(_database.pendingCommands)
          ..where(
            (table) =>
                table.userId.equals(userId) & table.commandId.equals(commandId),
          ))
        .go();
  }

  Future<void> clearUser(String userId) async {
    await _database.transaction(() async {
      await (_database.delete(_database.chatSummaries)
            ..where((table) => table.userId.equals(userId)))
          .go();
      await (_database.delete(_database.chatMessages)
            ..where((table) => table.userId.equals(userId)))
          .go();
      await (_database.delete(_database.syncCursors)
            ..where((table) => table.userId.equals(userId)))
          .go();
      await (_database.delete(_database.pendingCommands)
            ..where((table) => table.userId.equals(userId)))
          .go();
    });
  }

  Map<String, Object?> _decode(String source) {
    final value = jsonDecode(source);
    if (value is Map) {
      return value.map((key, value) => MapEntry('$key', value));
    }
    return const {};
  }

  DateTime? _date(Object? value) {
    if (value is DateTime) {
      return value;
    }
    return DateTime.tryParse(value?.toString() ?? '');
  }
}

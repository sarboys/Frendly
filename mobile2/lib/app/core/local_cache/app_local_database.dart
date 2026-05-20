import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:drift_flutter/drift_flutter.dart';

part 'app_local_database.g.dart';

class CacheEntries extends Table {
  TextColumn get userScope => text()();
  TextColumn get namespace => text()();
  TextColumn get cacheKey => text()();
  TextColumn get jsonValue => text()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get expiresAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {userScope, namespace, cacheKey};
}

class ChatSummaries extends Table {
  TextColumn get userId => text()();
  TextColumn get kind => text()();
  TextColumn get chatId => text()();
  TextColumn get jsonValue => text()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {userId, kind, chatId};
}

class ChatMessages extends Table {
  TextColumn get userId => text()();
  TextColumn get chatId => text()();
  TextColumn get localKey => text()();
  TextColumn get messageId => text().nullable()();
  TextColumn get clientMessageId => text().nullable()();
  TextColumn get jsonValue => text()();
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {userId, chatId, localKey};
}

class SyncCursors extends Table {
  TextColumn get userId => text()();
  TextColumn get scope => text()();
  TextColumn get cursor => text()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {userId, scope};
}

class PendingCommands extends Table {
  TextColumn get userId => text()();
  TextColumn get commandId => text()();
  TextColumn get dedupeKey => text()();
  TextColumn get jsonValue => text()();
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {userId, commandId};
}

@DriftDatabase(
  tables: [
    CacheEntries,
    ChatSummaries,
    ChatMessages,
    SyncCursors,
    PendingCommands,
  ],
)
class AppLocalDatabase extends _$AppLocalDatabase {
  AppLocalDatabase() : super(_openConnection());

  AppLocalDatabase.forTesting(super.executor);

  @override
  int get schemaVersion => 1;

  static QueryExecutor _openConnection() {
    return driftDatabase(name: 'dateasy_local_cache');
  }
}

QueryExecutor inMemoryAppLocalDatabaseExecutor() => NativeDatabase.memory();

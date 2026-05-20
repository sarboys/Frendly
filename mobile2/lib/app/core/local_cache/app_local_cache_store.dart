import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:mobile2/app/core/local_cache/app_cache_key.dart';
import 'package:mobile2/app/core/local_cache/app_local_database.dart';

class AppLocalCacheStore {
  AppLocalCacheStore(this._database);

  final AppLocalDatabase _database;

  Future<void> putJson(
    AppCacheKey key,
    Map<String, Object?> json, {
    required DateTime expiresAt,
  }) async {
    await _database.into(_database.cacheEntries).insertOnConflictUpdate(
          CacheEntriesCompanion(
            userScope: Value(key.userScope.value),
            namespace: Value(key.namespace),
            cacheKey: Value(key.value),
            jsonValue: Value(jsonEncode(json)),
            createdAt: Value(DateTime.now()),
            expiresAt: Value(expiresAt),
          ),
        );
  }

  Future<Map<String, Object?>?> getFreshJson(
    AppCacheKey key, {
    required DateTime now,
  }) async {
    final row = await (_database.select(_database.cacheEntries)
          ..where((table) =>
              table.userScope.equals(key.userScope.value) &
              table.namespace.equals(key.namespace) &
              table.cacheKey.equals(key.value)))
        .getSingleOrNull();
    if (row == null || row.expiresAt.isBefore(now)) {
      return null;
    }
    return _decode(row.jsonValue);
  }

  Stream<Map<String, Object?>?> watchFreshJson(
    AppCacheKey key, {
    required DateTime Function() now,
  }) {
    return (_database.select(_database.cacheEntries)
          ..where((table) =>
              table.userScope.equals(key.userScope.value) &
              table.namespace.equals(key.namespace) &
              table.cacheKey.equals(key.value)))
        .watchSingleOrNull()
        .map((row) {
      if (row == null || row.expiresAt.isBefore(now())) {
        return null;
      }
      return _decode(row.jsonValue);
    });
  }

  Future<void> deleteKey(AppCacheKey key) async {
    await (_database.delete(_database.cacheEntries)
          ..where((table) =>
              table.userScope.equals(key.userScope.value) &
              table.namespace.equals(key.namespace) &
              table.cacheKey.equals(key.value)))
        .go();
  }

  Future<void> deleteNamespace({
    required AppCacheUserScope userScope,
    required String namespace,
  }) async {
    await (_database.delete(_database.cacheEntries)
          ..where((table) =>
              table.userScope.equals(userScope.value) &
              table.namespace.equals(namespace)))
        .go();
  }

  Future<void> deleteUser(AppCacheUserScope scope) async {
    await (_database.delete(_database.cacheEntries)
          ..where((table) => table.userScope.equals(scope.value)))
        .go();
  }

  Map<String, Object?> _decode(String source) {
    final value = jsonDecode(source);
    if (value is Map) {
      return value.map((key, value) => MapEntry('$key', value));
    }
    return const {};
  }
}

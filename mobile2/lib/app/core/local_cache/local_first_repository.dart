import 'dart:async';
import 'dart:convert';

import 'package:mobile2/app/core/local_cache/app_cache_key.dart';
import 'package:mobile2/app/core/local_cache/app_local_cache_store.dart';

class LocalFirstRepository {
  LocalFirstRepository(this._store);

  final AppLocalCacheStore _store;
  final Map<String, Future<void>> _refreshes = <String, Future<void>>{};

  Future<T> fetch<T>({
    required AppCacheKey key,
    required Duration ttl,
    required Future<Map<String, Object?>> Function() network,
    required T Function(Map<String, Object?> json) decode,
    bool forceRefresh = false,
  }) async {
    final now = DateTime.now();
    if (!forceRefresh) {
      final cached = await _store.getFreshJson(key, now: now);
      if (cached != null) {
        unawaited(_refreshInBackground(
          key: key,
          ttl: ttl,
          network: network,
        ));
        return decode(cached);
      }
    }
    final fresh = await network();
    await _store.putJson(key, fresh, expiresAt: now.add(ttl));
    return decode(fresh);
  }

  Stream<T> watch<T>({
    required AppCacheKey key,
    required Duration ttl,
    required Future<Map<String, Object?>> Function() network,
    required T Function(Map<String, Object?> json) decode,
    bool forceRefresh = false,
  }) async* {
    String? lastJson;

    if (!forceRefresh) {
      final cached = await _store.getFreshJson(key, now: DateTime.now());
      if (cached != null) {
        lastJson = jsonEncode(cached);
        yield decode(cached);
        unawaited(_refreshInBackground(
          key: key,
          ttl: ttl,
          network: network,
        ));
      }
    }

    if (lastJson == null) {
      final fresh = await network();
      lastJson = jsonEncode(fresh);
      await _store.putJson(
        key,
        fresh,
        expiresAt: DateTime.now().add(ttl),
      );
      yield decode(fresh);
    }

    await for (final json in _store.watchFreshJson(
      key,
      now: DateTime.now,
    )) {
      if (json == null) {
        continue;
      }
      final encoded = jsonEncode(json);
      if (encoded == lastJson) {
        continue;
      }
      lastJson = encoded;
      yield decode(json);
    }
  }

  Future<void> _refreshInBackground({
    required AppCacheKey key,
    required Duration ttl,
    required Future<Map<String, Object?>> Function() network,
  }) {
    final refreshKey = _refreshKey(key);
    final existing = _refreshes[refreshKey];
    if (existing != null) {
      return existing;
    }
    final refresh = _runRefresh(key: key, ttl: ttl, network: network);
    _refreshes[refreshKey] = refresh;
    return refresh.whenComplete(() {
      if (identical(_refreshes[refreshKey], refresh)) {
        _refreshes.remove(refreshKey);
      }
    });
  }

  Future<void> _runRefresh({
    required AppCacheKey key,
    required Duration ttl,
    required Future<Map<String, Object?>> Function() network,
  }) async {
    try {
      final fresh = await network();
      await _store.putJson(
        key,
        fresh,
        expiresAt: DateTime.now().add(ttl),
      );
    } catch (_) {}
  }

  String _refreshKey(AppCacheKey key) {
    return '${key.userScope.value}/${key.namespace}/${key.value}';
  }
}

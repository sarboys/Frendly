import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile2/app/core/local_cache/app_cache_key.dart';
import 'package:mobile2/app/core/local_cache/app_local_cache_store.dart';
import 'package:mobile2/app/core/local_cache/app_local_database.dart';
import 'package:mobile2/app/core/providers/core_providers.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/data/backend_repository.dart';
import 'package:mobile2/shared/models/backend_models.dart';

void main() {
  late AppLocalDatabase database;
  late AppLocalCacheStore cacheStore;

  setUp(() {
    database = AppLocalDatabase.forTesting(NativeDatabase.memory());
    cacheStore = AppLocalCacheStore(database);
  });

  tearDown(() async {
    await database.close();
  });

  test('private page providers wait for current user before network', () async {
    var networkCalls = 0;
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          networkCalls += 1;
          return _jsonResponse(options, {'items': <Object?>[]});
        }),
    );
    final container = ProviderContainer(
      overrides: [
        initialAuthTokensProvider.overrideWithValue(
          const AuthTokens(accessToken: 'access', refreshToken: 'refresh'),
        ),
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
      ],
    );
    addTearDown(container.dispose);

    final matches = await container.read(matchesProvider.future);

    expect(matches.items, isEmpty);
    expect(networkCalls, 0);
  });

  test('token wallet returns warm user cache before slow network', () async {
    await cacheStore.putJson(
      AppCacheKey(
        namespace: 'wallet',
        value: 'tokens',
        userScope: AppCacheUserScope.user('u1'),
      ),
      {'balance': 42},
      expiresAt: DateTime.now().add(const Duration(minutes: 5)),
    );
    final releaseNetwork = Completer<void>();
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          await releaseNetwork.future;
          return _jsonResponse(options, {'balance': 99});
        }),
    );
    final container = ProviderContainer(
      overrides: [
        initialAuthTokensProvider.overrideWithValue(
          const AuthTokens(accessToken: 'access', refreshToken: 'refresh'),
        ),
        backendRepositoryProvider.overrideWithValue(repository),
        appLocalCacheStoreProvider.overrideWithValue(cacheStore),
        currentUserProvider.overrideWith((ref) {
          return const BackendUser(id: 'u1', name: 'Alex');
        }),
      ],
    );
    addTearDown(container.dispose);

    final wallet = await container.read(tokenWalletProvider.future).timeout(
          const Duration(milliseconds: 200),
        );

    expect(wallet.balance, 42);
    releaseNetwork.complete();
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

ResponseBody _jsonResponse(RequestOptions options, Object? json) {
  return ResponseBody.fromString(
    jsonEncode(json),
    200,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );
}

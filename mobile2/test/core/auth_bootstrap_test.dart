import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile2/app/core/providers/core_providers.dart';
import 'package:mobile2/shared/data/backend_repository.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('backend completed onboarding survives app reinstall without local flag',
      () async {
    SharedPreferences.setMockInitialValues({});
    final preferences = await SharedPreferences.getInstance();
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          return _jsonResponse(options, {
            'id': 'user-1',
            'displayName': 'Алекс',
            'onboardingComplete': true,
          });
        }),
    );
    final container = ProviderContainer(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(preferences),
        initialAuthTokensProvider.overrideWithValue(
          const AuthTokens(accessToken: 'access', refreshToken: 'refresh'),
        ),
        backendRepositoryProvider.overrideWithValue(repository),
      ],
    );
    addTearDown(container.dispose);

    await container.read(authBootstrapProvider.future);

    expect(container.read(currentUserProvider)?.onboardingComplete, isTrue);
    expect(
      preferences.getBool(completedOnboardingUserStorageKey('user-1')),
      isNull,
    );
  });

  test('auth bootstrap keeps locally completed onboarding after rebuild',
      () async {
    SharedPreferences.setMockInitialValues({
      completedOnboardingUserStorageKey('user-1'): true,
    });
    final preferences = await SharedPreferences.getInstance();
    final repository = BackendRepository(
      Dio(BaseOptions(baseUrl: 'https://api.test'))
        ..httpClientAdapter = _FakeAdapter((options) async {
          return _jsonResponse(options, {
            'id': 'user-1',
            'displayName': 'Алекс',
            'onboardingComplete': false,
          });
        }),
    );
    final container = ProviderContainer(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(preferences),
        initialAuthTokensProvider.overrideWithValue(
          const AuthTokens(accessToken: 'access', refreshToken: 'refresh'),
        ),
        backendRepositoryProvider.overrideWithValue(repository),
      ],
    );
    addTearDown(container.dispose);

    await container.read(authBootstrapProvider.future);

    expect(container.read(currentUserProvider)?.onboardingComplete, isTrue);
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

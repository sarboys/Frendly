import 'dart:convert';

import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/profile.dart';
import 'package:big_break_mobile/shared/models/tokens.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FailOnFetchRepository extends BackendRepository {
  _FailOnFetchRepository({
    required super.ref,
    required super.dio,
  });

  @override
  Future<ProfileData> fetchMe() {
    throw StateError('fetchMe should not be called without saved auth tokens');
  }
}

class _BootstrapShouldNotLoadFullProfileRepository extends BackendRepository {
  _BootstrapShouldNotLoadFullProfileRepository({
    required super.ref,
    required super.dio,
  });

  @override
  Future<ProfileData> fetchProfile() {
    throw StateError('auth bootstrap should not load the full profile');
  }
}

class _UnauthorizedOnFetchRepository extends BackendRepository {
  _UnauthorizedOnFetchRepository({
    required super.ref,
    required super.dio,
  });

  @override
  Future<ProfileData> fetchMe() {
    throw DioException.badResponse(
      statusCode: 401,
      requestOptions: RequestOptions(path: '/profile/me'),
      response: Response(
        requestOptions: RequestOptions(path: '/profile/me'),
        statusCode: 401,
      ),
    );
  }
}

class _MemoryAuthTokenStorage implements AuthTokenStorage {
  _MemoryAuthTokenStorage([this.value]);

  String? value;

  @override
  Future<void> delete() async {
    value = null;
  }

  @override
  Future<String?> read() async => value;

  @override
  Future<void> write(String value) async {
    this.value = value;
  }
}

void main() {
  test('fresh install clears stale secure storage tokens from previous app install',
      () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final storage = _MemoryAuthTokenStorage(
      '{"accessToken":"stale-access","refreshToken":"stale-refresh"}',
    );

    final initialTokens = await restoreInitialAuthTokens(storage, prefs);

    expect(initialTokens, isNull);
    expect(storage.value, isNull);
  });

  test('migrates legacy shared preferences tokens into secure storage',
      () async {
    SharedPreferences.setMockInitialValues({
      'auth.tokens':
          '{"accessToken":"access-token","refreshToken":"refresh-token"}',
    });
    final prefs = await SharedPreferences.getInstance();
    final storage = _MemoryAuthTokenStorage();
    final initialTokens = await restoreInitialAuthTokens(storage, prefs);
    final container = ProviderContainer(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        authTokenStorageProvider.overrideWithValue(storage),
        initialAuthTokensProvider.overrideWithValue(initialTokens),
      ],
    );
    addTearDown(container.dispose);

    final tokens = container.read(authTokensProvider);
    expect(tokens?.accessToken, 'access-token');
    expect(tokens?.refreshToken, 'refresh-token');
    expect(
      storage.value,
      jsonEncode(const AuthTokens(
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      ).toJson()),
    );
    expect(prefs.getString('auth.tokens'), isNull);
  });

  test('auth bootstrap does not dev login without saved tokens', () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final container = ProviderContainer(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        authTokenStorageProvider.overrideWithValue(_MemoryAuthTokenStorage()),
        backendRepositoryProvider.overrideWith(
          (ref) => _FailOnFetchRepository(ref: ref, dio: Dio()),
        ),
      ],
    );
    addTearDown(container.dispose);

    await container.read(authBootstrapProvider.future);

    expect(container.read(authTokensProvider), isNull);
    expect(container.read(currentUserIdProvider), isNull);
  });

  test('auth bootstrap keeps tokens on non-auth fetch failure', () async {
    SharedPreferences.setMockInitialValues({
      'theme.mode': 'light',
    });
    final prefs = await SharedPreferences.getInstance();
    final storage = _MemoryAuthTokenStorage(
      '{"accessToken":"stale-access","refreshToken":"stale-refresh"}',
    );
    final initialTokens = await restoreInitialAuthTokens(storage, prefs);
    final container = ProviderContainer(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        authTokenStorageProvider.overrideWithValue(storage),
        initialAuthTokensProvider.overrideWithValue(initialTokens),
        backendRepositoryProvider.overrideWith(
          (ref) => _FailOnFetchRepository(ref: ref, dio: Dio()),
        ),
      ],
    );
    addTearDown(container.dispose);

    await container.read(authBootstrapProvider.future);

    expect(container.read(authTokensProvider)?.accessToken, 'stale-access');
    expect(container.read(currentUserIdProvider), isNull);
    expect(storage.value, isNotNull);
  });

  test('auth bootstrap clears tokens on explicit unauthorized response',
      () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final storage = _MemoryAuthTokenStorage(
      '{"accessToken":"stale-access","refreshToken":"stale-refresh"}',
    );
    final initialTokens = await restoreInitialAuthTokens(storage, prefs);
    final container = ProviderContainer(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        authTokenStorageProvider.overrideWithValue(storage),
        initialAuthTokensProvider.overrideWithValue(initialTokens),
        backendRepositoryProvider.overrideWith(
          (ref) => _UnauthorizedOnFetchRepository(ref: ref, dio: Dio()),
        ),
      ],
    );
    addTearDown(container.dispose);

    await container.read(authBootstrapProvider.future);

    expect(container.read(authTokensProvider), isNull);
    expect(storage.value, isNull);
  });

  test(
      'auth bootstrap validates saved tokens without loading onboarding profile',
      () async {
    SharedPreferences.setMockInitialValues({
      'auth.tokens':
          '{"accessToken":"access-token","refreshToken":"refresh-token"}',
    });
    final prefs = await SharedPreferences.getInstance();
    final storage = _MemoryAuthTokenStorage(
      '{"accessToken":"access-token","refreshToken":"refresh-token"}',
    );
    final initialTokens = await restoreInitialAuthTokens(storage, prefs);
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.path == '/profile/me') {
            handler.resolve(
              Response<Map<String, dynamic>>(
                requestOptions: options,
                data: const {
                  'id': 'user-me',
                  'displayName': 'Никита М',
                  'verified': true,
                  'online': true,
                  'rating': 4.8,
                  'meetupCount': 12,
                },
              ),
            );
            return;
          }

          handler.reject(
            DioException(
              requestOptions: options,
              message: 'Unexpected request: ${options.path}',
            ),
          );
        },
      ),
    );
    final container = ProviderContainer(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        authTokenStorageProvider.overrideWithValue(storage),
        initialAuthTokensProvider.overrideWithValue(initialTokens),
        backendRepositoryProvider.overrideWith(
          (ref) => _BootstrapShouldNotLoadFullProfileRepository(
            ref: ref,
            dio: dio,
          ),
        ),
      ],
    );
    addTearDown(container.dispose);

    await container.read(authBootstrapProvider.future);

    expect(container.read(currentUserIdProvider), 'user-me');
    expect(container.read(authTokensProvider)?.accessToken, 'access-token');
    expect(storage.value, isNotNull);
  });
}

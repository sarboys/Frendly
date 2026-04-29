import 'dart:async';
import 'dart:convert';

import 'package:big_break_mobile/app/core/config/backend_config.dart';
import 'package:big_break_mobile/app/core/network/api_client.dart';
import 'package:big_break_mobile/app/core/network/chat_socket_client.dart';
import 'package:big_break_mobile/shared/models/tokens.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _tokensStorageKey = 'auth.tokens';
const _installMarkerKey = 'app.install.marker.v1';

final initialAuthTokensProvider = Provider<AuthTokens?>((ref) => null);

final authTokenStorageProvider = Provider<AuthTokenStorage?>((ref) => null);

final authTokensProvider =
    StateNotifierProvider<AuthTokensController, AuthTokens?>(
  (ref) => AuthTokensController(
    ref.read(sharedPreferencesProvider),
    tokenStorage: ref.read(authTokenStorageProvider),
    initialTokens: ref.read(initialAuthTokensProvider),
  ),
);

final currentUserIdProvider = StateProvider<String?>((ref) => null);

final sharedPreferencesProvider = Provider<SharedPreferences?>((ref) => null);

abstract class AuthTokenStorage {
  Future<String?> read();
  Future<void> write(String value);
  Future<void> delete();
}

class FlutterAuthTokenStorage implements AuthTokenStorage {
  const FlutterAuthTokenStorage(this._storage);

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read() => _storage.read(key: _tokensStorageKey);

  @override
  Future<void> write(String value) =>
      _storage.write(key: _tokensStorageKey, value: value);

  @override
  Future<void> delete() => _storage.delete(key: _tokensStorageKey);
}

AuthTokens? decodeAuthTokens(String? raw) {
  if (raw == null || raw.isEmpty) {
    return null;
  }

  final decoded = jsonDecode(raw);
  if (decoded is! Map) {
    return null;
  }

  return AuthTokens.fromJson(Map<String, dynamic>.from(decoded));
}

Future<AuthTokens?> restoreInitialAuthTokens(
  AuthTokenStorage? storage,
  SharedPreferences? preferences,
) async {
  final hasInstallMarker = preferences?.getBool(_installMarkerKey) == true;
  final secureRaw = await storage?.read();
  final legacyRaw = preferences?.getString(_tokensStorageKey);
  final hasAnyLocalPrefs = (preferences?.getKeys().isNotEmpty ?? false);

  if (!hasInstallMarker) {
    await preferences?.setBool(_installMarkerKey, true);
    if (secureRaw != null &&
        secureRaw.isNotEmpty &&
        (legacyRaw == null || legacyRaw.isEmpty) &&
        !hasAnyLocalPrefs) {
      await storage?.delete();
      await preferences?.remove(_tokensStorageKey);
      return null;
    }
  }

  final secureTokens = decodeAuthTokens(secureRaw);
  if (secureTokens != null) {
    await preferences?.remove(_tokensStorageKey);
    return secureTokens;
  }

  final legacyTokens = decodeAuthTokens(legacyRaw);
  if (legacyTokens == null) {
    return null;
  }

  if (storage != null) {
    await storage.write(jsonEncode(legacyTokens.toJson()));
  }
  await preferences?.remove(_tokensStorageKey);
  return legacyTokens;
}

final apiClientProvider = Provider<ApiClient>((ref) {
  final controller = ref.read(authTokensProvider.notifier);
  return ApiClient(
    readAccessToken: controller.readAccessToken,
    refreshTokens: controller.refreshTokens,
  );
});

final chatSocketClientProvider = Provider<ChatSocketClient>((ref) {
  final controller = ref.read(authTokensProvider.notifier);
  final preferences = ref.read(sharedPreferencesProvider);
  final client = ChatSocketClient(
    accessTokenProvider: controller.requireAccessToken,
    refreshSession: () async {
      await controller.refreshTokens();
    },
    outboxStorage: preferences == null
        ? null
        : SharedPreferencesChatOutboxStorage(preferences),
  );
  ref.onDispose(() {
    client.dispose();
  });
  return client;
});

class AuthTokensController extends StateNotifier<AuthTokens?> {
  AuthTokensController(
    this._preferences, {
    required AuthTokenStorage? tokenStorage,
    AuthTokens? initialTokens,
    Dio Function()? createRefreshDio,
  })  : _createRefreshDio = createRefreshDio ?? _defaultRefreshDio,
        _tokenStorage = tokenStorage,
        super(initialTokens);

  final SharedPreferences? _preferences;
  final AuthTokenStorage? _tokenStorage;
  final Dio Function() _createRefreshDio;
  Future<AuthTokens>? _refreshFuture;

  void setTokens(AuthTokens tokens) {
    state = tokens;
    unawaited(_persist(tokens));
  }

  void clear() {
    state = null;
    unawaited(_clearPersistedTokens());
  }

  Future<String?> readAccessToken() async => state?.accessToken;

  Future<String> requireAccessToken() async {
    final token = state?.accessToken;
    if (token == null) {
      throw StateError('Auth token is not initialized');
    }
    return token;
  }

  Future<AuthTokens> refreshTokens() async {
    final pending = _refreshFuture;
    if (pending != null) {
      return pending;
    }

    final future = _refreshTokensInternal();
    _refreshFuture = future;

    try {
      return await future;
    } finally {
      if (identical(_refreshFuture, future)) {
        _refreshFuture = null;
      }
    }
  }

  Future<AuthTokens> _refreshTokensInternal() async {
    final current = state;
    if (current == null) {
      throw StateError('Cannot refresh without refresh token');
    }

    final dio = _createRefreshDio();
    Response<Map<String, dynamic>> response;
    try {
      _debugAuthLog('Refreshing auth tokens');
      response = await dio.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {
          'refreshToken': current.refreshToken,
        },
      );
    } on DioException catch (error) {
      if (error.response?.statusCode == 401) {
        _debugAuthLog('Refresh token rejected, clearing session');
        clear();
      } else {
        _debugAuthLog('Refresh token request failed: ${error.type}');
      }
      rethrow;
    }
    final nextTokens = AuthTokens.fromJson(response.data!);
    state = nextTokens;
    await _persist(nextTokens);
    _debugAuthLog('Auth tokens refreshed');
    return nextTokens;
  }

  Future<void> _persist(AuthTokens tokens) async {
    final raw = jsonEncode(tokens.toJson());
    await _tokenStorage?.write(raw);
    await _preferences?.remove(_tokensStorageKey);
  }

  Future<void> _clearPersistedTokens() async {
    await _tokenStorage?.delete();
    await _preferences?.remove(_tokensStorageKey);
  }

  static const defaultSecureStorage = FlutterSecureStorage(
    aOptions: AndroidOptions(
      encryptedSharedPreferences: true,
    ),
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.first_unlock_this_device,
    ),
  );

  static Dio _defaultRefreshDio() {
    return Dio(
      BaseOptions(
        baseUrl: BackendConfig.apiBaseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 20),
        headers: const {'content-type': 'application/json'},
      ),
    );
  }
}

void _debugAuthLog(String message) {
  if (kDebugMode || kProfileMode) {
    debugPrint(message);
  }
}

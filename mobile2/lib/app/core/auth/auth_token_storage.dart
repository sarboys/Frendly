import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:shared_preferences/shared_preferences.dart';

const authTokensStorageKey = 'auth.tokens.v1';
const legacyAuthTokensStorageKey = 'auth.tokens';

abstract class AuthTokenStorage {
  Future<AuthTokens?> read();

  Future<void> write(AuthTokens tokens);

  Future<void> clear();
}

class SecureAuthTokenStorage implements AuthTokenStorage {
  SecureAuthTokenStorage({
    FlutterSecureStorage? secureStorage,
    SharedPreferences? preferences,
  })  : _secureStorage = secureStorage ?? const FlutterSecureStorage(),
        _preferences = preferences;

  final FlutterSecureStorage _secureStorage;
  final SharedPreferences? _preferences;

  @override
  Future<AuthTokens?> read() async {
    final raw = await _secureStorage.read(key: authTokensStorageKey);
    if (raw != null) {
      return _decode(raw);
    }
    final legacy = _preferences?.getString(legacyAuthTokensStorageKey);
    final tokens = _decode(legacy);
    if (tokens != null) {
      await write(tokens);
      await _preferences?.remove(legacyAuthTokensStorageKey);
    }
    return tokens;
  }

  @override
  Future<void> write(AuthTokens tokens) {
    return _secureStorage.write(
      key: authTokensStorageKey,
      value: jsonEncode(tokens.toJson()),
    );
  }

  @override
  Future<void> clear() {
    return _secureStorage.delete(key: authTokensStorageKey);
  }

  AuthTokens? _decode(String? raw) {
    if (raw == null || raw.isEmpty) {
      return null;
    }
    final value = jsonDecode(raw);
    if (value is Map) {
      return AuthTokens.fromJson(
          value.map((key, value) => MapEntry('$key', value)));
    }
    return null;
  }
}

class AuthTokensController extends StateNotifier<AuthTokens?> {
  AuthTokensController({
    required AuthTokenStorage? storage,
    AuthTokens? initialTokens,
  })  : _storage = storage,
        super(initialTokens);

  final AuthTokenStorage? _storage;
  Future<void> _writeQueue = Future<void>.value();

  AuthTokens? get currentTokens => state;

  Future<void> setTokens(AuthTokens tokens) {
    state = tokens;
    return _enqueue(() => _storage?.write(tokens) ?? Future<void>.value());
  }

  Future<void> clear() {
    state = null;
    return _enqueue(() => _storage?.clear() ?? Future<void>.value());
  }

  Future<void> _enqueue(Future<void> Function() operation) {
    final next = _writeQueue.then((_) => operation());
    _writeQueue = next.catchError((_) {});
    return next;
  }
}

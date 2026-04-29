import 'package:big_break_mobile/app/core/config/backend_config.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/auth_flow.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';

final socialAuthServiceProvider = Provider<SocialAuthService>((ref) {
  return OAuthSocialAuthService(
    repository: ref.read(backendRepositoryProvider),
  );
});

abstract class SocialAuthService {
  Future<PhoneAuthSession> signInWithGoogle();
  Future<PhoneAuthSession> signInWithYandex();
}

class OAuthSocialAuthService implements SocialAuthService {
  OAuthSocialAuthService({
    required BackendRepository repository,
    GoogleSignIn? googleSignIn,
    YandexNativeAuthClient? yandexAuthClient,
  })  : _repository = repository,
        _googleSignIn = googleSignIn ?? GoogleSignIn.instance,
        _yandexAuthClient =
            yandexAuthClient ?? const MethodChannelYandexNativeAuthClient();

  final BackendRepository _repository;
  final GoogleSignIn _googleSignIn;
  final YandexNativeAuthClient _yandexAuthClient;
  Future<void>? _googleInitFuture;

  @override
  Future<PhoneAuthSession> signInWithGoogle() async {
    await _ensureGoogleInitialized();

    if (!_googleSignIn.supportsAuthenticate()) {
      throw const SocialAuthConfigException('Google sign-in is not supported');
    }

    final account = await _googleSignIn.authenticate();
    final idToken = account.authentication.idToken;
    if (idToken == null || idToken.isEmpty) {
      throw const SocialAuthConfigException('Google id token is missing');
    }

    return _repository.verifyGoogleIdToken(idToken);
  }

  @override
  Future<PhoneAuthSession> signInWithYandex() async {
    final oauthToken = await _yandexAuthClient.signIn(
      clientId: _emptyToNull(BackendConfig.yandexOAuthClientId),
    );
    return _repository.verifyYandexOAuthToken(oauthToken);
  }

  Future<void> _ensureGoogleInitialized() {
    return _googleInitFuture ??= _googleSignIn.initialize(
      clientId: _emptyToNull(BackendConfig.googleClientId),
      serverClientId: _emptyToNull(BackendConfig.googleServerClientId),
    );
  }

  String? _emptyToNull(String value) {
    return value.isEmpty ? null : value;
  }
}

abstract class YandexNativeAuthClient {
  Future<String> signIn({String? clientId});
}

class MethodChannelYandexNativeAuthClient implements YandexNativeAuthClient {
  const MethodChannelYandexNativeAuthClient({
    MethodChannel channel = const MethodChannel('app.yandex.auth'),
  }) : _channel = channel;

  final MethodChannel _channel;

  @override
  Future<String> signIn({String? clientId}) async {
    final token = await _channel.invokeMethod<String>(
      'signIn',
      {
        if (clientId != null && clientId.isNotEmpty) 'clientId': clientId,
      },
    );
    final trimmed = token?.trim() ?? '';
    if (trimmed.isEmpty) {
      throw const SocialAuthProviderException('missing_yandex_token');
    }
    return trimmed;
  }
}

class SocialAuthConfigException implements Exception {
  const SocialAuthConfigException(this.message);

  final String message;

  @override
  String toString() => message;
}

class SocialAuthProviderException implements Exception {
  const SocialAuthProviderException(this.code);

  final String code;

  @override
  String toString() => code;
}

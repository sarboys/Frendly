import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

final appPushTokenServiceProvider = Provider<AppPushTokenService>(
  (ref) => NativeAppPushTokenService(
    sharedPreferences: ref.read(sharedPreferencesProvider),
  ),
);

const _pushDeviceIdStorageKey = 'push.device_id';
const _pushTokenChannel = MethodChannel('app.push.token');

class RegisteredPushToken {
  const RegisteredPushToken({
    required this.token,
    required this.provider,
    required this.deviceId,
    required this.platform,
  });

  final String token;
  final String provider;
  final String deviceId;
  final String platform;
}

abstract class AppPushTokenService {
  Future<RegisteredPushToken?> registerDeviceToken();
  Future<String?> currentDeviceId();
  Future<void> clearRegisteredToken();
}

class UnsupportedAppPushTokenService implements AppPushTokenService {
  const UnsupportedAppPushTokenService();

  @override
  Future<RegisteredPushToken?> registerDeviceToken() async {
    return null;
  }

  @override
  Future<String?> currentDeviceId() async {
    return null;
  }

  @override
  Future<void> clearRegisteredToken() async {}
}

class NativeAppPushTokenService implements AppPushTokenService {
  NativeAppPushTokenService({
    required SharedPreferences? sharedPreferences,
    MethodChannel? channel,
    TargetPlatform? platformOverride,
  })  : _sharedPreferences = sharedPreferences,
        _channel = channel ?? _pushTokenChannel,
        _platform = platformOverride;

  final SharedPreferences? _sharedPreferences;
  final MethodChannel _channel;
  final TargetPlatform? _platform;

  TargetPlatform get _targetPlatform => _platform ?? defaultTargetPlatform;

  bool get _supportsPushTokenRegistration =>
      !kIsWeb && _targetPlatform == TargetPlatform.iOS;

  @override
  Future<RegisteredPushToken?> registerDeviceToken() async {
    if (!_supportsPushTokenRegistration) {
      return null;
    }

    try {
      final token = await _channel.invokeMethod<String>('registerDeviceToken');
      if (token == null || token.isEmpty) {
        return null;
      }

      return RegisteredPushToken(
        token: token,
        provider: 'apns',
        deviceId: await _resolveDeviceId(),
        platform: 'ios',
      );
    } on PlatformException {
      return null;
    } on MissingPluginException {
      return null;
    }
  }

  @override
  Future<void> clearRegisteredToken() async {
    if (!_supportsPushTokenRegistration) {
      return;
    }

    try {
      await _channel.invokeMethod<void>('clearRegisteredToken');
    } on PlatformException {
      return;
    } on MissingPluginException {
      return;
    }
  }

  @override
  Future<String?> currentDeviceId() async {
    final existing = _sharedPreferences?.getString(_pushDeviceIdStorageKey);
    return existing == null || existing.isEmpty ? null : existing;
  }

  Future<String> _resolveDeviceId() async {
    final existing = _sharedPreferences?.getString(_pushDeviceIdStorageKey);
    if (existing != null && existing.isNotEmpty) {
      return existing;
    }

    final generated =
        'ios-push-${DateTime.now().microsecondsSinceEpoch.toRadixString(16)}';
    await _sharedPreferences?.setString(_pushDeviceIdStorageKey, generated);
    return generated;
  }
}

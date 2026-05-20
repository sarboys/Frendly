import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile2/app/core/device/app_push_token_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel('app.push.token');
  final calls = <MethodCall>[];

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    calls.clear();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
      calls.add(call);
      switch (call.method) {
        case 'registerDeviceToken':
          return 'native-token-123';
        case 'clearRegisteredToken':
          return null;
      }
      return null;
    });
  });

  tearDown(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  test('registers ios token and keeps stable device id', () async {
    final preferences = await SharedPreferences.getInstance();
    final service = NativeAppPushTokenService(
      sharedPreferences: preferences,
      channel: channel,
      platformOverride: TargetPlatform.iOS,
    );

    final first = await service.registerDeviceToken();
    final second = await service.registerDeviceToken();

    expect(first, isNotNull);
    expect(first!.token, 'native-token-123');
    expect(first.provider, 'apns');
    expect(first.platform, 'ios');
    expect(first.deviceId, startsWith('iOS-push-'));
    expect(second!.deviceId, first.deviceId);
    expect(await service.currentDeviceId(), first.deviceId);
  });

  test('registers android token as fcm when native channel is present',
      () async {
    final preferences = await SharedPreferences.getInstance();
    final service = NativeAppPushTokenService(
      sharedPreferences: preferences,
      channel: channel,
      platformOverride: TargetPlatform.android,
    );

    final token = await service.registerDeviceToken();

    expect(token, isNotNull);
    expect(token!.provider, 'fcm');
    expect(token.platform, 'android');
  });

  test('clears native token cache', () async {
    final preferences = await SharedPreferences.getInstance();
    final service = NativeAppPushTokenService(
      sharedPreferences: preferences,
      channel: channel,
      platformOverride: TargetPlatform.iOS,
    );

    await service.clearRegisteredToken();

    expect(calls.single.method, 'clearRegisteredToken');
  });
}

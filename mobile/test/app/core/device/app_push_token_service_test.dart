import 'package:big_break_mobile/app/core/device/app_push_token_service.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
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
          return 'apns-token-123';
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

  test('native push token service registers token and persists device id',
      () async {
    final preferences = await SharedPreferences.getInstance();
    final service = NativeAppPushTokenService(
      sharedPreferences: preferences,
      channel: channel,
      platformOverride: TargetPlatform.iOS,
    );

    final first = await service.registerDeviceToken();
    final second = await service.registerDeviceToken();

    expect(first, isNotNull);
    expect(first!.token, 'apns-token-123');
    expect(first.provider, 'apns');
    expect(first.platform, 'ios');
    expect(first.deviceId, isNotEmpty);
    expect(second!.deviceId, first.deviceId);
    expect(
      calls.where((call) => call.method == 'registerDeviceToken').length,
      2,
    );
  });

  test('native push token service clears platform token cache', () async {
    final preferences = await SharedPreferences.getInstance();
    final service = NativeAppPushTokenService(
      sharedPreferences: preferences,
      channel: channel,
      platformOverride: TargetPlatform.iOS,
    );

    await service.clearRegisteredToken();

    expect(calls.single.method, 'clearRegisteredToken');
  });

  test('native push token service exposes current generated device id', () async {
    final preferences = await SharedPreferences.getInstance();
    final service = NativeAppPushTokenService(
      sharedPreferences: preferences,
      channel: channel,
      platformOverride: TargetPlatform.iOS,
    );

    final registered = await service.registerDeviceToken();
    final deviceId = await service.currentDeviceId();

    expect(deviceId, registered!.deviceId);
  });
}

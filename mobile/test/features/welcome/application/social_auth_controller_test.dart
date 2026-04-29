import 'package:big_break_mobile/features/welcome/application/social_auth_controller.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('yandex native client returns oauth token from method channel', () async {
    const channel = MethodChannel('test.yandex.auth');
    final messenger = TestDefaultBinaryMessengerBinding
        .instance.defaultBinaryMessenger;

    addTearDown(() => messenger.setMockMethodCallHandler(channel, null));
    messenger.setMockMethodCallHandler(channel, (call) async {
      expect(call.method, 'signIn');
      return 'oauth-token';
    });

    const client = MethodChannelYandexNativeAuthClient(channel: channel);

    expect(await client.signIn(), 'oauth-token');
  });
}

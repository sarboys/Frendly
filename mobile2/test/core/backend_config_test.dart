import 'package:flutter_test/flutter_test.dart';
import 'package:mobile2/app/core/config/backend_config.dart';

void main() {
  test('uses production Frendly API by default', () {
    expect(BackendConfig.apiBaseUrl, 'https://api.frendly.tech');
    expect(BackendConfig.chatWebSocketUrl, 'wss://api.frendly.tech/ws');
    expect(BackendConfig.telegramBotUsername, 'frendly_code_bot');
    expect(BackendConfig.mapKitKey, '');
    expect(BackendConfig.hasMapKitKey, false);
  });

  test('recognizes seeded phone auth shortcuts', () {
    expect(BackendConfig.isSeededTestPhoneShortcutNumber('+71111111111'), true);
    expect(
        BackendConfig.isSeededTestPhoneShortcutNumber('+79991234567'), false);
  });

  test('validates mapkit keys before creating native map', () {
    expect(BackendConfig.isUsableMapKitKey(''), false);
    expect(BackendConfig.isUsableMapKitKey('your-mapkit-key'), false);
    expect(
        BackendConfig.isUsableMapKitKey(r'$(BIG_BREAK_MAPKIT_API_KEY)'), false);
    expect(BackendConfig.isUsableMapKitKey('real-key'), true);
  });
}

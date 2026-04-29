class BackendConfig {
  const BackendConfig._();

  static const apiBaseUrl = String.fromEnvironment(
    'BIG_BREAK_API_URL',
    defaultValue: 'https://api.frendly.tech',
  );

  static const chatWsUrl = String.fromEnvironment(
    'BIG_BREAK_CHAT_WS_URL',
    defaultValue: 'wss://api.frendly.tech/ws',
  );

  static const telegramBotUsername = String.fromEnvironment(
    'BIG_BREAK_TELEGRAM_BOT_USERNAME',
    defaultValue: 'frendly_code_bot',
  );

  static const facebookAppId = String.fromEnvironment(
    'BIG_BREAK_FACEBOOK_APP_ID',
    defaultValue: '955838486813478',
  );

  static const enableTestPhoneShortcuts = bool.fromEnvironment(
    'BIG_BREAK_ENABLE_TEST_PHONE_SHORTCUTS',
    defaultValue: false,
  );

  static const googleClientId = String.fromEnvironment(
    'BIG_BREAK_GOOGLE_CLIENT_ID',
    defaultValue: '',
  );

  static const googleServerClientId = String.fromEnvironment(
    'BIG_BREAK_GOOGLE_SERVER_CLIENT_ID',
    defaultValue: '',
  );

  static const yandexOAuthClientId = String.fromEnvironment(
    'BIG_BREAK_YANDEX_CLIENT_ID',
    defaultValue: '',
  );

  static Uri telegramAuthUri(String startToken) {
    return Uri.parse(
      'https://t.me/$telegramBotUsername?start=login_$startToken',
    );
  }
}

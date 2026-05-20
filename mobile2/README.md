# Dateasy Mobile2

Новое Flutter приложение под дизайн `front2`.

Главные документы перед работой:
- `../docs/design-system-big-break.md`
- `../docs/flutter-ui-mapping-big-break.md`
- `../docs/flutter-engineering-standards.md`

## Install

Нужно поставить:
- Xcode из App Store
- Flutter SDK
- CocoaPods

Проверка окружения:

```bash
flutter doctor
```

Подготовка проекта:

```bash
cd mobile2
flutter pub get
cd ios
pod install
cd ..
```

## Запуск через Flutter

```bash
cd mobile2
flutter run
```

На первом этапе новый Dart UI работает на моковых данных.
Backend и realtime еще не подключены.

Если нужен другой backend:

```bash
flutter run \
  --dart-define=BIG_BREAK_MAPKIT_API_KEY=your-mapkit-key \
  --dart-define=BIG_BREAK_API_URL=https://your-api-host \
  --dart-define=BIG_BREAK_CHAT_WS_URL=wss://your-api-host/ws \
  --dart-define=BIG_BREAK_TELEGRAM_BOT_USERNAME=your_bot
```

Android и iOS берут MapKit ключ из `BIG_BREAK_MAPKIT_API_KEY`.
Для Flutter CLI передавай его через `--dart-define`.
Для Android также работают переменная окружения и Gradle property.
Реальный ключ не коммить.

Если запускаешь iOS из Xcode, создай локальный файл:

```bash
cp ios/Flutter/Secrets.xcconfig.example ios/Flutter/Secrets.xcconfig
```

И впиши туда ключи:

```xcconfig
BIG_BREAK_MAPKIT_API_KEY=your-mapkit-key
BIG_BREAK_YANDEX_CLIENT_ID=your-yandex-client-id
```

`Secrets.xcconfig` игнорируется git. После изменения ключа в Xcode сделай clean build.

## Сборка руками в Xcode

1. Выполни подготовку из блока `Install`.
2. Создай `ios/Flutter/Secrets.xcconfig`, если запускаешь из Xcode.
3. Открой workspace, не project:

```bash
open mobile2/ios/Runner.xcworkspace
```

4. В Xcode выбери scheme `Runner`.
5. Выбери устройство или симулятор.
6. Открой `Runner` -> `Signing & Capabilities`.
7. Выбери свой `Team`.
8. Если Xcode попросит, поменяй `Bundle Identifier` на уникальный.
9. Нажми `Product` -> `Build`.
10. Для запуска нажми `Product` -> `Run`.

Если Pods не подтянулись или Xcode ругается на зависимости:

```bash
cd mobile2
flutter clean
flutter pub get
cd ios
pod install
cd ..
```

Важно: открывать нужно `Runner.xcworkspace`. Если открыть `Runner.xcodeproj`, Pods могут не собраться.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile2/features/notifications/presentation/notifications_screen.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';

void main() {
  testWidgets('notification row keeps long text and cta inside narrow screen',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(320, 720));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          notificationsProvider.overrideWith((ref) {
            return Stream.value(
              BackendPage(
                items: [
                  BackendCardItem.fromJson({
                    'id': 'n1',
                    'title': 'Очень длинное имя пользователя',
                    'body':
                        'оставил длинное уведомление про встречу и чат рядом',
                    'createdAt': '2026-05-19T09:00:00.000Z',
                    'cta': 'Ответить сейчас',
                  }),
                ],
              ),
            );
          }),
          notificationUnreadCountProvider
              .overrideWith((ref) => Future.value(1)),
        ],
        child: MaterialApp(
          theme: DateasyTheme.theme,
          home: const NotificationsScreen(),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text('Ответить сейчас'), findsOneWidget);
  });

  testWidgets('notification filters show only selected type', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 820));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          notificationsProvider.overrideWith((ref) {
            return Stream.value(
              BackendPage(
                items: [
                  BackendCardItem.fromJson({
                    'id': 'n1',
                    'kind': 'match',
                    'title': 'Мэтч',
                    'body': 'у вас мэтч',
                    'createdAt': '2026-05-19T09:00:00.000Z',
                  }),
                  BackendCardItem.fromJson({
                    'id': 'n2',
                    'kind': 'event_invite',
                    'title': 'Приглашение',
                    'body': 'пригласил на встречу',
                    'createdAt': '2026-05-19T09:05:00.000Z',
                    'payload': {
                      'eventId': 'event-1',
                      'requestId': 'request-1',
                      'invite': true,
                    },
                  }),
                ],
              ),
            );
          }),
          notificationUnreadCountProvider
              .overrideWith((ref) => Future.value(2)),
        ],
        child: MaterialApp(
          theme: DateasyTheme.theme,
          home: const NotificationsScreen(),
        ),
      ),
    );

    await tester.pumpAndSettle();
    await tester.tap(find.text('Встречи'));
    await tester.pumpAndSettle();

    expect(_richTextContaining('пригласил на встречу'), findsOneWidget);
    expect(_richTextContaining('у вас мэтч'), findsNothing);
  });

  testWidgets('notifications screen shows empty state', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 820));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          notificationsProvider.overrideWith((ref) {
            return Stream.value(const BackendPage(items: []));
          }),
          notificationUnreadCountProvider
              .overrideWith((ref) => Future.value(0)),
        ],
        child: MaterialApp(
          theme: DateasyTheme.theme,
          home: const NotificationsScreen(),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Уведомлений пока нет'), findsOneWidget);
    expect(find.text('Новых уведомлений нет'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('notifications screen shows provider error state',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 820));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          notificationsProvider.overrideWith((ref) {
            return Stream<CardPage>.error(Exception('offline'));
          }),
          notificationUnreadCountProvider
              .overrideWith((ref) => Future.value(0)),
        ],
        child: MaterialApp(
          theme: DateasyTheme.theme,
          home: const NotificationsScreen(),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Уведомления недоступны'), findsOneWidget);
    expect(find.text('Новых уведомлений нет'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

Finder _richTextContaining(String text) {
  return find.byWidgetPredicate(
    (widget) => widget is RichText && widget.text.toPlainText().contains(text),
    description: 'RichText containing "$text"',
  );
}

import 'package:big_break_mobile/features/notifications/presentation/notifications_screen.dart';
import 'package:big_break_mobile/features/user_profile/presentation/user_profile_screen.dart';
import 'package:big_break_mobile/features/profile/presentation/profile_screen.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/notification_item.dart';
import 'package:big_break_mobile/shared/models/profile.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../test_overrides.dart';

class _FakeNotificationsRepository extends BackendRepository {
  _FakeNotificationsRepository({
    required super.ref,
    required super.dio,
    this.onMarkAllRead,
  });

  int markAllReadCalls = 0;
  final VoidCallback? onMarkAllRead;

  @override
  Future<void> markAllNotificationsRead() async {
    markAllReadCalls += 1;
    onMarkAllRead?.call();
  }
}

Widget _wrap(
  Widget child, {
  List<Override> extraOverrides = const [],
}) {
  return ProviderScope(
    overrides: [
      ...buildTestOverrides(),
      ...extraOverrides,
    ],
    child: MaterialApp(home: child),
  );
}

void main() {
  testWidgets(
    'notifications screen groups by day and shows relative time',
    (tester) async {
      final now = DateTime.now();
      final notifications = [
        NotificationItem(
          id: 'n1',
          kind: 'event_invite',
          title: 'Приглашение',
          body: 'позвала тебя на «Винный вечер на крыше» сегодня в 20:00',
          payload: const {
            'eventId': 'e1',
            'personName': 'Аня К',
          },
          readAt: null,
          createdAt: now.subtract(const Duration(minutes: 5)),
        ),
        NotificationItem(
          id: 'n2',
          kind: 'like',
          title: 'Лайк',
          body: 'отметила вас как интересного человека',
          payload: const {
            'personName': 'Лиза П',
          },
          readAt: DateTime(now.year, now.month, now.day - 1, 10, 0),
          createdAt: now.subtract(const Duration(days: 1)),
        ),
      ];

      await tester.pumpWidget(
        _wrap(
          const NotificationsScreen(),
          extraOverrides: [
            notificationsProvider.overrideWith((ref) async => notifications),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Сегодня'), findsOneWidget);
      expect(find.text('Раньше'), findsOneWidget);
      expect(find.textContaining('Аня К'), findsOneWidget);
      expect(find.text('5 мин'), findsOneWidget);
      expect(find.text('вчера'), findsOneWidget);
      expect(find.text('Принять'), findsOneWidget);
      expect(find.text('Не сейчас'), findsOneWidget);
    },
  );

  testWidgets('profile screen renders short first name in header card',
      (tester) async {
    await tester.pumpWidget(_wrap(const ProfileScreen()));
    await tester.pumpAndSettle();

    expect(find.text('Никита, 28'), findsOneWidget);
    expect(find.text('Никита М, 28'), findsNothing);
    await tester.scrollUntilVisible(find.text('Frendly After Dark'), 200);
    expect(find.text('Frendly After Dark'), findsOneWidget);
  });

  testWidgets('profile screen shows only city when area is empty',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        const ProfileScreen(),
        extraOverrides: [
          profileProvider.overrideWith(
            (ref) async => const ProfileData(
              id: 'user-me',
              displayName: 'Никита М',
              verified: true,
              online: true,
              age: 28,
              city: 'Москва',
              area: null,
              bio: 'bio',
              vibe: 'Спокойно',
              rating: 4.8,
              meetupCount: 12,
              avatarUrl: null,
              interests: ['Кофе'],
              intent: ['Друзья'],
            ),
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Москва'), findsOneWidget);
    expect(find.textContaining('Чистые пруды'), findsNothing);
  });

  testWidgets('read all clears unread indicator in notifications', (
    tester,
  ) async {
    late _FakeNotificationsRepository fakeRepository;
    var notifications = [
      NotificationItem(
        id: 'n1',
        kind: 'message',
        title: 'Новое сообщение',
        body: 'Аня К: Тогда до восьми у входа?',
        payload: const {'chatId': 'p1'},
        readAt: null,
        createdAt: DateTime.now(),
      ),
    ];

    await tester.pumpWidget(
      _wrap(
        const NotificationsScreen(),
        extraOverrides: [
          backendRepositoryProvider.overrideWith(
            (ref) => fakeRepository = _FakeNotificationsRepository(
              ref: ref,
              dio: Dio(),
              onMarkAllRead: () {
                notifications = notifications
                    .map(
                      (item) => item.copyWith(
                        readAt: item.readAt ?? DateTime.now(),
                      ),
                    )
                    .toList(growable: false);
              },
            ),
          ),
          notificationsProvider.overrideWith((ref) async => notifications),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.byKey(const ValueKey('notification-unread-dot-n1')),
      findsOneWidget,
    );

    await tester.tap(find.text('Всё'));
    await tester.pumpAndSettle();

    expect(
      find.byKey(const ValueKey('notification-unread-dot-n1')),
      findsNothing,
    );
    expect(fakeRepository.markAllReadCalls, 1);
  });

  testWidgets('user profile more button opens moderation actions', (
    tester,
  ) async {
    await tester
        .pumpWidget(_wrap(const UserProfileScreen(userId: 'user-anya')));
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(Icons.more_horiz_rounded));
    await tester.pumpAndSettle();

    expect(find.text('Пожаловаться'), findsOneWidget);
    expect(find.text('Заблокировать'), findsOneWidget);
  });
}

import 'package:big_break_mobile/features/event_detail/presentation/event_detail_screen.dart';
import 'package:big_break_mobile/features/map/presentation/map_screen.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/models/event_detail.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../../test_overrides.dart';

Widget _wrap(Widget child) {
  return ProviderScope(
    overrides: buildTestOverrides(),
    child: MaterialApp(home: child),
  );
}

void main() {
  testWidgets('event detail uses total going count in attendee summary',
      (tester) async {
    await tester.pumpWidget(_wrap(const EventDetailScreen(eventId: 'e1')));
    await tester.pumpAndSettle();

    expect(find.textContaining('и ещё 4'), findsOneWidget);
  });

  testWidgets('event detail shows criteria as muted chips', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          ...buildTestOverrides(),
          eventDetailProvider.overrideWith((ref, eventId) async {
            return const EventDetail(
              id: 'e-criteria',
              title: 'Фестиваль кофе и винила',
              emoji: '☕',
              time: 'Вс, 27 апр · 13:00',
              place: 'Хлебозавод',
              distance: '1.0 км',
              vibe: 'Активно',
              description: 'Обжарщики, виниловые сеты и дегустации.',
              hostNote: null,
              joined: false,
              partnerName: null,
              partnerOffer: null,
              capacity: 8,
              going: 1,
              chatId: 'mc-criteria',
              lifestyle: 'anti',
              priceMode: 'range',
              priceAmountFrom: 700,
              priceAmountTo: 1200,
              accessMode: 'request',
              genderMode: 'female',
              visibilityMode: 'friends',
              host: EventHost(
                id: 'user-me',
                displayName: 'Сергей',
                verified: true,
                rating: 4.8,
                meetupCount: 6,
                avatarUrl: null,
              ),
              attendees: [
                EventAttendee(
                  id: 'user-me',
                  displayName: 'Сергей',
                  avatarUrl: null,
                ),
              ],
            );
          }),
        ],
        child: const MaterialApp(
          home: EventDetailScreen(eventId: 'e-criteria'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.drag(find.byType(CustomScrollView), const Offset(0, -500));
    await tester.pumpAndSettle();

    expect(find.text('Критерии встречи'), findsNothing);
    expect(find.text('Образ жизни'), findsNothing);
    expect(find.text('Стоимость'), findsNothing);
    expect(find.text('Кого приглашают'), findsNothing);
    expect(find.text('Вступление'), findsNothing);
    expect(find.text('Видимость'), findsNothing);
    expect(find.text('До 8 участников'), findsOneWidget);
    expect(find.text('Не ЗОЖ'), findsOneWidget);
    expect(find.text('700-1200 ₽'), findsOneWidget);
    expect(find.text('Девушки'), findsOneWidget);
    expect(find.text('По заявке'), findsOneWidget);
    expect(find.text('По ссылке'), findsNothing);

    final lifestyleValue = tester.widget<Text>(find.text('Не ЗОЖ'));
    expect(lifestyleValue.style?.fontFamily, 'Manrope');
    expect(lifestyleValue.style?.fontSize, 14);
    expect(lifestyleValue.style?.fontWeight, FontWeight.w500);
  });

  testWidgets('map filter updates count and selected card', (tester) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.macOS;

    await tester.pumpWidget(_wrap(const MapScreen()));
    await tester.pumpAndSettle();

    expect(find.text('5 встреч рядом'), findsOneWidget);
    expect(find.text('Винный вечер на крыше'), findsOneWidget);

    await tester.tap(find.text('Популярные'));
    await tester.pumpAndSettle();

    expect(find.text('2 встреч рядом'), findsOneWidget);
    expect(find.text('Настолки и кофе'), findsOneWidget);

    debugDefaultTargetPlatformOverride = null;
  });

  testWidgets('event detail place row opens map focused on event',
      (tester) async {
    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => ProviderScope(
            overrides: buildTestOverrides(),
            child: const EventDetailScreen(eventId: 'e1'),
          ),
        ),
        GoRoute(
          path: '/map',
          name: 'map',
          builder: (context, state) => Text(
            'map-opened-${state.uri.queryParameters['eventId']}',
          ),
        ),
      ],
    );

    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Brix Wine, Покровка 12'));
    await tester.pumpAndSettle();

    expect(find.text('map-opened-e1'), findsOneWidget);
  });
}

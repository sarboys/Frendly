import 'dart:async';

import 'package:big_break_mobile/features/after_dark/presentation/after_dark_event_screen.dart';
import 'package:big_break_mobile/features/after_dark/presentation/after_dark_screen.dart';
import 'package:big_break_mobile/features/after_dark/presentation/after_dark_paywall_screen.dart';
import 'package:big_break_mobile/features/after_dark/presentation/after_dark_providers.dart';
import 'package:big_break_mobile/features/after_dark/presentation/after_dark_models.dart';
import 'package:big_break_mobile/features/paywall/presentation/paywall_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../test_overrides.dart';

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
  testWidgets('after dark screen follows front list structure', (tester) async {
    await tester.pumpWidget(_wrap(const AfterDarkScreen()));
    await tester.pumpAndSettle();

    expect(find.text('🌃 Найтлайф'), findsOneWidget);
    expect(find.text('💋 Свидания'), findsOneWidget);
    expect(find.text('от 2 500 ₽'), findsOneWidget);
    expect(find.text('Сегодня · 23:00'), findsOneWidget);
    expect(find.text('Китай-город · 1.4 км'), findsOneWidget);
    expect(find.text('Подробнее'), findsWidgets);
  });

  testWidgets('after dark paywall enables CTA only after both confirmations',
      (tester) async {
    await tester.pumpWidget(_wrap(const AfterDarkPaywallScreen()));
    await tester.pumpAndSettle();

    expect(find.text('Отметь оба пункта выше'), findsOneWidget);

    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('after-dark-age-consent')),
      200,
    );
    await tester.drag(find.byType(Scrollable).first, const Offset(0, -160));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('after-dark-age-consent')));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('after-dark-code-consent')),
      200,
    );
    await tester.drag(find.byType(Scrollable).first, const Offset(0, -120));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('after-dark-code-consent')));
    await tester.pumpAndSettle();

    expect(find.textContaining('Открыть After Dark'), findsOneWidget);
  });

  testWidgets('after dark paywall uses preview count from provider',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        const AfterDarkPaywallScreen(),
        extraOverrides: [
          afterDarkAccessProvider.overrideWith(
            (ref) async => const AfterDarkAccessData(
              unlocked: false,
              subscriptionStatus: 'inactive',
              plan: null,
              ageConfirmed: false,
              codeAccepted: false,
              kinkVerified: false,
              previewCount: 12,
            ),
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('12 событий сегодня ночью'), findsOneWidget);
  });

  testWidgets('regular paywall enables subscribe CTA and restore action',
      (tester) async {
    await tester.pumpWidget(_wrap(const PaywallScreen()));
    await tester.pumpAndSettle();

    expect(find.text('Frendly+'), findsOneWidget);
    expect(find.text('Восстановить'), findsOneWidget);
    expect(find.textContaining('Попробовать'), findsOneWidget);
  });

  testWidgets(
      'after dark kink event asks for verification when access is not verified',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        const AfterDarkEventScreen(eventId: 'ad7'),
        extraOverrides: [
          afterDarkAccessProvider
              .overrideWith((ref) async => const AfterDarkAccessData(
                    unlocked: true,
                    subscriptionStatus: 'active',
                    plan: 'month',
                    ageConfirmed: true,
                    codeAccepted: true,
                    kinkVerified: false,
                    previewCount: 8,
                  )),
          afterDarkEventDetailProvider.overrideWith((ref, eventId) async {
            return const AfterDarkEventDetail(
              id: 'ad7',
              title: 'Munch · Знакомство сообщества',
              emoji: '🖤',
              category: 'kink',
              time: 'Пт, 25 апр · 19:00',
              district: '—',
              distanceKm: 4.5,
              going: 12,
              capacity: 20,
              ratio: 'Mixed',
              ageRange: '25–45',
              dressCode: 'Vanilla',
              vibe: 'Дружеская встреча в кафе',
              hostVerified: true,
              consentRequired: true,
              glow: 'gold',
              description: 'Описание',
              hostNote: 'Помогаю новичкам адаптироваться',
              rules: ['Согласие это база'],
              joined: false,
              joinRequestStatus: null,
              chatId: null,
            );
          }),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Пройти верификацию'), findsOneWidget);
  });

  testWidgets('after dark consent event unlocks apply CTA after checkbox',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        const AfterDarkEventScreen(eventId: 'ad3'),
        extraOverrides: [
          afterDarkAccessProvider
              .overrideWith((ref) async => const AfterDarkAccessData(
                    unlocked: true,
                    subscriptionStatus: 'active',
                    plan: 'month',
                    ageConfirmed: true,
                    codeAccepted: true,
                    kinkVerified: true,
                    previewCount: 8,
                  )),
          afterDarkEventDetailProvider.overrideWith((ref, eventId) async {
            return const AfterDarkEventDetail(
              id: 'ad3',
              title: 'Banya Night · Sauna Social',
              emoji: '♨️',
              category: 'wellness',
              time: 'Сб, 26 апр · 21:00',
              district: 'Хамовники',
              distanceKm: 3.2,
              going: 14,
              capacity: 20,
              ratio: 'Mixed',
              ageRange: '24–42',
              dressCode: 'Towel / купальник',
              vibe: 'Парная, чан, чай',
              hostVerified: true,
              consentRequired: true,
              glow: 'cyan',
              description: 'Описание',
              hostNote: 'Снимаю целую банную смену',
              rules: ['Никакой съёмки'],
              joined: false,
              joinRequestStatus: null,
              chatId: null,
            );
          }),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Прими правила выше'), findsOneWidget);

    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('after-dark-event-consent')),
      200,
    );
    await tester.drag(find.byType(Scrollable).first, const Offset(0, -120));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('after-dark-event-consent')));
    await tester.pumpAndSettle();

    expect(find.text('Подать заявку'), findsOneWidget);
  });

  testWidgets('after dark event info tiles keep the same height',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        const AfterDarkEventScreen(eventId: 'ad3'),
        extraOverrides: [
          afterDarkAccessProvider
              .overrideWith((ref) async => const AfterDarkAccessData(
                    unlocked: true,
                    subscriptionStatus: 'active',
                    plan: 'month',
                    ageConfirmed: true,
                    codeAccepted: true,
                    kinkVerified: true,
                    previewCount: 8,
                  )),
          afterDarkEventDetailProvider.overrideWith((ref, eventId) async {
            return const AfterDarkEventDetail(
              id: 'ad3',
              title: 'Dress Code Night · Fetish Friendly',
              emoji: '🦋',
              category: 'nightlife',
              time: '19:30',
              district: '—',
              distanceKm: 3.2,
              going: 1,
              capacity: 60,
              ratio: 'Mixed',
              ageRange: '25–45',
              dressCode: 'Strict',
              vibe: 'Закрытая вечеринка с жёстким дресс-кодом',
              hostVerified: true,
              consentRequired: false,
              glow: 'magenta',
              description: 'Описание',
              hostNote: null,
              rules: ['Никакой съёмки'],
              chatId: null,
              priceFrom: 2500,
              joined: false,
              joinRequestStatus: null,
            );
          }),
        ],
      ),
    );
    await tester.pumpAndSettle();

    final whenTile = find.byKey(const ValueKey('after-dark-info-Когда'));
    final whereTile = find.byKey(const ValueKey('after-dark-info-Где'));
    final compositionTile =
        find.byKey(const ValueKey('after-dark-info-Состав'));
    final ageTile = find.byKey(const ValueKey('after-dark-info-Возраст'));

    final expectedHeight = tester.getSize(whenTile).height;
    expect(tester.getSize(whereTile).height, expectedHeight);
    expect(tester.getSize(compositionTile).height, expectedHeight);
    expect(tester.getSize(ageTile).height, expectedHeight);
  });

  testWidgets('after dark event renders cached preview while detail loads',
      (tester) async {
    final detailCompleter = Completer<AfterDarkEventDetail>();
    await tester.pumpWidget(
      _wrap(
        const AfterDarkEventScreen(eventId: 'ad-preview'),
        extraOverrides: [
          afterDarkEventsProvider.overrideWith(
            (ref) async => const [
              AfterDarkEvent(
                id: 'ad-preview',
                title: 'Midnight Jazz Room',
                emoji: '🎷',
                category: 'nightlife',
                time: 'Пт, 25 апр · 23:30',
                district: 'Патрики',
                distanceKm: 1.2,
                going: 16,
                capacity: 28,
                ratio: 'Mixed',
                ageRange: '24–38',
                dressCode: 'Black tie',
                vibe: 'Темный джазовый зал',
                hostVerified: true,
                consentRequired: false,
                glow: 'magenta',
                priceFrom: 1800,
                joined: false,
                joinRequestStatus: null,
              ),
            ],
          ),
          afterDarkAccessProvider
              .overrideWith((ref) async => const AfterDarkAccessData(
                    unlocked: true,
                    subscriptionStatus: 'active',
                    plan: 'month',
                    ageConfirmed: true,
                    codeAccepted: true,
                    kinkVerified: true,
                    previewCount: 8,
                  )),
          afterDarkEventDetailProvider
              .overrideWith((ref, eventId) => detailCompleter.future),
        ],
      ),
    );
    await tester.pump();

    expect(find.text('Midnight Jazz Room'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);

    detailCompleter.complete(
      const AfterDarkEventDetail(
        id: 'ad-preview',
        title: 'Midnight Jazz Room',
        emoji: '🎷',
        category: 'nightlife',
        time: 'Пт, 25 апр · 23:30',
        district: 'Патрики',
        distanceKm: 1.2,
        going: 16,
        capacity: 28,
        ratio: 'Mixed',
        ageRange: '24–38',
        dressCode: 'Black tie',
        vibe: 'Темный джазовый зал',
        hostVerified: true,
        consentRequired: false,
        glow: 'magenta',
        description: 'Описание',
        hostNote: null,
        rules: ['Согласие', 'Без съемки'],
        chatId: null,
        priceFrom: 1800,
        joined: false,
        joinRequestStatus: null,
      ),
    );
    await tester.pumpAndSettle();
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile2/features/giveaways/presentation/giveaways_screen.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';

void main() {
  testWidgets('giveaways screen matches the front2 Drops structure',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1600));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          dropsHomeProvider.overrideWith((ref) async => _fakeDropsHome()),
        ],
        child: MaterialApp(
          theme: DateasyTheme.theme,
          home: const GiveawaysScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Frendly Drops'), findsOneWidget);
    expect(find.text('Подарки для активных пользователей'), findsOneWidget);
    expect(find.text('3 × iPhone 16 Pro'), findsOneWidget);
    expect(find.text('Активные дропы'), findsOneWidget);
    expect(find.text('Задания месяца'), findsOneWidget);

    await tester.dragUntilVisible(
      find.text('История билетов'),
      find.byType(ListView),
      const Offset(0, -500),
    );
    await tester.pumpAndSettle();

    expect(find.text('История билетов'), findsOneWidget);

    await tester.dragUntilVisible(
      find.text('Победители прошлого Drop'),
      find.byType(ListView),
      const Offset(0, -500),
    );
    await tester.pumpAndSettle();

    expect(find.text('Победители прошлого Drop'), findsOneWidget);
    expect(find.text('Анна, Москва'), findsOneWidget);
  });

  testWidgets('giveaways ticket button opens the tasks sheet', (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          dropsHomeProvider.overrideWith((ref) async => _fakeDropsHome()),
        ],
        child: MaterialApp(
          theme: DateasyTheme.theme,
          home: const GiveawaysScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Получить билеты').first);
    await tester.pumpAndSettle();

    expect(find.text('Как получить больше билетов'), findsOneWidget);
    expect(
        find.text(
            'Билеты нельзя купить. Их получают за реальную активность в Frendly.'),
        findsOneWidget);
    expect(find.text('Понятно'), findsOneWidget);
  });

  testWidgets('giveaways screen hides non MVP tasks', (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          dropsHomeProvider.overrideWith((ref) async => _fakeDropsHome()),
        ],
        child: MaterialApp(
          theme: DateasyTheme.theme,
          home: const GiveawaysScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Купить билет через афишу'), findsNothing);
    expect(find.text('Забронировать столик на встрече'), findsNothing);
    expect(find.text('Получить рейтинг 4.5+'), findsNothing);
    expect(find.text('Репост в Telegram / VK'), findsNothing);
  });
}

DropsHomeData _fakeDropsHome() {
  final mainDrop = DropData(
    id: 'june-iphone',
    type: 'main_monthly',
    status: 'active',
    title: '3 × iPhone 16 Pro',
    description: '256 GB · цвет на выбор победителя',
    prizeSummary: '3 победителя',
    drawAt: DateTime.utc(2026, 6, 30, 17),
    drawDate: '30 июня',
    daysLeft: 12,
    participantCount: 8420,
    myTickets: 7,
    maxTicketsPerUser: 30,
    requiresVerified: true,
    eligibility: const DropEligibilityData(canParticipate: true),
  );
  final plusDrop = DropData(
    id: 'plus-drop',
    type: 'frendly_plus',
    status: 'active',
    title: '10 × Frendly+ на 3 месяца',
    description: 'Только для подписчиков',
    prizeSummary: '10 победителей',
    drawAt: DateTime.utc(2026, 6, 27, 17),
    drawDate: '27 июня',
    daysLeft: 9,
    participantCount: 942,
    myTickets: 0,
    maxTicketsPerUser: 10,
    requiresVerified: true,
    requiresFrendlyPlus: true,
    eligibility: const DropEligibilityData(
      canParticipate: false,
      missing: ['frendly_plus'],
    ),
  );
  return DropsHomeData(
    mainDrop: mainDrop,
    drops: [mainDrop, plusDrop],
    ticketProgress: DropTicketProgressData(
      monthKey: '2026-06',
      earned: 9,
      reserved: 9,
      availableTickets: 0,
      max: 30,
      nextResetAt: DateTime.utc(2026, 7, 1),
    ),
    tasks: const [
      DropTaskData(
        id: 'verify',
        source: 'verification',
        title: 'Пройти верификацию',
        description: 'Разово после подтверждения профиля',
        rewardTickets: 3,
        progress: 3,
        status: 'completed',
        cta: DropTaskCtaData(label: 'Готово', route: '/verify'),
      ),
      DropTaskData(
        id: 'daily',
        source: 'daily_login',
        title: 'Ежедневный вход',
        description: 'Один раз в день',
        rewardTickets: 1,
        monthlyLimit: 7,
        progress: 2,
        status: 'available',
        cta: DropTaskCtaData(label: '+1 сегодня', action: 'claim_daily_login'),
      ),
      DropTaskData(
        id: 'host',
        source: 'host_meeting',
        title: 'Провести встречу',
        description: 'После подтверждения участников',
        rewardTickets: 1,
        monthlyLimit: 5,
        status: 'available',
        cta: DropTaskCtaData(label: 'Создать', route: '/meetings/new'),
      ),
      DropTaskData(
        id: 'referral',
        source: 'referral',
        title: 'Пригласить друга',
        description: 'После верификации друга',
        rewardTickets: 3,
        status: 'available',
        cta: DropTaskCtaData(
          label: 'Позвать',
          route: '/share',
          action: 'create_referral_link',
        ),
      ),
    ],
    history: [
      DropHistoryData(
        id: 'history-1',
        source: 'verification',
        status: 'active',
        title: 'Верификация профиля',
        ticketCount: 3,
        createdAt: DateTime.utc(2026, 6, 1),
      ),
    ],
    pastWinners: const [
      DropWinnerData(
        id: 'winner-1',
        name: 'Анна',
        city: 'Москва',
        prize: 'iPhone 15',
        ticket: 'A8F92',
      ),
    ],
    eligibility: const DropUserEligibilityData(
      canParticipate: true,
      verified: true,
    ),
  );
}

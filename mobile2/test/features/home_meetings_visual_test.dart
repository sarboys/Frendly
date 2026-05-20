import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile2/app/core/providers/core_providers.dart';
import 'package:mobile2/features/home/presentation/home_screen.dart';
import 'package:mobile2/features/meetings/presentation/meeting_detail_screen.dart';
import 'package:mobile2/features/meetings/presentation/meetings_screen.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';

void main() {
  testWidgets('home radar keeps enough height to show its content',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(_visualHarness(home: const HomeScreen()));
    await tester.pump();
    await tester.pump();

    expect(
      tester.getSize(find.byKey(const Key('home-radar-card'))).height,
      greaterThanOrEqualTo(220),
    );
  });

  testWidgets('home nearby meetings show attendee avatars and extra count',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _visualHarness(
        home: const HomeScreen(),
        homeEvents: const [
          BackendCardItem(
            id: 'meeting-1',
            title: 'Идем на стендап',
            subtitle: 'Brew Lab',
            raw: {
              'going': 6,
              'participants': [
                {'avatarUrl': 'https://cdn.example.com/a.jpg'},
                {'avatarUrl': 'https://cdn.example.com/b.jpg'},
                {'avatarUrl': 'https://cdn.example.com/c.jpg'},
                {'avatarUrl': 'https://cdn.example.com/d.jpg'},
                {'avatarUrl': 'https://cdn.example.com/e.jpg'},
                {'avatarUrl': 'https://cdn.example.com/f.jpg'},
              ],
            },
          ),
        ],
      ),
    );
    await tester.pump();
    await tester.pump();

    await tester.ensureVisible(find.text('Ближайшие встречи'));
    await tester.pumpAndSettle();

    expect(find.text('+3 человека'), findsOneWidget);
  });

  testWidgets('home notification dot follows unread count', (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _visualHarness(
        home: const HomeScreen(),
        unreadNotifications: 0,
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(find.byKey(const Key('home-notification-dot')), findsNothing);
  });

  testWidgets('home shows the Frendly Drops teaser from front2',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(_visualHarness(home: const HomeScreen()));
    await tester.pump();
    await tester.pump();

    expect(find.text('frendly drops · июнь'), findsOneWidget);
    expect(find.text('Июньский Drop · 3 × iPhone 16 Pro'), findsOneWidget);
    expect(
      find.text(
        'Бесплатно для верифицированных · получай билеты за активность',
      ),
      findsOneWidget,
    );
  });

  testWidgets('home nearby meeting tile opens meeting detail when tapped',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(path: '/', builder: (_, __) => const HomeScreen()),
        GoRoute(
          path: '/meetings/:meetingId',
          builder: (_, state) => Scaffold(
            body: Text('detail ${state.pathParameters['meetingId']}'),
          ),
        ),
      ],
    );

    await tester.pumpWidget(
      _visualHarness(
        router: router,
        homeEvents: const [
          BackendCardItem(
            id: 'meeting-1',
            title: 'Идем на стендап',
            subtitle: 'Brew Lab',
            raw: {'going': 2},
          ),
        ],
      ),
    );
    await tester.pump();
    await tester.pump();

    await tester.ensureVisible(find.text('Идем на стендап'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Идем на стендап'));
    await tester.pumpAndSettle();

    expect(find.text('detail meeting-1'), findsOneWidget);
  });

  testWidgets('meeting detail opened from invite notification shows accept',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _visualHarness(
        home: const MeetingDetailScreen(
          meetingId: 'meeting-1',
          inviteRequestId: 'request-1',
        ),
        meetingDetail: const BackendCardItem(
          id: 'meeting-1',
          title: 'Винный вечер',
          raw: {
            'joinMode': 'request',
            'joinRequestStatus': 'pending',
            'entryRequirements': {'canJoin': true, 'missing': []},
          },
        ),
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(find.text('Принять'), findsOneWidget);
    expect(find.text('Заявка отправлена'), findsNothing);
  });

  testWidgets('meetings cards open detail when tapped', (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final router = GoRouter(
      initialLocation: '/meetings',
      routes: [
        GoRoute(path: '/meetings', builder: (_, __) => const MeetingsScreen()),
        GoRoute(
          path: '/meetings/:meetingId',
          builder: (_, state) => Scaffold(
            body: Text('detail ${state.pathParameters['meetingId']}'),
          ),
        ),
      ],
    );

    await tester.pumpWidget(
      _visualHarness(
        router: router,
        meetings: const [
          BackendCardItem(
            id: 'meeting-1',
            title: 'Идем на стендап',
            subtitle: 'Brew Lab',
            raw: {'going': 1, 'capacity': 6},
          ),
        ],
      ),
    );
    await tester.pump();
    await tester.pump();

    await tester.ensureVisible(find.text('Идем на стендап'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Идем на стендап'));
    await tester.pumpAndSettle();

    expect(find.text('detail meeting-1'), findsOneWidget);
  });

  testWidgets('meetings list starts close to the AI suggestion card',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _visualHarness(
        home: const MeetingsScreen(),
        meetings: const [
          BackendCardItem(
            id: 'meeting-1',
            title: 'Идем на стендап',
            subtitle: 'Brew Lab',
            imageUrl: 'https://cdn.example.com/cover.jpg',
            raw: {
              'going': 1,
              'capacity': 6,
              'participants': [
                {'avatarUrl': 'https://cdn.example.com/a.jpg'},
              ],
            },
          ),
        ],
      ),
    );
    await tester.pump();
    await tester.pump();

    final aiBottom =
        tester.getBottomLeft(find.text('AI подберёт встречу под вечер')).dy;
    final cardTop = tester.getTopLeft(find.text('Идем на стендап')).dy;

    expect(cardTop - aiBottom, lessThan(180));
  });
}

Widget _visualHarness({
  Widget? home,
  GoRouter? router,
  List<BackendCardItem> homeEvents = const [],
  List<BackendCardItem> meetings = const [],
  BackendCardItem? meetingDetail,
  int unreadNotifications = 0,
}) {
  final scope = ProviderScope(
    overrides: [
      currentUserProvider.overrideWith(
        (_) => const BackendUser(
          id: 'user-1',
          name: 'Сергей',
          onboardingComplete: true,
          city: 'Москва',
        ),
      ),
      tokenWalletProvider.overrideWith(
        (_) async => const TokenWalletData(balance: 0),
      ),
      matchesProvider.overrideWith(
        (_) => Stream.value(const BackendPage<BackendCardItem>(items: [])),
      ),
      postersProvider.overrideWith(
        (_) async => const BackendPage<BackendCardItem>(items: []),
      ),
      homeEventsQueryProvider.overrideWith(
        (_, __) => Stream.value(BackendPage(items: homeEvents)),
      ),
      meetingsQueryProvider.overrideWith(
        (_, __) => Stream.value(BackendPage(items: meetings)),
      ),
      meetingDetailProvider.overrideWith(
        (_, __) async =>
            meetingDetail ??
            const BackendCardItem(
              id: 'fallback',
              title: 'Fallback',
            ),
      ),
      notificationUnreadCountProvider.overrideWith(
        (_) async => unreadNotifications,
      ),
    ],
    child: router == null
        ? MaterialApp(
            theme: DateasyTheme.theme,
            home: home,
          )
        : MaterialApp.router(
            theme: DateasyTheme.theme,
            routerConfig: router,
          ),
  );
  return scope;
}

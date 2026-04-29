import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/features/chats/presentation/chats_screen.dart';
import 'package:big_break_mobile/features/people/presentation/people_screen.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/meetup_chat.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../../test_overrides.dart';

Widget _wrapWithRouter({
  required Widget child,
  required String targetText,
  List<Override> extraOverrides = const [],
}) {
  final router = GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => ProviderScope(
          overrides: [
            ...buildTestOverrides(),
            ...extraOverrides,
          ],
          child: child,
        ),
      ),
      GoRoute(
        path: '/search',
        name: 'search',
        builder: (context, state) => Scaffold(
          body: Center(child: Text(targetText)),
        ),
      ),
      GoRoute(
        path: '/create',
        name: 'createMeetup',
        builder: (context, state) => Scaffold(
          body: Center(child: Text(targetText)),
        ),
      ),
      GoRoute(
        path: '/evening-plan/:routeId',
        name: 'eveningPlan',
        builder: (context, state) => const Scaffold(
          body: Center(child: Text('plan-opened')),
        ),
      ),
      GoRoute(
        path: '/evening-live/:routeId',
        name: 'eveningLive',
        builder: (context, state) => Scaffold(
          body: Center(
            child: Text(
              'live-opened:${state.uri.queryParameters['sessionId'] ?? ''}',
            ),
          ),
        ),
      ),
    ],
  );

  return MaterialApp.router(routerConfig: router);
}

void main() {
  testWidgets('people search bar opens search screen', (tester) async {
    await tester.pumpWidget(
      _wrapWithRouter(
        child: const PeopleScreen(),
        targetText: 'search-opened',
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Найти по имени или интересу'));
    await tester.pumpAndSettle();

    expect(find.text('search-opened'), findsOneWidget);
  });

  testWidgets('chats search button opens search screen', (tester) async {
    await tester.pumpWidget(
      _wrapWithRouter(
        child: const ChatsScreen(),
        targetText: 'search-opened',
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(LucideIcons.search));
    await tester.pumpAndSettle();

    expect(find.text('search-opened'), findsOneWidget);
  });

  testWidgets('chats create button opens create meetup screen', (tester) async {
    await tester.pumpWidget(
      _wrapWithRouter(
        child: const ChatsScreen(),
        targetText: 'create-opened',
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(LucideIcons.square_pen));
    await tester.pumpAndSettle();

    expect(find.text('create-opened'), findsOneWidget);
  });

  testWidgets('after dark meetup chat is marked in the chats list',
      (tester) async {
    await tester.pumpWidget(
      _wrapWithRouter(
        child: const ChatsScreen(),
        targetText: 'unused',
        extraOverrides: [
          meetupChatsProvider.overrideWith(
            (ref) async => const [
              MeetupChat(
                id: 'mc-ad1',
                eventId: 'ad1',
                title: 'After Dark Lounge',
                emoji: '🖤',
                time: '23:30',
                lastMessage: 'Список на входе обновили',
                lastAuthor: 'Хост',
                lastTime: 'сейчас',
                unread: 2,
                members: ['Хост', 'Ты'],
                status: 'Сегодня',
                isAfterDark: true,
                afterDarkGlow: 'magenta',
              ),
            ],
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('After Dark'), findsOneWidget);
  });

  testWidgets('meetup chats are grouped by live, soon and upcoming phases',
      (tester) async {
    await tester.pumpWidget(
      _wrapWithRouter(
        child: const ChatsScreen(),
        targetText: 'unused',
        extraOverrides: [
          meetupChatsProvider.overrideWith(
            (ref) async => const [
              MeetupChat(
                id: 'evening-live',
                eventId: null,
                title: 'Теплый круг на Покровке',
                emoji: '🍇',
                time: '19:00',
                lastMessage: 'Мы уже в баре',
                lastAuthor: 'Аня К',
                lastTime: 'сейчас',
                unread: 3,
                members: ['Ты', 'Аня К'],
                phase: MeetupPhase.live,
                currentStep: 2,
                totalSteps: 4,
                currentPlace: 'Brix Wine',
                endTime: '20:15',
                routeId: 'r-cozy-circle',
              ),
              MeetupChat(
                id: 'evening-soon',
                eventId: null,
                title: 'Свидание Noir',
                emoji: '🎬',
                time: '20:00',
                lastMessage: 'Маршрут готов',
                lastAuthor: 'Frendly',
                lastTime: '15 мин',
                unread: 0,
                members: ['Ты', 'Аня К'],
                phase: MeetupPhase.soon,
                startsInLabel: 'Через 45 мин',
                routeId: 'r-date-noir',
                sessionId: 'session-soon',
                hostUserId: 'user-me',
              ),
              MeetupChat(
                id: 'evening-upcoming',
                eventId: null,
                title: 'Большой вечер в центре',
                emoji: '🪩',
                time: 'Завтра',
                lastMessage: 'До встречи',
                lastAuthor: 'Марк',
                lastTime: 'вчера',
                unread: 0,
                members: ['Ты', 'Марк'],
                phase: MeetupPhase.upcoming,
                routeId: 'r-wild-night',
              ),
            ],
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('● LIVE'), findsOneWidget);
    expect(find.textContaining('Шаг 2 из 4'), findsOneWidget);
    expect(find.textContaining('Сейчас:'), findsOneWidget);
    expect(find.text('СКОРО'), findsOneWidget);
    expect(find.text('⏰ ЧЕРЕЗ 45 МИН'), findsOneWidget);
    expect(find.text('Поехали'), findsOneWidget);
    expect(find.text('ПРЕДСТОЯЩИЕ'), findsOneWidget);
  });

  testWidgets('soon evening chat list hides launch CTA without host id',
      (tester) async {
    await tester.pumpWidget(
      _wrapWithRouter(
        child: const ChatsScreen(),
        targetText: 'unused',
        extraOverrides: [
          meetupChatsProvider.overrideWith(
            (ref) async => const [
              MeetupChat(
                id: 'evening-soon-no-host',
                eventId: null,
                title: 'Свидание Noir',
                emoji: '🎬',
                time: '20:00',
                lastMessage: 'Маршрут готов',
                lastAuthor: 'Frendly',
                lastTime: '15 мин',
                unread: 0,
                members: ['Ты', 'Аня К'],
                phase: MeetupPhase.soon,
                startsInLabel: 'Через 45 мин',
                routeId: 'r-date-noir',
              ),
            ],
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('⏰ ЧЕРЕЗ 45 МИН'), findsOneWidget);
    expect(find.text('Поехали'), findsNothing);
  });

  testWidgets('soon evening chat list starts live session for host',
      (tester) async {
    _RecordingBackendRepository? repository;
    await tester.pumpWidget(
      _wrapWithRouter(
        child: const ChatsScreen(),
        targetText: 'unused',
        extraOverrides: [
          currentUserIdProvider.overrideWith((ref) => 'user-me'),
          backendRepositoryProvider.overrideWith((ref) {
            final created = _RecordingBackendRepository(ref);
            repository = created;
            return created;
          }),
          meetupChatsProvider.overrideWith(
            (ref) async => const [
              MeetupChat(
                id: 'evening-soon',
                eventId: null,
                title: 'Свидание Noir',
                emoji: '🎬',
                time: '20:00',
                lastMessage: 'Маршрут готов',
                lastAuthor: 'Frendly',
                lastTime: '15 мин',
                unread: 0,
                members: ['Ты', 'Аня К'],
                phase: MeetupPhase.soon,
                startsInLabel: 'Через 45 мин',
                routeId: 'r-date-noir',
                sessionId: 'session-soon',
                hostUserId: 'user-me',
              ),
            ],
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Поехали'));
    await tester.pumpAndSettle();

    expect(repository?.startedSessionIds ?? const <String>[], ['session-soon']);
    expect(find.text('live-opened:session-soon'), findsOneWidget);
    expect(find.text('plan-opened'), findsNothing);
  });

  testWidgets('upcoming meetup section is visible without live or soon chats',
      (tester) async {
    await tester.pumpWidget(
      _wrapWithRouter(
        child: const ChatsScreen(),
        targetText: 'unused',
        extraOverrides: [
          meetupChatsProvider.overrideWith(
            (ref) async => const [
              MeetupChat(
                id: 'regular-upcoming',
                eventId: 'event-1',
                title: 'Обычная встреча',
                emoji: '🍷',
                time: '08:33',
                lastMessage: 'Голосовое сообщение',
                lastAuthor: 'Сергей',
                lastTime: '5 ч',
                unread: 0,
                members: ['Сергей', 'Ты'],
                status: 'Сегодня',
                phase: MeetupPhase.upcoming,
              ),
            ],
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('ПРЕДСТОЯЩИЕ'), findsOneWidget);
    expect(find.text('Обычная встреча'), findsOneWidget);
  });
}

class _RecordingBackendRepository extends BackendRepository {
  _RecordingBackendRepository(Ref ref) : super(ref: ref, dio: Dio());

  final List<String> startedSessionIds = [];

  @override
  Future<void> startEveningSession(String sessionId) async {
    startedSessionIds.add(sessionId);
  }
}

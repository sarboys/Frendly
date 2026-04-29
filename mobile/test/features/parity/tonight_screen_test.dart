import 'package:big_break_mobile/app/app.dart';
import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/features/tonight/presentation/tonight_screen.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/models/event.dart';
import 'package:big_break_mobile/shared/models/evening_session.dart';
import 'package:big_break_mobile/shared/models/meetup_chat.dart';
import 'package:big_break_mobile/shared/models/tokens.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../test_overrides.dart';

void main() {
  testWidgets('tonight shows create meetup button above shell content', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({
      'auth.tokens':
          '{"accessToken":"access-token","refreshToken":"refresh-token"}',
    });
    final preferences = await SharedPreferences.getInstance();

    await tester.pumpWidget(
      BigBreakRoot(
        overrides: [
          ...buildTestOverrides(),
          initialAuthTokensProvider.overrideWithValue(
            const AuthTokens(
              accessToken: 'access-token',
              refreshToken: 'refresh-token',
            ),
          ),
          sharedPreferencesProvider.overrideWithValue(preferences),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(FloatingActionButton), findsOneWidget);
  });

  testWidgets('tonight header opens search and hides inline filters', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({
      'auth.tokens':
          '{"accessToken":"access-token","refreshToken":"refresh-token"}',
    });
    final preferences = await SharedPreferences.getInstance();

    await tester.pumpWidget(
      BigBreakRoot(
        overrides: [
          ...buildTestOverrides(),
          initialAuthTokensProvider.overrideWithValue(
            const AuthTokens(
              accessToken: 'access-token',
              refreshToken: 'refresh-token',
            ),
          ),
          sharedPreferencesProvider.overrideWithValue(preferences),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Фильтры'), findsNothing);
    expect(find.byIcon(LucideIcons.search), findsOneWidget);

    await tester.tap(find.byIcon(LucideIcons.search));
    await tester.pumpAndSettle();

    expect(find.text('Недавнее'), findsOneWidget);
    expect(find.text('В тренде'), findsOneWidget);
  });

  testWidgets('tonight nearby all button opens search preset', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({
      'auth.tokens':
          '{"accessToken":"access-token","refreshToken":"refresh-token"}',
    });
    final preferences = await SharedPreferences.getInstance();

    await tester.pumpWidget(
      BigBreakRoot(
        overrides: [
          ...buildTestOverrides(),
          initialAuthTokensProvider.overrideWithValue(
            const AuthTokens(
              accessToken: 'access-token',
              refreshToken: 'refresh-token',
            ),
          ),
          sharedPreferencesProvider.overrideWithValue(preferences),
        ],
      ),
    );
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Рядом с тобой'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Все 5 →'));
    await tester.pumpAndSettle();

    expect(find.text('Рядом с тобой'), findsOneWidget);
    expect(find.text('Недавнее'), findsNothing);
  });

  testWidgets('tonight opens posters screen from teaser CTA', (tester) async {
    SharedPreferences.setMockInitialValues({
      'auth.tokens':
          '{"accessToken":"access-token","refreshToken":"refresh-token"}',
    });
    final preferences = await SharedPreferences.getInstance();

    await tester.pumpWidget(
      BigBreakRoot(
        overrides: [
          ...buildTestOverrides(),
          initialAuthTokensProvider.overrideWithValue(
            const AuthTokens(
              accessToken: 'access-token',
              refreshToken: 'refresh-token',
            ),
          ),
          sharedPreferencesProvider.overrideWithValue(preferences),
        ],
      ),
    );
    await tester.pumpAndSettle();

    final allButton = find.widgetWithText(TextButton, 'Все');
    await tester.scrollUntilVisible(
      allButton,
      500,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    await tester.tap(allButton);
    await tester.pumpAndSettle();

    expect(find.text('Афиша города'), findsOneWidget);
  });

  testWidgets('tonight hides after dark promo card on main feed', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    SharedPreferences.setMockInitialValues({
      'auth.tokens':
          '{"accessToken":"access-token","refreshToken":"refresh-token"}',
    });
    final preferences = await SharedPreferences.getInstance();

    await tester.pumpWidget(
      BigBreakRoot(
        overrides: [
          ...buildTestOverrides(),
          initialAuthTokensProvider.overrideWithValue(
            const AuthTokens(
              accessToken: 'access-token',
              refreshToken: 'refresh-token',
            ),
          ),
          sharedPreferencesProvider.overrideWithValue(preferences),
        ],
      ),
    );
    await tester.pumpAndSettle();

    final promoTitle = find.text('Ночной круг сегодня');
    final scrollable = find.byType(Scrollable).first;
    for (var i = 0; i < 12; i++) {
      expect(promoTitle, findsNothing);
      await tester.drag(scrollable, const Offset(0, -360));
      await tester.pumpAndSettle();
    }
  });

  testWidgets('tonight feed switch matches front segment content', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({
      'auth.tokens':
          '{"accessToken":"access-token","refreshToken":"refresh-token"}',
    });
    final preferences = await SharedPreferences.getInstance();

    await tester.pumpWidget(
      BigBreakRoot(
        overrides: [
          ...buildTestOverrides(),
          initialAuthTokensProvider.overrideWithValue(
            const AuthTokens(
              accessToken: 'access-token',
              refreshToken: 'refresh-token',
            ),
          ),
          sharedPreferencesProvider.overrideWithValue(preferences),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('tonight-feed-day')), findsOneWidget);
    expect(
      find.byKey(const ValueKey('tonight-feed-after-dark')),
      findsOneWidget,
    );
    expect(find.byIcon(LucideIcons.sunset), findsOneWidget);
    expect(find.byIcon(LucideIcons.moon), findsOneWidget);
    expect(find.byIcon(LucideIcons.lock), findsOneWidget);
    expect(find.text('After Dark 🔒'), findsNothing);
  });

  testWidgets('tonight keeps evening hero and moves search to header', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 1200);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await _pumpTonightApp(tester);

    expect(find.text('Frendly Evening'), findsOneWidget);
    expect(find.text('Поиск встреч и мест'), findsNothing);
    expect(find.byIcon(LucideIcons.search), findsOneWidget);
  });

  testWidgets('tonight puts nearby meetups before posters teaser', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 1200);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await _pumpTonightApp(
      tester,
      extraOverrides: [
        eventsProvider.overrideWith((ref, filter) async => const <Event>[]),
        eveningSessionsProvider.overrideWith(
          (ref) async => const <EveningSessionSummary>[],
        ),
      ],
    );

    expect(find.text('Рядом с тобой'), findsOneWidget);
    expect(find.text('Афиша рядом'), findsOneWidget);
    expect(
      tester.getTopLeft(find.text('Рядом с тобой')).dy,
      lessThan(tester.getTopLeft(find.text('Афиша рядом')).dy),
    );
  });

  testWidgets('tonight shows empty state for nearby meetups', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 1200);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await _pumpTonightApp(
      tester,
      extraOverrides: [
        eventsProvider.overrideWith((ref, filter) async => const <Event>[]),
      ],
    );

    await tester.scrollUntilVisible(
      find.text('Встреч рядом нет'),
      500,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();

    expect(find.text('Встреч рядом нет'), findsOneWidget);
    expect(find.text('Можно создать свою встречу.'), findsOneWidget);
    expect(
      find.widgetWithText(OutlinedButton, 'Создать встречу'),
      findsOneWidget,
    );
  });

  testWidgets('tonight shows at most two active meetup chats', (
    tester,
  ) async {
    await _pumpTonightApp(
      tester,
      extraOverrides: [
        meetupChatsProvider.overrideWith((ref) async => const [
              _firstMeetupChat,
              _secondMeetupChat,
              _thirdMeetupChat,
            ]),
      ],
    );

    await tester.scrollUntilVisible(
      find.text('Первая встреча'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();

    expect(find.text('Первая встреча'), findsOneWidget);
    expect(find.text('Вторая встреча'), findsOneWidget);
    expect(find.text('Третья встреча'), findsNothing);
  });

  testWidgets('tonight marks started meetup chats as ongoing', (
    tester,
  ) async {
    await _pumpTonightApp(
      tester,
      extraOverrides: [
        meetupChatsProvider.overrideWith(
          (ref) async => const [_startedMeetupChat],
        ),
      ],
    );

    await tester.scrollUntilVisible(
      find.byKey(
        const ValueKey('tonight-active-meetup-ongoing-dot-chat-started'),
      ),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();

    expect(
      find.byKey(
        const ValueKey('tonight-active-meetup-ongoing-dot-chat-started'),
      ),
      findsOneWidget,
    );
  });

  testWidgets('tonight shows Frendly Evening live and gathering cards', (
    tester,
  ) async {
    await _pumpTonightApp(
      tester,
      extraOverrides: [
        eveningSessionsProvider.overrideWith(
          (ref) async => const [_liveEveningSession, _gatheringEveningSession],
        ),
      ],
    );

    await tester.scrollUntilVisible(
      find.text('Идут и собираются'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();

    expect(find.text('Frendly Evenings'), findsOneWidget);
    expect(find.text('Идут и собираются'), findsOneWidget);
    expect(find.text('Live'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('tonight-evening-live-pulse-session-live')),
      findsOneWidget,
    );
    expect(find.text('Собираются'), findsOneWidget);
    expect(find.text('Теплый круг'), findsOneWidget);
    expect(find.text('Свидание Noir'), findsOneWidget);
  });

  test('tonight evening gathering label shows time until start', () {
    expect(
      formatTonightEveningStartLabel(
        '2026-04-26T17:45:00.000Z',
        now: DateTime.utc(2026, 4, 26, 17, 0),
      ),
      'через 45 мин',
    );
    expect(
      formatTonightEveningStartLabel(
        '2026-04-26T20:10:00.000Z',
        now: DateTime.utc(2026, 4, 26, 17, 0),
      ),
      'через 3 ч',
    );
  });

  testWidgets('tonight hides active meetup card when there are no chats today',
      (
    tester,
  ) async {
    await _pumpTonightApp(
      tester,
      extraOverrides: [
        meetupChatsProvider.overrideWith(
          (ref) async => const [_tomorrowMeetupChat],
        ),
      ],
    );

    expect(find.text('Твои встречи сегодня'), findsNothing);
    expect(
      find.byKey(const ValueKey('tonight-active-meetup-card')),
      findsNothing,
    );
  });

  testWidgets('tonight single active meetup chat has compact bottom padding', (
    tester,
  ) async {
    await _pumpTonightApp(
      tester,
      extraOverrides: [
        meetupChatsProvider.overrideWith(
          (ref) async => const [_firstMeetupChat],
        ),
      ],
    );

    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('tonight-active-meetup-card')),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();

    expect(
      tester
          .getSize(find.byKey(const ValueKey('tonight-active-meetup-card')))
          .height,
      lessThanOrEqualTo(106),
    );
  });
}

Future<void> _pumpTonightApp(
  WidgetTester tester, {
  List<Override> extraOverrides = const [],
}) async {
  SharedPreferences.setMockInitialValues({
    'auth.tokens':
        '{"accessToken":"access-token","refreshToken":"refresh-token"}',
  });
  final preferences = await SharedPreferences.getInstance();

  await tester.pumpWidget(
    BigBreakRoot(
      overrides: [
        ...buildTestOverrides(),
        initialAuthTokensProvider.overrideWithValue(
          const AuthTokens(
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
          ),
        ),
        sharedPreferencesProvider.overrideWithValue(preferences),
        ...extraOverrides,
      ],
    ),
  );
  await tester.pumpAndSettle();
}

const _firstMeetupChat = MeetupChat(
  id: 'chat-one',
  eventId: 'event-one',
  title: 'Первая встреча',
  emoji: '🍷',
  time: '20:00',
  lastMessage: 'Голосовое сообщение',
  lastAuthor: 'Сергей',
  lastTime: 'сейчас',
  unread: 0,
  members: ['Сергей', 'Ты'],
  status: 'Сегодня',
);

const _secondMeetupChat = MeetupChat(
  id: 'chat-two',
  eventId: 'event-two',
  title: 'Вторая встреча',
  emoji: '🎬',
  time: '21:00',
  lastMessage: 'Буду на месте',
  lastAuthor: 'Лиза',
  lastTime: '5 мин',
  unread: 0,
  members: ['Лиза', 'Ты'],
  status: 'Сегодня',
);

const _thirdMeetupChat = MeetupChat(
  id: 'chat-three',
  eventId: 'event-three',
  title: 'Третья встреча',
  emoji: '☕',
  time: '22:00',
  lastMessage: 'Забронировали стол',
  lastAuthor: 'Марк',
  lastTime: '10 мин',
  unread: 0,
  members: ['Марк', 'Ты'],
  status: 'Сегодня',
);

const _startedMeetupChat = MeetupChat(
  id: 'chat-started',
  eventId: 'event-started',
  title: 'Уже началась',
  emoji: '🍝',
  time: '00:00',
  lastMessage: 'Мы уже на месте',
  lastAuthor: 'Сергей',
  lastTime: 'сейчас',
  unread: 0,
  members: ['Сергей', 'Ты'],
  status: 'Сегодня',
);

const _tomorrowMeetupChat = MeetupChat(
  id: 'chat-tomorrow',
  eventId: 'event-tomorrow',
  title: 'Завтрашняя встреча',
  emoji: '🎬',
  time: 'Завтра · 21:00',
  lastMessage: 'До встречи завтра',
  lastAuthor: 'Маша',
  lastTime: 'вчера',
  unread: 0,
  members: ['Маша', 'Ты'],
  status: 'Завтра',
);

const _liveEveningSession = EveningSessionSummary(
  id: 'session-live',
  routeId: 'r-cozy-circle',
  chatId: 'chat-live',
  phase: EveningSessionPhase.live,
  chatPhase: MeetupPhase.live,
  privacy: EveningPrivacy.open,
  title: 'Теплый круг',
  vibe: 'Камерный вечер',
  emoji: '🍷',
  area: 'Покровка',
  hostName: 'Аня К',
  joinedCount: 5,
  maxGuests: 10,
  currentStep: 2,
  totalSteps: 3,
  currentPlace: 'Brix Wine',
  endTime: '21:30',
);

const _gatheringEveningSession = EveningSessionSummary(
  id: 'session-soon',
  routeId: 'r-date-noir',
  chatId: 'chat-soon',
  phase: EveningSessionPhase.scheduled,
  chatPhase: MeetupPhase.soon,
  privacy: EveningPrivacy.request,
  title: 'Свидание Noir',
  vibe: 'Кино и бар',
  emoji: '🎬',
  area: 'Хохловский',
  hostName: 'Паша',
  joinedCount: 3,
  maxGuests: 8,
  totalSteps: 2,
);

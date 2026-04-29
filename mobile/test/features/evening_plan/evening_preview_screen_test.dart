import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/features/evening_plan/presentation/evening_preview_screen.dart';
import 'package:big_break_mobile/features/evening_plan/presentation/evening_share_card_screen.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/models/evening_session.dart';
import 'package:big_break_mobile/shared/models/meetup_chat.dart';
import 'package:big_break_mobile/shared/models/public_share.dart';
import 'package:big_break_mobile/shared/models/tokens.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

void main() {
  testWidgets('preview shows open evening CTA', (tester) async {
    await _pumpPreview(
      tester,
      _detail(privacy: EveningPrivacy.open),
    );

    expect(find.text('Открытый вечер'), findsOneWidget);
    expect(find.text('19:00 - 20:30'), findsOneWidget);
    expect(find.text('2 шага'), findsOneWidget);
    expect(find.text('2 шагов'), findsNothing);
    expect(find.text('Вписаться в вечер'), findsOneWidget);
    expect(find.text('После вступления попадёшь в чат вечера'), findsOneWidget);
  });

  testWidgets('preview shows request CTA and hint', (tester) async {
    await _pumpPreview(
      tester,
      _detail(privacy: EveningPrivacy.request),
    );

    expect(find.text('По заявке'), findsOneWidget);
    expect(find.text('Отправить заявку хосту'), findsOneWidget);
    expect(find.text('Хост подтверждает каждого'), findsOneWidget);
  });

  testWidgets('preview shows persisted request state from backend',
      (tester) async {
    await _pumpPreview(
      tester,
      _detail(
        privacy: EveningPrivacy.request,
        isRequested: true,
      ),
    );

    expect(find.text('Заявка отправлена'), findsOneWidget);
    expect(find.text('Отправить заявку хосту'), findsNothing);
    expect(find.text('Хост подтверждает каждого'), findsNothing);
  });

  testWidgets('preview disables invite-only CTA', (tester) async {
    await _pumpPreview(
      tester,
      _detail(privacy: EveningPrivacy.invite),
    );

    expect(find.text('Только по приглашениям'), findsOneWidget);
    expect(find.text('Только по инвайту'), findsOneWidget);
    expect(find.text('Закрытый вечер'), findsOneWidget);
  });

  testWidgets('preview joins invite-only evening with invite token',
      (tester) async {
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    late _InviteBackendRepository repository;
    final router = GoRouter(
      initialLocation: '/evening-preview/session-1?inviteToken=secret-token',
      routes: [
        GoRoute(
          path: AppRoute.eveningPreview.path,
          name: AppRoute.eveningPreview.name,
          builder: (context, state) => EveningPreviewScreen(
            sessionId: state.pathParameters['sessionId']!,
          ),
        ),
        GoRoute(
          path: AppRoute.meetupChat.path,
          name: AppRoute.meetupChat.name,
          builder: (context, state) => Text(
            'chat ${state.pathParameters['chatId']}',
          ),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          eveningSessionProvider('session-1').overrideWith(
            (ref) async => _detail(privacy: EveningPrivacy.invite),
          ),
          backendRepositoryProvider.overrideWith((ref) {
            repository = _InviteBackendRepository(ref);
            return repository;
          }),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Вписаться по инвайту'));
    await tester.pumpAndSettle();

    expect(repository.joinSessionId, 'session-1');
    expect(repository.joinInviteToken, 'secret-token');
    expect(find.text('chat chat-1'), findsOneWidget);
  });

  testWidgets('preview opens already joined invite-only evening without token',
      (tester) async {
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final router = GoRouter(
      initialLocation: '/evening-preview/session-1',
      routes: [
        GoRoute(
          path: AppRoute.eveningPreview.path,
          name: AppRoute.eveningPreview.name,
          builder: (context, state) => EveningPreviewScreen(
            sessionId: state.pathParameters['sessionId']!,
          ),
        ),
        GoRoute(
          path: AppRoute.meetupChat.path,
          name: AppRoute.meetupChat.name,
          builder: (context, state) => Text(
            'chat ${state.pathParameters['chatId']}',
          ),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          eveningSessionProvider('session-1').overrideWith(
            (ref) async => _detail(
              privacy: EveningPrivacy.invite,
              isJoined: true,
            ),
          ),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Открыть чат вечера'));
    await tester.pumpAndSettle();

    expect(find.text('chat chat-1'), findsOneWidget);
  });

  testWidgets('preview opens evening share screen from header', (tester) async {
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final router = GoRouter(
      initialLocation: '/evening-preview/session-1',
      routes: [
        GoRoute(
          path: AppRoute.eveningPreview.path,
          name: AppRoute.eveningPreview.name,
          builder: (context, state) => EveningPreviewScreen(
            sessionId: state.pathParameters['sessionId']!,
          ),
        ),
        GoRoute(
          path: '/evening-share/:sessionId',
          name: 'eveningShareCard',
          builder: (context, state) => Text(
            'share ${state.pathParameters['sessionId']}',
          ),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          eveningSessionProvider('session-1').overrideWith(
            (ref) async => _detail(privacy: EveningPrivacy.open),
          ),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(LucideIcons.share_2));
    await tester.pumpAndSettle();

    expect(find.text('share session-1'), findsOneWidget);
  });

  testWidgets('evening share card creates public evening link', (tester) async {
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    late _ShareBackendRepository repository;

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          eveningSessionProvider('session-1').overrideWith(
            (ref) async => _detail(privacy: EveningPrivacy.open),
          ),
          backendRepositoryProvider.overrideWith((ref) {
            repository = _ShareBackendRepository(ref);
            return repository;
          }),
        ],
        child: const MaterialApp(
          home: EveningShareCardScreen(sessionId: 'session-1'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(repository.targetType, 'evening_session');
    expect(repository.targetId, 'session-1');
    await tester.scrollUntilVisible(
      find.text('Telegram'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Telegram'), findsOneWidget);
    expect(find.text('Stories'), findsOneWidget);
    expect(
      find.textContaining('https://frendly.tech/evening-test'),
      findsAtLeastNWidgets(1),
    );
  });

  testWidgets('preview caches joined evening chat summary before opening chat',
      (tester) async {
    tester.view.physicalSize = const Size(390, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final router = GoRouter(
      initialLocation: '/evening-preview/session-1',
      routes: [
        GoRoute(
          path: AppRoute.eveningPreview.path,
          name: AppRoute.eveningPreview.name,
          builder: (context, state) => EveningPreviewScreen(
            sessionId: state.pathParameters['sessionId']!,
          ),
        ),
        GoRoute(
          path: AppRoute.meetupChat.path,
          name: AppRoute.meetupChat.name,
          builder: (context, state) {
            final chatId = state.pathParameters['chatId']!;
            return Consumer(
              builder: (context, ref, _) {
                final chat = ref.watch(meetupChatSummaryProvider(chatId));
                return Text(chat?.title ?? 'missing-summary');
              },
            );
          },
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          initialAuthTokensProvider.overrideWith(
            (ref) => const AuthTokens(
              accessToken: 'access-token',
              refreshToken: 'refresh-token',
            ),
          ),
          currentUserIdProvider.overrideWith((ref) => 'user-me'),
          meetupChatsLocalStateProvider.overrideWith(
            (ref) => const <MeetupChat>[],
          ),
          eveningSessionProvider('session-1').overrideWith(
            (ref) async => _detail(
              privacy: EveningPrivacy.open,
              isJoined: true,
            ),
          ),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Открыть чат вечера'));
    await tester.pumpAndSettle();

    expect(find.text('Теплый круг на Покровке'), findsOneWidget);
    expect(find.text('missing-summary'), findsNothing);
  });

  testWidgets('preview keeps join CTA idle when join request fails',
      (tester) async {
    await _pumpPreview(
      tester,
      _detail(privacy: EveningPrivacy.open),
      repositoryBuilder: _FailingPreviewRepository.new,
    );

    await tester.tap(find.text('Вписаться в вечер'));
    await tester.pumpAndSettle();

    expect(find.text('Вписаться в вечер'), findsOneWidget);
    expect(find.text('Открыть чат вечера'), findsNothing);
    expect(
      find.text('Не удалось вступить в вечер. Попробуй ещё раз'),
      findsOneWidget,
    );
  });

  testWidgets('preview keeps request CTA idle when request submit fails',
      (tester) async {
    await _pumpPreview(
      tester,
      _detail(privacy: EveningPrivacy.request),
      repositoryBuilder: _FailingPreviewRepository.new,
    );

    await tester.tap(find.text('Отправить заявку хосту'));
    await tester.pumpAndSettle();

    expect(find.text('Отправить заявку хосту'), findsOneWidget);
    expect(find.text('Заявка отправлена'), findsNothing);
    expect(
      find.text('Не удалось отправить заявку. Попробуй ещё раз'),
      findsOneWidget,
    );
  });
}

Future<void> _pumpPreview(
  WidgetTester tester,
  EveningSessionDetail detail, {
  BackendRepository Function(Ref ref)? repositoryBuilder,
}) async {
  tester.view.physicalSize = const Size(390, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        eveningSessionProvider('session-1').overrideWith((ref) async => detail),
        if (repositoryBuilder != null)
          backendRepositoryProvider.overrideWith(repositoryBuilder),
      ],
      child: const MaterialApp(
        home: EveningPreviewScreen(sessionId: 'session-1'),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

class _InviteBackendRepository extends BackendRepository {
  _InviteBackendRepository(Ref ref) : super(ref: ref, dio: Dio());

  String? joinSessionId;
  String? joinInviteToken;

  @override
  Future<EveningJoinResult> joinEveningSession(
    String sessionId, {
    String? inviteToken,
  }) async {
    joinSessionId = sessionId;
    joinInviteToken = inviteToken;
    return const EveningJoinResult(
      status: 'joined',
      sessionId: 'session-1',
      chatId: 'chat-1',
    );
  }
}

class _FailingPreviewRepository extends BackendRepository {
  _FailingPreviewRepository(Ref ref) : super(ref: ref, dio: Dio());

  @override
  Future<EveningJoinResult> joinEveningSession(
    String sessionId, {
    String? inviteToken,
  }) async {
    throw StateError('join failed');
  }

  @override
  Future<EveningJoinResult> requestEveningSession(
    String sessionId, {
    String? note,
  }) async {
    throw StateError('request failed');
  }
}

class _ShareBackendRepository extends BackendRepository {
  _ShareBackendRepository(Ref ref) : super(ref: ref, dio: Dio());

  String? targetType;
  String? targetId;

  @override
  Future<PublicShareLink> createPublicShare({
    required String targetType,
    required String targetId,
  }) async {
    this.targetType = targetType;
    this.targetId = targetId;
    return PublicShareLink(
      slug: 'evening-test',
      targetType: targetType,
      targetId: targetId,
      appPath: '/evening-preview/$targetId',
      url: 'https://frendly.tech/evening-test',
      deepLink: 'frendly://evening-preview/$targetId',
    );
  }
}

EveningSessionDetail _detail({
  required EveningPrivacy privacy,
  bool isJoined = false,
  bool isRequested = false,
}) {
  return EveningSessionDetail(
    id: 'session-1',
    routeId: 'r-cozy-circle',
    chatId: 'chat-1',
    phase: EveningSessionPhase.scheduled,
    chatPhase: MeetupPhase.soon,
    privacy: privacy,
    title: 'Теплый круг на Покровке',
    vibe: 'Камерный маршрут на вечер',
    emoji: '🍷',
    area: 'Покровка',
    hostName: 'Аня К',
    joinedCount: 4,
    maxGuests: 10,
    totalSteps: 2,
    isJoined: isJoined,
    isRequested: isRequested,
    participants: const [
      EveningSessionParticipant(
        userId: 'user-anya',
        name: 'Аня К',
        role: 'host',
        status: 'joined',
      ),
    ],
    steps: const [
      EveningSessionStep(
        id: 's1',
        time: '19:00',
        endTime: '20:15',
        kind: 'bar',
        title: 'Аперитив',
        venue: 'Brix Wine',
        address: 'Покровка 12',
        emoji: '🍷',
      ),
      EveningSessionStep(
        id: 's2',
        time: '20:30',
        kind: 'show',
        title: 'Стендап',
        venue: 'Standup Store',
        address: 'Дмитровка 32',
        emoji: '🎤',
      ),
    ],
  );
}

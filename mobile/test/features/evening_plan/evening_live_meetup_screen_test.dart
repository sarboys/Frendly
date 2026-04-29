import 'package:big_break_mobile/features/evening_plan/presentation/evening_live_meetup_screen.dart';
import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/evening_session.dart';
import 'package:big_break_mobile/shared/models/meetup_chat.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('live screen hydrates route steps from session detail',
      (tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 900);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          eveningSessionProvider('session-live').overrideWith(
            (ref) async => _liveSession(),
          ),
        ],
        child: const MaterialApp(
          home: EveningLiveMeetupScreen(
            routeId: 'r-cozy-circle',
            mode: EveningLaunchMode.hybrid,
            sessionId: 'session-live',
          ),
        ),
      ),
    );

    await tester.pump();
    await tester.pump();

    expect(find.text('Backend live route'), findsWidgets);
    expect(find.textContaining('Backend Wine'), findsWidgets);
    expect(find.text('На месте'), findsOneWidget);
    expect(find.textContaining('Ты'), findsWidgets);
    expect(find.textContaining('Backend Guest'), findsOneWidget);
    expect(find.text('Аня К'), findsNothing);
  });

  testWidgets('live advance rolls back when backend rejects transition',
      (tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 900);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          eveningSessionProvider('session-live').overrideWith(
            (ref) async => _liveSession(),
          ),
          currentUserIdProvider.overrideWith((ref) => 'user-me'),
          backendRepositoryProvider.overrideWith(
            (ref) => _FailingLiveRepository(ref),
          ),
        ],
        child: const MaterialApp(
          home: EveningLiveMeetupScreen(
            routeId: 'r-cozy-circle',
            mode: EveningLaunchMode.hybrid,
            sessionId: 'session-live',
          ),
        ),
      ),
    );

    await tester.pump();
    await tester.pump();

    expect(find.text('На месте'), findsOneWidget);

    await tester.tap(find.text('Дальше'));
    await tester.pumpAndSettle();

    expect(find.text('На месте'), findsOneWidget);
    expect(find.text('Я на месте'), findsNothing);
    expect(find.text('Не получилось обновить шаг'), findsOneWidget);
  });

  testWidgets('guest live screen hides host step controls', (tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 900);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          currentUserIdProvider.overrideWith((ref) => 'user-guest'),
          eveningSessionProvider('session-live').overrideWith(
            (ref) async => _liveSession(),
          ),
        ],
        child: const MaterialApp(
          home: EveningLiveMeetupScreen(
            routeId: 'r-cozy-circle',
            mode: EveningLaunchMode.hybrid,
            sessionId: 'session-live',
          ),
        ),
      ),
    );

    await tester.pump();
    await tester.pump();

    expect(find.text('Чат'), findsOneWidget);
    expect(find.text('Дальше'), findsNothing);

    await tester.tap(find.text('Backend Aperitif').first);
    await tester.pumpAndSettle();

    expect(find.text('Чек-ин'), findsOneWidget);
    expect(find.text('Пропустить шаг'), findsNothing);
  });
}

class _FailingLiveRepository extends BackendRepository {
  _FailingLiveRepository(Ref ref) : super(ref: ref, dio: Dio());

  @override
  Future<void> advanceEveningStep(String sessionId, String stepId) async {
    throw StateError('advance failed');
  }
}

EveningSessionDetail _liveSession() {
  return const EveningSessionDetail(
    id: 'session-live',
    routeId: 'r-cozy-circle',
    chatId: 'evening-chat-live',
    phase: EveningSessionPhase.live,
    chatPhase: MeetupPhase.live,
    privacy: EveningPrivacy.open,
    title: 'Backend live route',
    vibe: 'Камерно',
    emoji: '🍷',
    hostUserId: 'user-me',
    currentStep: 1,
    totalSteps: 2,
    currentPlace: 'Backend Wine',
    joinedCount: 3,
    maxGuests: 8,
    participants: [
      EveningSessionParticipant(
        userId: 'user-me',
        name: 'Ты',
        role: 'host',
        status: 'joined',
      ),
      EveningSessionParticipant(
        userId: 'user-guest',
        name: 'Backend Guest',
        role: 'guest',
        status: 'joined',
      ),
    ],
    steps: [
      EveningSessionStep(
        id: 'backend-step-1',
        time: '19:00',
        endTime: '20:00',
        kind: 'bar',
        title: 'Backend Aperitif',
        venue: 'Backend Wine',
        address: 'Покровка 12',
        emoji: '🍷',
        status: 'current',
        checkedIn: true,
        distance: '5 мин',
        walkMin: 5,
        lat: 55.759,
        lng: 37.642,
      ),
      EveningSessionStep(
        id: 'backend-step-2',
        time: '20:15',
        kind: 'show',
        title: 'Backend Standup',
        venue: 'Backend Stage',
        address: 'Дмитровка 32',
        emoji: '🎤',
        status: 'upcoming',
        lat: 55.761,
        lng: 37.621,
      ),
    ],
  );
}

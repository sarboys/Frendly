import 'package:big_break_mobile/features/evening_plan/presentation/evening_after_party_screen.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('after party hydrates backend stats for a session',
      (tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 900);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          backendRepositoryProvider.overrideWith(
            (ref) => _AfterPartyRepository(ref),
          ),
        ],
        child: const MaterialApp(
          home: EveningAfterPartyScreen(
            routeId: 'r-cozy-circle',
            sessionId: 'session-done',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Участники'), findsOneWidget);
    expect(find.text('4'), findsOneWidget);
    expect(find.text('Оценка'), findsOneWidget);
    expect(find.text('4.8/5'), findsOneWidget);
    expect(find.text('Фото вечера: 2'), findsOneWidget);
  });

  testWidgets('after party rolls back reaction when feedback save fails',
      (tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 900);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          backendRepositoryProvider.overrideWith(
            (ref) => _FailingFeedbackRepository(ref),
          ),
        ],
        child: const MaterialApp(
          home: EveningAfterPartyScreen(
            routeId: 'r-cozy-circle',
            sessionId: 'session-done',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.byKey(const Key('after-party-reaction-top-active')),
      findsOneWidget,
    );

    await tester.tap(find.text('Хочу повторить'));
    await tester.pumpAndSettle();

    expect(
      find.byKey(const Key('after-party-reaction-top-active')),
      findsOneWidget,
    );
    expect(
      find.byKey(const Key('after-party-reaction-repeat-active')),
      findsNothing,
    );
    expect(find.text('Не получилось сохранить оценку'), findsOneWidget);
  });
}

class _AfterPartyRepository extends BackendRepository {
  _AfterPartyRepository(Ref ref) : super(ref: ref, dio: Dio());

  String? fetchSessionId;

  @override
  Future<Map<String, dynamic>> fetchEveningAfterParty(String sessionId) async {
    fetchSessionId = sessionId;
    return {
      'sessionId': sessionId,
      'participantsCount': 4,
      'ratingAverage': 4.8,
      'ratingsCount': 3,
      'photos': [
        {'id': 'photo-1'},
        {'id': 'photo-2'},
      ],
      'myFeedback': {
        'rating': 5,
        'reaction': 'repeat',
      },
    };
  }
}

class _FailingFeedbackRepository extends BackendRepository {
  _FailingFeedbackRepository(Ref ref) : super(ref: ref, dio: Dio());

  @override
  Future<Map<String, dynamic>> fetchEveningAfterParty(String sessionId) async {
    return {
      'sessionId': sessionId,
      'participantsCount': 4,
      'ratingAverage': 4.8,
      'ratingsCount': 3,
      'photos': const [],
      'myFeedback': {
        'rating': 5,
        'reaction': 'top',
      },
    };
  }

  @override
  Future<Map<String, dynamic>> saveEveningAfterPartyFeedback(
    String sessionId, {
    required int rating,
    String? reaction,
    String? comment,
  }) async {
    throw StateError('feedback failed');
  }
}

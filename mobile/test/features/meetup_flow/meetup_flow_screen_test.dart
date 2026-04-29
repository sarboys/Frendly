import 'package:big_break_mobile/features/after_party/presentation/after_party_screen.dart';
import 'package:big_break_mobile/features/check_in/presentation/check_in_screen.dart';
import 'package:big_break_mobile/features/host_dashboard/presentation/host_dashboard_screen.dart';
import 'package:big_break_mobile/features/join_request/presentation/join_request_screen.dart';
import 'package:big_break_mobile/features/live_meetup/presentation/live_meetup_screen.dart';
import 'package:big_break_mobile/app/core/device/app_location_service.dart';
import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:geolocator/geolocator.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:go_router/go_router.dart';
import '../../test_overrides.dart';

class _FakeLocationService implements AppLocationService {
  const _FakeLocationService();

  @override
  double distanceBetween({
    required double startLatitude,
    required double startLongitude,
    required double endLatitude,
    required double endLongitude,
  }) {
    return 120;
  }

  @override
  Future<Position?> getCurrentPosition() async {
    return Position(
      longitude: 37.6486,
      latitude: 55.7579,
      timestamp: DateTime(2026, 4, 22, 18),
      accuracy: 1,
      altitude: 0,
      altitudeAccuracy: 1,
      heading: 0,
      headingAccuracy: 1,
      speed: 0,
      speedAccuracy: 0,
    );
  }
}

class _FakeMeetupFlowRepository extends BackendRepository {
  _FakeMeetupFlowRepository({
    required super.ref,
    required super.dio,
  });

  @override
  Future<void> confirmCheckIn(String eventId, {String? code}) async {}
}

Widget _wrap(Widget child, {List<Override> extraOverrides = const []}) {
  return ProviderScope(
    overrides: [
      ...buildTestOverrides(),
      ...extraOverrides,
    ],
    child: MaterialApp(home: child),
  );
}

void main() {
  testWidgets('join request screen renders submit CTA', (tester) async {
    await tester.pumpWidget(_wrap(const JoinRequestScreen(eventId: 'e5')));
    await tester.pumpAndSettle();

    expect(find.text('Отправить заявку'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.textContaining('Обычно отвечают'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.textContaining('Обычно отвечают'), findsOneWidget);
  });

  testWidgets('check-in screen renders arrival CTA', (tester) async {
    await tester.pumpWidget(_wrap(const CheckInScreen(eventId: 'e1')));
    await tester.pumpAndSettle();

    expect(find.text('Я на месте'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.textContaining('Покажи хосту'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.textContaining('Покажи хосту'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Ввести код вручную'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Ввести код вручную'), findsOneWidget);
  });

  testWidgets('check-in screen shows real distance after explicit action',
      (tester) async {
    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => ProviderScope(
            overrides: [
              ...buildTestOverrides(),
              appLocationServiceProvider.overrideWithValue(
                const _FakeLocationService(),
              ),
              backendRepositoryProvider.overrideWith(
                (ref) => _FakeMeetupFlowRepository(ref: ref, dio: Dio()),
              ),
            ],
            child: const CheckInScreen(eventId: 'e1'),
          ),
        ),
        GoRoute(
          path: AppRoute.liveMeetup.path,
          name: AppRoute.liveMeetup.name,
          builder: (context, state) => const Text('live-meetup-opened'),
        ),
      ],
    );
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Я на месте'));
    await tester.pumpAndSettle();

    expect(find.text('live-meetup-opened'), findsOneWidget);
  });

  testWidgets('live meetup screen renders chat CTA', (tester) async {
    await tester.pumpWidget(_wrap(const LiveMeetupScreen(eventId: 'e1')));
    await tester.pumpAndSettle();

    expect(find.text('Открыть чат встречи'), findsOneWidget);
    expect(find.text('На встрече сейчас'), findsOneWidget);
  });

  testWidgets('after-party screen renders save CTA', (tester) async {
    await tester.pumpWidget(_wrap(const AfterPartyScreen(eventId: 'e1')));
    await tester.pumpAndSettle();

    expect(find.text('Сохранить'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.textContaining('Они увидят это'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.textContaining('Они увидят это'), findsOneWidget);
  });

  testWidgets('host dashboard renders title', (tester) async {
    await tester.pumpWidget(_wrap(const HostDashboardScreen()));
    await tester.pumpAndSettle();

    expect(find.text('Хост-панель'), findsOneWidget);
    expect(find.text('Этот месяц'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Предстоящие'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Предстоящие'), findsOneWidget);
  });

  testWidgets('host dashboard renders past tab from startsAtIso',
      (tester) async {
    await tester.pumpWidget(_wrap(const HostDashboardScreen()));
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Прошедшие'),
      400,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Прошедшие'), warnIfMissed: false);
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Винный вечер на крыше'),
      400,
      scrollable: find.byType(Scrollable).first,
    );

    expect(find.text('Винный вечер на крыше'), findsOneWidget);
  });
}

import 'package:big_break_mobile/app/core/maps/mapkit_bootstrap.dart';
import 'package:big_break_mobile/app/core/maps/yandex_map_service.dart';
import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/features/onboarding/presentation/onboarding_screen.dart';
import 'package:big_break_mobile/features/tonight/presentation/tonight_screen.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/onboarding_data.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:yandex_mapkit/yandex_mapkit.dart' show Point;

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

Future<void> _completeFirstOnboardingStep(WidgetTester tester) async {
  await tester.tap(find.byKey(const Key('onboarding-birth-date-picker')));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const Key('birth-date-sheet-submit')));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Друзья'));
  await tester.pumpAndSettle();
  await tester.drag(
    find.byType(SingleChildScrollView),
    const Offset(0, -320),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.text('Мужчина').first);
  await tester.pumpAndSettle();
  await tester.tap(find.text('Дальше'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('onboarding asks phone and sms users for email before profile',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        const OnboardingScreen(),
        extraOverrides: [
          onboardingProvider.overrideWith(
            (ref) async => const OnboardingData(
              intent: null,
              gender: null,
              city: null,
              area: null,
              interests: [],
              vibe: null,
              requiredContact: OnboardingContactRequirement.email,
            ),
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Укажи email'), findsOneWidget);

    await tester.tap(find.byType(FilledButton));
    await tester.pumpAndSettle();
    expect(find.text('Укажи email'), findsOneWidget);

    await tester.enterText(
      find.byKey(const Key('onboarding-email-field')),
      'not-email',
    );
    await tester.tap(find.byType(FilledButton));
    await tester.pumpAndSettle();
    expect(find.text('Укажи email'), findsOneWidget);

    await tester.enterText(
      find.byKey(const Key('onboarding-email-field')),
      'user@example.com',
    );
    await tester.pump();
    await tester.ensureVisible(find.text('Дальше'));
    tester.widget<FilledButton>(find.byType(FilledButton)).onPressed!.call();
    await tester.pumpAndSettle();

    expect(find.text('Дата рождения'), findsOneWidget);
  });

  testWidgets('onboarding asks google and yandex users for phone with country',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        const OnboardingScreen(),
        extraOverrides: [
          onboardingProvider.overrideWith(
            (ref) async => const OnboardingData(
              intent: null,
              gender: null,
              city: null,
              area: null,
              interests: [],
              vibe: null,
              requiredContact: OnboardingContactRequirement.phone,
            ),
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Укажи телефон'), findsOneWidget);
    expect(find.text('🇷🇺 +7'), findsOneWidget);

    await tester.tap(find.text('🇷🇺 +7'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Беларусь'));
    await tester.pumpAndSettle();

    await tester.enterText(
        find.byKey(const Key('onboarding-phone-field')), '29 123 45 67');
    await tester.pump();
    await tester.ensureVisible(find.text('Дальше'));
    tester.widget<FilledButton>(find.byType(FilledButton)).onPressed!.call();
    await tester.pumpAndSettle();

    expect(find.text('Дата рождения'), findsOneWidget);
  });

  testWidgets('onboarding puts birth date picker before intent choices',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        const OnboardingScreen(),
        extraOverrides: [
          onboardingProvider.overrideWith(
            (ref) async => const OnboardingData(
              intent: null,
              gender: null,
              city: null,
              area: null,
              interests: [],
              vibe: null,
            ),
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    final birthDateTop = tester
        .getTopLeft(find.byKey(const Key('onboarding-birth-date-picker')))
        .dy;
    final intentTop = tester.getTopLeft(find.text('Зачем ты здесь?')).dy;

    expect(birthDateTop, lessThan(intentTop));

    await tester.tap(find.byKey(const Key('onboarding-birth-date-picker')));
    await tester.pumpAndSettle();

    expect(find.byType(CalendarDatePicker), findsOneWidget);
  });

  testWidgets('onboarding includes all front interests', (tester) async {
    await tester.pumpWidget(
      _wrap(
        const OnboardingScreen(),
        extraOverrides: [
          onboardingProvider.overrideWith(
            (ref) async => const OnboardingData(
              intent: null,
              gender: null,
              city: null,
              area: null,
              interests: [],
              vibe: null,
            ),
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    await _completeFirstOnboardingStep(tester);
    await tester.enterText(find.byType(TextField), 'Покровка, Москва');
    await tester.pump();
    await tester.tap(find.text('Дальше'));
    await tester.pumpAndSettle();

    expect(find.text('Походы'), findsOneWidget);
    expect(find.text('Фото'), findsOneWidget);
  });

  testWidgets('onboarding location step uses address input and geo CTA',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        const OnboardingScreen(),
        extraOverrides: [
          onboardingProvider.overrideWith(
            (ref) async => const OnboardingData(
              intent: null,
              gender: null,
              city: null,
              area: null,
              interests: [],
              vibe: null,
            ),
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    await _completeFirstOnboardingStep(tester);

    expect(find.text('Адрес или город'), findsOneWidget);
    expect(find.text('Определить по гео'), findsOneWidget);
    expect(find.text('Москва'), findsNothing);
    expect(find.text('Чистые пруды'), findsNothing);
  });

  testWidgets('onboarding location step shows yandex suggestions',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        const OnboardingScreen(),
        extraOverrides: [
          onboardingProvider.overrideWith(
            (ref) async => const OnboardingData(
              intent: null,
              gender: null,
              city: null,
              area: null,
              interests: [],
              vibe: null,
            ),
          ),
          yandexMapServiceProvider.overrideWithValue(
            _FakeYandexMapService(),
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    await _completeFirstOnboardingStep(tester);
    await tester.enterText(find.byType(TextField), 'Покровка');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pump();

    expect(find.text('Покровка 17'), findsOneWidget);
    expect(find.text('Покровка 19'), findsOneWidget);
  });

  testWidgets('onboarding saves only city from address suggestion',
      (tester) async {
    late _RecordingOnboardingRepository repository;

    await tester.pumpWidget(
      _wrapOnboardingFlow(
        (ref) => repository = _RecordingOnboardingRepository(ref: ref),
        extraOverrides: [
          onboardingProvider.overrideWith(
            (ref) async => const OnboardingData(
              intent: null,
              gender: null,
              city: null,
              area: null,
              interests: [],
              vibe: null,
            ),
          ),
          yandexMapServiceProvider.overrideWithValue(
            _FakeYandexMapService(),
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    await _completeFirstOnboardingStep(tester);
    await tester.enterText(find.byType(TextField), 'Покровка');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pump();
    await tester.tap(find.text('Покровка 17'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Дальше'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Кофе'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Кино'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Дальше'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Спокойно'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Готово'));
    await tester.pumpAndSettle();

    expect(repository.saved, isNotNull);
    expect(repository.saved?.city, 'Москва');
    expect(repository.saved?.area, isNull);
    expect(find.text('tonight-opened'), findsOneWidget);
  });

  testWidgets('onboarding requires gender selection before continuing',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        const OnboardingScreen(),
        extraOverrides: [
          onboardingProvider.overrideWith(
            (ref) async => const OnboardingData(
              intent: null,
              gender: null,
              city: null,
              area: null,
              interests: [],
              vibe: null,
            ),
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Мужчина'), findsOneWidget);
    expect(find.text('Женщина'), findsOneWidget);

    await tester.tap(find.text('Друзья'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Дальше'));
    await tester.pumpAndSettle();

    expect(find.text('Зачем ты здесь?'), findsOneWidget);
    expect(find.text('Где ты?'), findsNothing);
  });

  testWidgets('tonight notification dot hides when unread count is zero',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        const TonightScreen(),
        extraOverrides: [
          notificationUnreadCountProvider.overrideWith((ref) async => 0),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(
        find.byKey(const ValueKey('tonight-notification-dot')), findsNothing);
  });

  testWidgets('tonight notification dot shows when unread count is positive',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        const TonightScreen(),
        extraOverrides: [
          notificationUnreadCountProvider.overrideWith((ref) async => 3),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(
        find.byKey(const ValueKey('tonight-notification-dot')), findsOneWidget);
  });

  testWidgets('tonight notification bell shakes only with unread count',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        const TonightScreen(),
        extraOverrides: [
          notificationUnreadCountProvider.overrideWith((ref) async => 0),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.byKey(const ValueKey('tonight-notification-bell-shake')),
      findsNothing,
    );

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();

    await tester.pumpWidget(
      _wrap(
        const TonightScreen(),
        extraOverrides: [
          notificationUnreadCountProvider.overrideWith((ref) async => 2),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.byKey(const ValueKey('tonight-notification-bell-shake')),
      findsOneWidget,
    );
  });

  testWidgets('tonight header uses onboarding city and area', (tester) async {
    await tester.pumpWidget(
      _wrap(
        const TonightScreen(),
        extraOverrides: [
          onboardingProvider.overrideWith(
            (ref) async => const OnboardingData(
              intent: 'both',
              gender: 'male',
              city: 'Санкт-Петербург',
              area: 'Петроградка',
              interests: ['Кофе', 'Кино'],
              vibe: 'calm',
            ),
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Санкт-Петербург · Петроградка'), findsOneWidget);
    expect(find.text('Чистые пруды'), findsNothing);
  });

  testWidgets('tonight renders posters teaser section', (tester) async {
    await tester.pumpWidget(_wrap(const TonightScreen()));
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Афиша рядом'),
      500,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();

    expect(find.text('Афиша рядом'), findsOneWidget);
  });
}

class _NoopMapkitBootstrap implements MapkitBootstrap {
  const _NoopMapkitBootstrap();

  @override
  Future<void> ensureInitialized() async {}
}

class _FakeYandexMapService extends YandexMapService {
  _FakeYandexMapService() : super(bootstrap: const _NoopMapkitBootstrap());

  @override
  Future<List<ResolvedAddress>> searchPlaces(
    String query, {
    Point? near,
  }) async {
    return const [
      ResolvedAddress(
        name: 'Покровка 17',
        address: 'Москва, Покровка 17',
        point: Point(latitude: 55.757, longitude: 37.648),
        category: 'Яндекс',
      ),
      ResolvedAddress(
        name: 'Покровка 19',
        address: 'Москва, Покровка 19',
        point: Point(latitude: 55.758, longitude: 37.649),
        category: 'Яндекс',
      ),
    ];
  }
}

class _RecordingOnboardingRepository extends BackendRepository {
  _RecordingOnboardingRepository({
    required super.ref,
  }) : super(dio: Dio());

  OnboardingData? saved;

  @override
  Future<OnboardingData> saveOnboarding(OnboardingData data) async {
    saved = data;
    return data;
  }
}

Widget _wrapOnboardingFlow(
  _RecordingOnboardingRepository Function(Ref ref) createRepository, {
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
            backendRepositoryProvider.overrideWith(createRepository),
            ...extraOverrides,
          ],
          child: const OnboardingScreen(),
        ),
      ),
      GoRoute(
        path: AppRoute.tonight.path,
        name: AppRoute.tonight.name,
        builder: (context, state) => const Scaffold(
          body: Center(child: Text('tonight-opened')),
        ),
      ),
    ],
  );

  return MaterialApp.router(routerConfig: router);
}

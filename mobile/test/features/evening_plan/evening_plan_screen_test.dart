import 'package:big_break_mobile/app/navigation/app_routes.dart';
import 'package:big_break_mobile/features/evening_plan/presentation/evening_plan_data.dart';
import 'package:big_break_mobile/features/evening_plan/presentation/evening_plan_screen.dart';
import 'package:big_break_mobile/app/core/providers/core_providers.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/evening_session.dart';
import 'package:big_break_mobile/shared/models/meetup_chat.dart';
import 'package:big_break_mobile/shared/models/subscription.dart';
import 'package:big_break_mobile/shared/models/tokens.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

void main() {
  testWidgets('plan timeline opens details and keeps action taps local',
      (tester) async {
    _setMobileViewport(tester);
    await tester.pumpWidget(
      _planApp(
        screen: EveningPlanScreen(
          routeId: eveningRoutes.first.id,
        ),
      ),
    );

    expect(find.text('Тёплый круг на Покровке'), findsOneWidget);
    expect(find.text('В чат'), findsWidgets);

    await tester.tap(find.text('Аперитив в Brix Wine'));
    await tester.pumpAndSettle();

    expect(find.text('Перк партнёра'), findsOneWidget);
    expect(find.text('Адрес'), findsOneWidget);

    await tester.tap(find.byTooltip('Закрыть'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Перк').first);
    await tester.pumpAndSettle();

    expect(find.text('Перк партнёра'), findsOneWidget);
    expect(
      find.text('Бронируем в приложении — стол держим до начала встречи'),
      findsOneWidget,
    );
    expect(find.text('Аперитив в Brix Wine'), findsOneWidget);
  });

  testWidgets('perk, ticket and chat states update immediately',
      (tester) async {
    _setMobileViewport(tester);
    await tester.pumpWidget(
      _planApp(
        screen: EveningPlanScreen(
          routeId: eveningRoutes.first.id,
        ),
      ),
    );

    await tester.tap(find.text('В чат').first);
    await tester.pumpAndSettle();
    expect(find.text('В чате'), findsOneWidget);
    expect(find.textContaining('Отправлено в meetup-чат'), findsOneWidget);

    await tester.scrollUntilVisible(
      find.text('800 ₽'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('800 ₽'));
    await tester.pumpAndSettle();
    expect(find.text('Куплено'), findsWidgets);

    await tester.scrollUntilVisible(
      find.text('Перк').first,
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Перк').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Забронировать с перком'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Подтвердить бронь'));
    await tester.pumpAndSettle();
    expect(
      find.text('Покажи код на входе — перк применят автоматически'),
      findsOneWidget,
    );
    await tester.tap(find.text('Готово'));
    await tester.pumpAndSettle();
    expect(find.text('Использован'), findsWidgets);
  });

  testWidgets('timeline rail line is not fixed to one card height',
      (tester) async {
    _setMobileViewport(tester);
    await tester.pumpWidget(
      _planApp(
        screen: EveningPlanScreen(
          routeId: eveningRoutes.first.id,
        ),
      ),
    );

    final fixedRailLine = find.byWidgetPredicate((widget) {
      if (widget is! Container) {
        return false;
      }
      final constraints = widget.constraints;
      return constraints?.minWidth == 2 &&
          constraints?.maxWidth == 2 &&
          constraints?.minHeight == 132 &&
          constraints?.maxHeight == 132;
    });

    expect(fixedRailLine, findsNothing);
  });

  testWidgets('sticky plan CTA keeps arrow after label', (tester) async {
    _setMobileViewport(tester);
    await tester.pumpWidget(
      _planApp(
        screen: EveningPlanScreen(
          routeId: eveningRoutes.first.id,
        ),
      ),
    );

    final labelCenter = tester.getCenter(find.text('Поехали по маршруту'));
    final arrowCenter = tester.getCenter(find.byIcon(LucideIcons.arrow_right));

    expect(arrowCenter.dx, greaterThan(labelCenter.dx));
  });

  testWidgets('plan CTA opens publish sheet with privacy controls',
      (tester) async {
    _setMobileViewport(tester);
    await tester.pumpWidget(
      _planApp(
        screen: EveningPlanScreen(
          routeId: eveningRoutes.first.id,
        ),
      ),
    );

    await tester.tap(find.text('Поехали по маршруту'));
    await tester.pumpAndSettle();

    expect(find.text('Опубликовать вечер?'), findsOneWidget);
    expect(find.text('Кто может вписаться'), findsOneWidget);
    expect(find.text('Открытый'), findsOneWidget);
    expect(find.text('По заявке'), findsOneWidget);
    expect(find.text('По приглашениям'), findsOneWidget);
    expect(find.text('Опубликовать и собрать людей'), findsOneWidget);
    expect(find.text('Сбор участников'), findsOneWidget);
    expect(find.text('Уже идут с тобой'), findsNothing);
    expect(find.text('Пока только ты'), findsOneWidget);
    expect(find.text('Аня К'), findsNothing);
    expect(find.text('Марк С'), findsNothing);
    expect(
      find.text('Live-сценарий запустишь из чата вечера, когда соберётесь'),
      findsOneWidget,
    );
  });

  testWidgets('publish failure shows real error instead of local success',
      (tester) async {
    _setMobileViewport(tester);
    await tester.pumpWidget(
      _planApp(
        screen: EveningPlanScreen(
          routeId: eveningRoutes.first.id,
        ),
      ),
    );

    await tester.tap(find.text('Поехали по маршруту'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Опубликовать и собрать людей'));
    await tester.pumpAndSettle();

    expect(
      find.text(
          'Не удалось опубликовать вечер. Проверь сеть и попробуй ещё раз'),
      findsOneWidget,
    );
    expect(find.text('Опубликовали локально, сеть недоступна'), findsNothing);
    expect(find.text('Поехали по маршруту'), findsOneWidget);
  });

  testWidgets('publish caches new evening chat summary before opening chat',
      (tester) async {
    _setMobileViewport(tester);
    final route = eveningRoutes.first;
    final router = GoRouter(
      initialLocation: '/evening-plan/${route.id}',
      routes: [
        GoRoute(
          path: AppRoute.eveningPlan.path,
          name: AppRoute.eveningPlan.name,
          builder: (context, state) => EveningPlanScreen(
            routeId: state.pathParameters['routeId']!,
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
                return Material(
                  child: Text(chat?.hostUserId ?? 'missing-summary'),
                );
              },
            );
          },
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          backendRepositoryProvider.overrideWith(
            (ref) => _PublishingEveningPlanRepository(ref),
          ),
          initialAuthTokensProvider.overrideWith(
            (ref) => const AuthTokens(
              accessToken: 'access-token',
              refreshToken: 'refresh-token',
            ),
          ),
          currentUserIdProvider.overrideWith((ref) => 'user-me'),
          subscriptionStateProvider.overrideWith((ref) async {
            return _inactiveSubscription;
          }),
          meetupChatsLocalStateProvider.overrideWith(
            (ref) => const [
              MeetupChat(
                id: 'old-chat',
                eventId: 'event-old',
                title: 'Старый чат',
                emoji: '🍷',
                time: '20:00',
                lastMessage: 'Старое',
                lastAuthor: 'Аня',
                lastTime: '1 ч',
                unread: 0,
                members: ['Аня', 'Ты'],
              ),
            ],
          ),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Поехали по маршруту'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Опубликовать и собрать людей'));
    await tester.pumpAndSettle();

    expect(find.text('user-me'), findsOneWidget);
    expect(find.text('missing-summary'), findsNothing);
  });

  testWidgets('plan hydrates route detail from backend over local fallback',
      (tester) async {
    _setMobileViewport(tester);
    await tester.pumpWidget(
      _planApp(
        screen: const EveningPlanScreen(
          routeId: 'r-cozy-circle',
        ),
        overrides: [
          backendRepositoryProvider.overrideWith(
            (ref) => _FakeEveningPlanRepository(ref),
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Backend Plan Route'), findsOneWidget);
    expect(find.text('Backend Stop'), findsOneWidget);
  });

  testWidgets('plan can auto open launch sheet from soon chat', (tester) async {
    _setMobileViewport(tester);
    await tester.pumpWidget(
      _planApp(
        screen: EveningPlanScreen(
          routeId: eveningRoutes.first.id,
          autoOpenLaunch: true,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Опубликовать вечер?'), findsOneWidget);
  });

  testWidgets('premium evening route is locked by default like front',
      (tester) async {
    _setMobileViewport(tester);
    await tester.pumpWidget(
      _planApp(
        screen: const EveningPlanScreen(
          routeId: 'r-date-noir',
        ),
      ),
    );

    expect(find.text('Премиум-маршрут Frendly+'), findsOneWidget);
    expect(find.text('Открыть Frendly+'), findsOneWidget);
    expect(find.text('Авторское кино в Garage Screen'), findsNothing);
  });

  testWidgets('unlocked premium timeline header does not overflow',
      (tester) async {
    _setMobileViewport(tester);
    await tester.pumpWidget(
      _planApp(
        screen: const EveningPlanScreen(
          routeId: 'r-date-noir',
          isPremium: true,
        ),
      ),
    );

    expect(find.text('Авторское кино в Garage Screen'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('premium route unlocks from subscription state', (tester) async {
    _setMobileViewport(tester);
    await tester.pumpWidget(
      _planApp(
        screen: const EveningPlanScreen(
          routeId: 'r-date-noir',
        ),
        overrides: [
          subscriptionStateProvider.overrideWith((ref) async {
            return _activeSubscription;
          }),
        ],
      ),
    );
    await tester.pump();

    expect(find.text('Авторское кино в Garage Screen'), findsOneWidget);
    expect(find.text('Премиум-маршрут Frendly+'), findsNothing);
  });
}

void _setMobileViewport(WidgetTester tester) {
  tester.view.physicalSize = const Size(390, 1200);
  tester.view.devicePixelRatio = 1;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
}

Widget _planApp({
  required EveningPlanScreen screen,
  List<Override> overrides = const [],
}) {
  return ProviderScope(
    overrides: [
      backendRepositoryProvider.overrideWith(
        (ref) => _UnavailableEveningPlanRepository(ref),
      ),
      subscriptionStateProvider.overrideWith((ref) async {
        return _inactiveSubscription;
      }),
      ...overrides,
    ],
    child: MaterialApp(home: screen),
  );
}

const _inactiveSubscription = SubscriptionStateData(
  plan: null,
  status: 'inactive',
  startedAt: null,
  renewsAt: null,
  trialEndsAt: null,
);

const _activeSubscription = SubscriptionStateData(
  plan: 'year',
  status: 'active',
  startedAt: null,
  renewsAt: null,
  trialEndsAt: null,
);

class _UnavailableEveningPlanRepository extends BackendRepository {
  _UnavailableEveningPlanRepository(Ref ref) : super(ref: ref, dio: Dio());

  @override
  Future<Map<String, dynamic>> fetchEveningRoute(String routeId) async {
    throw StateError('Network disabled in plan screen widget tests');
  }

  @override
  Future<EveningPublishResult> publishEveningRoute(
    String routeId, {
    required EveningPrivacy privacy,
  }) async {
    throw StateError('Network disabled in plan screen widget tests');
  }
}

class _FakeEveningPlanRepository extends BackendRepository {
  _FakeEveningPlanRepository(Ref ref) : super(ref: ref, dio: Dio());

  @override
  Future<Map<String, dynamic>> fetchEveningRoute(String routeId) async {
    return {
      'id': routeId,
      'title': 'Backend Plan Route',
      'vibe': 'С backend',
      'blurb': 'Маршрут из API',
      'totalPriceFrom': 900,
      'totalSavings': 300,
      'durationLabel': '19:00 - 22:00',
      'area': 'Центр',
      'goal': 'newfriends',
      'mood': 'chill',
      'budget': 'mid',
      'premium': false,
      'hostsCount': 3,
      'steps': [
        {
          'id': 'backend-step',
          'time': '19:00',
          'kind': 'bar',
          'title': 'Backend Stop',
          'venue': 'Backend Bar',
          'address': 'Центр 1',
          'emoji': '🍷',
          'distance': '0.5 км',
          'lat': 0.4,
          'lng': 0.5,
        },
      ],
    };
  }
}

class _PublishingEveningPlanRepository extends BackendRepository {
  _PublishingEveningPlanRepository(Ref ref) : super(ref: ref, dio: Dio());

  @override
  Future<Map<String, dynamic>> fetchEveningRoute(String routeId) async {
    throw StateError('Use local route fallback');
  }

  @override
  Future<EveningPublishResult> publishEveningRoute(
    String routeId, {
    required EveningPrivacy privacy,
  }) async {
    return EveningPublishResult(
      sessionId: 'session-new',
      routeId: routeId,
      chatId: 'evening-chat-new',
      phase: EveningSessionPhase.scheduled,
      privacy: privacy,
      joinedCount: 1,
      maxGuests: 10,
    );
  }
}

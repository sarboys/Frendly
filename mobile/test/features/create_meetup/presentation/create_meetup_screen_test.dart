import 'package:big_break_mobile/app/core/maps/mapkit_bootstrap.dart';
import 'package:big_break_mobile/app/core/maps/yandex_map_service.dart';
import 'package:big_break_mobile/features/create_meetup/presentation/create_meetup_screen.dart';
import 'package:big_break_mobile/shared/data/backend_repository.dart';
import 'package:big_break_mobile/shared/models/event.dart';
import 'package:big_break_mobile/shared/models/event_detail.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:yandex_mapkit/yandex_mapkit.dart';

import '../../../test_overrides.dart';

class _NoopMapkitBootstrap implements MapkitBootstrap {
  const _NoopMapkitBootstrap();

  @override
  Future<void> ensureInitialized() async {}
}

class _FakeCreateMeetupRepository extends BackendRepository {
  _FakeCreateMeetupRepository({
    required super.ref,
    required super.dio,
  });

  EventJoinMode? lastJoinMode;
  String? lastIdempotencyKey;
  String? lastCommunityId;
  double? lastDistanceKm;
  double? lastLatitude;
  double? lastLongitude;

  @override
  Future<EventDetail> createEvent({
    required String title,
    required String description,
    required String emoji,
    required String vibe,
    required String place,
    required DateTime startsAt,
    required int capacity,
    String mode = 'default',
    String lifestyle = 'neutral',
    String priceMode = 'free',
    int? priceAmountFrom,
    int? priceAmountTo,
    String accessMode = 'open',
    String genderMode = 'all',
    String visibilityMode = 'public',
    EventJoinMode joinMode = EventJoinMode.open,
    String? inviteeUserId,
    String? posterId,
    String? afterDarkCategory,
    String? afterDarkGlow,
    String? dressCode,
    String? ageRange,
    String? ratioLabel,
    String? communityId,
    double? distanceKm,
    double? latitude,
    double? longitude,
    bool consentRequired = false,
    List<String>? rules,
    String? idempotencyKey,
  }) async {
    lastJoinMode = joinMode;
    lastIdempotencyKey = idempotencyKey;
    lastCommunityId = communityId;
    lastDistanceKm = distanceKm;
    lastLatitude = latitude;
    lastLongitude = longitude;
    return const EventDetail(
      id: 'e-created',
      title: 'Новая встреча',
      emoji: '🍷',
      time: 'Сегодня · 20:00',
      place: 'Brix Wine, Покровка 12',
      distance: '1.0 км',
      vibe: 'Спокойно',
      description: 'Описание',
      hostNote: null,
      joined: false,
      partnerName: null,
      partnerOffer: null,
      capacity: 6,
      going: 1,
      chatId: null,
      host: EventHost(
        id: 'user-me',
        displayName: 'Никита М',
        verified: true,
        rating: 4.9,
        meetupCount: 10,
        avatarUrl: null,
      ),
      attendees: [
        EventAttendee(
          id: 'user-me',
          displayName: 'Никита М',
          avatarUrl: null,
        ),
      ],
    );
  }
}

class _FakeYandexMapService extends YandexMapService {
  _FakeYandexMapService() : super(bootstrap: const _NoopMapkitBootstrap());

  @override
  Future<ResolvedAddress?> searchAddress(String query, {Point? near}) async {
    switch (query.trim().toLowerCase()) {
      case 'тверская':
        return const ResolvedAddress(
          name: 'Тверская улица',
          address: 'Тверская улица, Москва',
          point: Point(latitude: 55.765, longitude: 37.605),
        );
      case 'brix wine, покровка 12':
        return const ResolvedAddress(
          name: 'Brix Wine',
          address: 'Покровка 12, Москва',
          point: Point(latitude: 55.7605, longitude: 37.6442),
        );
      default:
        return null;
    }
  }

  @override
  Future<List<ResolvedAddress>> searchPlaces(String query,
      {Point? near}) async {
    final normalized = query.trim().toLowerCase();
    if (normalized == 'тверская') {
      return const [
        ResolvedAddress(
          name: 'Тверская улица',
          address: 'Тверская улица, Москва',
          point: Point(latitude: 55.765, longitude: 37.605),
        ),
      ];
    }
    if (normalized == 'кофе') {
      return const [
        ResolvedAddress(
          name: 'Кофемания',
          address: 'Большая Никитская 13, Москва',
          point: Point(latitude: 55.756, longitude: 37.601),
          category: 'Место',
        ),
        ResolvedAddress(
          name: 'ABC Coffee',
          address: 'Покровка 1, Москва',
          point: Point(latitude: 55.759, longitude: 37.647),
          category: 'Место',
        ),
      ];
    }
    return const [];
  }
}

Widget _wrap(
  void Function(_FakeCreateMeetupRepository repository) onReady, {
  List<Override> overrides = const [],
  String? communityId,
}) {
  final router = GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => ProviderScope(
          overrides: [
            ...buildTestOverrides(),
            backendRepositoryProvider.overrideWith((ref) {
              final repository = _FakeCreateMeetupRepository(
                ref: ref,
                dio: Dio(),
              );
              onReady(repository);
              return repository;
            }),
            yandexMapServiceProvider.overrideWithValue(_FakeYandexMapService()),
            ...overrides,
          ],
          child: CreateMeetupScreen(communityId: communityId),
        ),
        routes: [
          GoRoute(
            path: 'event/:eventId',
            name: 'eventDetail',
            builder: (context, state) => const SizedBox.shrink(),
          ),
        ],
      ),
    ],
  );

  return MaterialApp.router(routerConfig: router);
}

void main() {
  final descriptionField = find.byWidgetPredicate(
    (widget) => widget is TextField && widget.maxLines == 3,
    description: 'description text field',
  );
  final placeSheetSearchField = find.byWidgetPredicate(
    (widget) =>
        widget is TextField &&
        widget.decoration?.hintText == 'Кафе, бар, парк или адрес',
    description: 'place sheet search field',
  );

  testWidgets('create meetup screen renders publish CTA and helper copy',
      (tester) async {
    await tester.pumpWidget(_wrap((_) {}));
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Образ жизни'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Образ жизни'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Стоимость'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Стоимость'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Кого приглашаешь'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Кого приглашаешь'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Опубликовать встречу'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Опубликовать встречу'), findsOneWidget);
    expect(
      find.text(
        'Чат откроется автоматически, как только кто-то присоединится',
        skipOffstage: false,
      ),
      findsOneWidget,
    );
  });

  testWidgets('create meetup screen shows meetup plus dating mode segment',
      (tester) async {
    await tester.pumpWidget(_wrap((_) {}));
    await tester.pumpAndSettle();

    expect(find.text('Встреча'), findsOneWidget);
    expect(find.text('Свидание'), findsOneWidget);
  });

  testWidgets('create meetup sends request join mode for invite visibility',
      (tester) async {
    _FakeCreateMeetupRepository? repository;

    await tester.pumpWidget(_wrap((value) => repository = value));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).at(0), 'Ужин');
    final visibilityOption = find.text('По ссылке');
    await tester.scrollUntilVisible(
      visibilityOption,
      250,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    await tester.tap(visibilityOption, warnIfMissed: false);
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Описание'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.enterText(descriptionField, 'Короткое описание');
    await tester.scrollUntilVisible(
      find.text('Опубликовать встречу'),
      300,
      scrollable: find.byType(Scrollable).first,
    );

    await tester.tap(find.text('Опубликовать встречу'));
    await tester.pumpAndSettle();

    expect(repository, isNotNull);
    expect(repository!.lastJoinMode, EventJoinMode.request);
  });

  testWidgets('create meetup sends idempotency key on publish', (tester) async {
    _FakeCreateMeetupRepository? repository;

    await tester.pumpWidget(_wrap((value) => repository = value));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).at(0), 'Ужин');
    await tester.scrollUntilVisible(
      find.text('Описание'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.enterText(descriptionField, 'Короткое описание');
    await tester.scrollUntilVisible(
      find.text('Опубликовать встречу'),
      300,
      scrollable: find.byType(Scrollable).first,
    );

    await tester.tap(find.text('Опубликовать встречу'));
    await tester.pumpAndSettle();

    expect(repository, isNotNull);
    expect(repository!.lastIdempotencyKey, isNotNull);
    expect(repository!.lastIdempotencyKey, startsWith('mobile-create-event-'));
  });

  testWidgets('create meetup resolves default place coordinates before publish',
      (tester) async {
    _FakeCreateMeetupRepository? repository;

    await tester.pumpWidget(_wrap((value) => repository = value));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).at(0), 'Ужин');
    await tester.scrollUntilVisible(
      find.text('Описание'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.enterText(descriptionField, 'Короткое описание');
    await tester.scrollUntilVisible(
      find.text('Опубликовать встречу'),
      300,
      scrollable: find.byType(Scrollable).first,
    );

    await tester.tap(find.text('Опубликовать встречу'));
    await tester.pumpAndSettle();

    expect(repository, isNotNull);
    expect(repository!.lastLatitude, 55.7605);
    expect(repository!.lastLongitude, 37.6442);
  });

  testWidgets('create meetup sends community id when opened from community',
      (tester) async {
    _FakeCreateMeetupRepository? repository;

    await tester.pumpWidget(
      _wrap(
        (value) => repository = value,
        communityId: 'c-owned',
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).at(0), 'Бранч клуба');
    await tester.scrollUntilVisible(
      find.text('Описание'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.enterText(descriptionField, 'Короткое описание');
    await tester.scrollUntilVisible(
      find.text('Опубликовать встречу'),
      300,
      scrollable: find.byType(Scrollable).first,
    );

    await tester.tap(find.text('Опубликовать встречу'));
    await tester.pumpAndSettle();

    expect(repository, isNotNull);
    expect(repository!.lastCommunityId, 'c-owned');
  });

  testWidgets('create meetup date time sheet shows only calendar and time',
      (tester) async {
    await tester.pumpWidget(_wrap((_) {}));
    await tester.pumpAndSettle();

    await tester.tap(find.textContaining('Сегодня').first);
    await tester.pumpAndSettle();

    expect(find.text('Сегодня'), findsNothing);
    expect(find.text('Завтра'), findsNothing);
    expect(find.text('Послезавтра'), findsNothing);
    expect(find.byType(CalendarDatePicker), findsOneWidget);
  });

  testWidgets('create meetup place sheet shows yandex search result',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        (_) {},
        overrides: [
          yandexMapServiceProvider.overrideWithValue(_FakeYandexMapService()),
        ],
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Brix Wine, Покровка 12'));
    await tester.pumpAndSettle();

    expect(find.text('Где встречаемся'), findsOneWidget);

    await tester.enterText(placeSheetSearchField, 'Тверская');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();

    expect(find.text('Тверская улица'), findsOneWidget);
    expect(find.text('Тверская улица, Москва · Яндекс'), findsOneWidget);
  });

  testWidgets('create meetup place sheet shows several business results',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        (_) {},
        overrides: [
          yandexMapServiceProvider.overrideWithValue(_FakeYandexMapService()),
        ],
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Brix Wine, Покровка 12'));
    await tester.pumpAndSettle();

    await tester.enterText(placeSheetSearchField, 'Кофе');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();

    expect(find.text('Кофемания'), findsOneWidget);
    expect(find.text('ABC Coffee'), findsOneWidget);
  });

  testWidgets('create meetup submits coordinates from selected yandex place',
      (tester) async {
    _FakeCreateMeetupRepository? repository;

    await tester.pumpWidget(
      _wrap(
        (value) => repository = value,
        overrides: [
          yandexMapServiceProvider.overrideWithValue(_FakeYandexMapService()),
        ],
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Brix Wine, Покровка 12'));
    await tester.pumpAndSettle();
    await tester.enterText(placeSheetSearchField, 'Тверская');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Тверская улица'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).at(0), 'Кофе после работы');
    await tester.scrollUntilVisible(
      find.text('Описание'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.enterText(descriptionField, 'Короткая встреча в центре');
    await tester.scrollUntilVisible(
      find.text('Опубликовать встречу'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Опубликовать встречу'));
    await tester.pumpAndSettle();

    expect(repository, isNotNull);
    expect(repository!.lastLatitude, 55.765);
    expect(repository!.lastLongitude, 37.605);
    expect(repository!.lastDistanceKm, isNull);
  });
}

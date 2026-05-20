import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile2/app/core/device/app_media_prewarm_service.dart';
import 'package:mobile2/app/core/providers/core_providers.dart';
import 'package:mobile2/features/dating/presentation/dating_filter_screen.dart';
import 'package:mobile2/features/dating/presentation/dating_screen.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/data/backend_repository.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_highlight_text.dart';

void main() {
  test('dating discover filters default to widest active range', () {
    const filters = DatingDiscoverFilters();

    expect(filters.gender, isNull);
    expect(filters.ageMin, 18);
    expect(filters.ageMax, 99);
    expect(filters.radiusKm, 500);
    expect(filters.interests, isEmpty);
    expect(filters.verifiedOnly, isFalse);
    expect(filters.frendlyPlusOnly, isFalse);
    expect(filters.onlineOnly, isFalse);
    expect(filters.newThisWeekOnly, isFalse);
  });

  testWidgets('dating filters apply opposite gender by default',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1100));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final repository = _DatingRepository();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          initialAuthTokensProvider.overrideWith(
            (_) => const AuthTokens(
              accessToken: 'access',
              refreshToken: 'refresh',
            ),
          ),
          currentUserProvider.overrideWith(
            (_) => const BackendUser(
              id: 'user-me',
              name: 'Сергей',
              gender: 'male',
              onboardingComplete: true,
            ),
          ),
          tokenWalletProvider.overrideWith(
            (_) async => const TokenWalletData(balance: 50),
          ),
          notificationUnreadCountProvider.overrideWith((_) async => 0),
          backendRepositoryProvider.overrideWithValue(repository),
          appLocalCacheStoreProvider.overrideWith((_) => null),
          appMediaPrewarmServiceProvider.overrideWithValue(
            AppMediaPrewarmService(fetchFile: (_, __) async {}),
          ),
        ],
        child: MaterialApp.router(
          theme: DateasyTheme.theme,
          routerConfig: GoRouter(
            initialLocation: '/dating/filter',
            routes: [
              GoRoute(
                  path: '/dating', builder: (_, __) => const DatingScreen()),
              GoRoute(
                path: '/dating/filter',
                builder: (_, __) => const DatingFilterScreen(),
              ),
              GoRoute(
                path: '/settings',
                builder: (_, __) => const Scaffold(body: Text('settings')),
              ),
              GoRoute(
                path: '/wallet',
                builder: (_, __) => const Scaffold(body: Text('wallet')),
              ),
              GoRoute(
                path: '/notifications',
                builder: (_, __) => const Scaffold(body: Text('notifications')),
              ),
              GoRoute(
                path: '/profile',
                builder: (_, __) => const Scaffold(body: Text('profile')),
              ),
            ],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Применить фильтры'));
    await tester.pumpAndSettle();

    expect(repository.lastGender, 'female');
    expect(repository.lastAgeMin, 18);
    expect(repository.lastAgeMax, 99);
    expect(repository.lastRadiusKm, 500);
    expect(repository.lastVerifiedOnly, isFalse);
    expect(repository.lastOnlineOnly, isFalse);
    expect(repository.lastNewThisWeekOnly, isFalse);
  });

  testWidgets('dating headline keeps smart swipe phrase on one line',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 920));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          initialAuthTokensProvider.overrideWith(
            (_) => const AuthTokens(
              accessToken: 'access',
              refreshToken: 'refresh',
            ),
          ),
          currentUserProvider.overrideWith(
            (_) => const BackendUser(
              id: 'user-me',
              name: 'Сергей',
              onboardingComplete: true,
            ),
          ),
          tokenWalletProvider.overrideWith(
            (_) async => const TokenWalletData(balance: 50),
          ),
          notificationUnreadCountProvider.overrideWith((_) async => 0),
          backendRepositoryProvider.overrideWithValue(_DatingRepository()),
          appLocalCacheStoreProvider.overrideWith((_) => null),
          appMediaPrewarmServiceProvider.overrideWithValue(
            AppMediaPrewarmService(fetchFile: (_, __) async {}),
          ),
        ],
        child: MaterialApp.router(
          theme: DateasyTheme.theme,
          routerConfig: GoRouter(
            initialLocation: '/dating',
            routes: [
              GoRoute(
                  path: '/dating', builder: (_, __) => const DatingScreen()),
              GoRoute(
                path: '/dating/filter',
                builder: (_, __) => const Scaffold(body: Text('filters')),
              ),
              GoRoute(
                path: '/settings',
                builder: (_, __) => const Scaffold(body: Text('settings')),
              ),
              GoRoute(
                path: '/wallet',
                builder: (_, __) => const Scaffold(body: Text('wallet')),
              ),
              GoRoute(
                path: '/notifications',
                builder: (_, __) => const Scaffold(body: Text('notifications')),
              ),
              GoRoute(
                path: '/profile',
                builder: (_, __) => const Scaffold(body: Text('profile')),
              ),
            ],
          ),
        ),
      ),
    );
    await tester.pump();
    await tester.pump();

    final swipeTop = tester.getTopLeft(_richTextContaining('Свайпай')).dy;
    final smartTop = tester.getTopLeft(find.text('с умом')).dy;
    final highlightHeight =
        tester.getSize(find.byType(DateasyHeadlineHighlight)).height;
    final smartTextHeight = tester.getSize(find.text('с умом')).height;

    expect((smartTop - swipeTop).abs(), lessThan(20));
    expect(highlightHeight - smartTextHeight, lessThanOrEqualTo(6));
  });

  test('dating prewarms only the next three visible profile images', () {
    final urls = datingPrewarmImageUrls(
      [
        _card('current', 'https://cdn.test/current.jpg'),
        _card('next-1', 'https://cdn.test/next-1.jpg'),
        _card('next-2', 'https://cdn.test/next-2.jpg'),
        _card('next-3', 'https://cdn.test/next-3.jpg'),
        _card('next-4', 'https://cdn.test/next-4.jpg'),
      ],
      currentIndex: 0,
    ).toList(growable: false);

    expect(urls, [
      'https://cdn.test/next-1.jpg',
      'https://cdn.test/next-2.jpg',
      'https://cdn.test/next-3.jpg',
    ]);
  });
}

Finder _richTextContaining(String text) {
  return find.byWidgetPredicate(
    (widget) => widget is RichText && widget.text.toPlainText().contains(text),
    description: 'RichText containing "$text"',
  );
}

BackendCardItem _card(String id, String imageUrl) {
  return BackendCardItem(
    id: id,
    title: id,
    imageUrl: imageUrl,
    raw: {'id': id, 'imageUrl': imageUrl},
  );
}

class _DatingRepository extends BackendRepository {
  _DatingRepository() : super(Dio());

  String? lastGender;
  int? lastAgeMin;
  int? lastAgeMax;
  int? lastRadiusKm;
  bool? lastVerifiedOnly;
  bool? lastOnlineOnly;
  bool? lastNewThisWeekOnly;

  @override
  Future<BackendPage<BackendCardItem>> fetchDatingDiscover({
    int limit = 10,
    String? gender,
    int? ageMin,
    int? ageMax,
    int? radiusKm,
    List<String> interests = const [],
    bool? verifiedOnly,
    bool? onlineOnly,
    bool? newThisWeekOnly,
    CancelToken? cancelToken,
  }) async {
    lastGender = gender;
    lastAgeMin = ageMin;
    lastAgeMax = ageMax;
    lastRadiusKm = radiusKm;
    lastVerifiedOnly = verifiedOnly;
    lastOnlineOnly = onlineOnly;
    lastNewThisWeekOnly = newThisWeekOnly;
    return const BackendPage(
      items: [
        BackendCardItem(
          id: 'user-sonya',
          title: 'Соня',
          raw: {
            'userId': 'user-sonya',
            'name': 'Соня',
            'verified': false,
            'online': false,
          },
        ),
      ],
    );
  }
}

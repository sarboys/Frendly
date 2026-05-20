import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile2/features/posters/presentation/poster_detail_screen.dart';
import 'package:mobile2/app/core/providers/core_providers.dart';
import 'package:mobile2/features/posters/presentation/posters_screen.dart';
import 'package:mobile2/shared/data/backend_repository.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';

void main() {
  test('posters query cache key includes city filters and limit', () {
    const query = PostersQuery(
      city: 'Казань',
      query: 'джаз',
      dateFrom: '2026-05-19',
      dateTo: '2026-05-26',
      priceMode: 'free',
      category: 'concert',
      limit: 12,
    );

    expect(
      query.cacheValueFor('Москва'),
      'events&city=Москва&q=джаз&date=&dateFrom=2026-05-19&dateTo=2026-05-26&priceMode=free&category=concert&limit=12',
    );
  });

  test('posters prewarm uses only the first eight poster covers', () {
    final posters = List.generate(
      10,
      (index) => BackendCardItem(
        id: 'poster-$index',
        title: 'Poster $index',
        imageUrl: 'https://cdn.test/poster-$index.jpg',
      ),
    );

    expect(posterPrewarmImageUrls(posters).toList(growable: false), [
      'https://cdn.test/poster-0.jpg',
      'https://cdn.test/poster-1.jpg',
      'https://cdn.test/poster-2.jpg',
      'https://cdn.test/poster-3.jpg',
      'https://cdn.test/poster-4.jpg',
      'https://cdn.test/poster-5.jpg',
      'https://cdn.test/poster-6.jpg',
      'https://cdn.test/poster-7.jpg',
    ]);
  });

  testWidgets('posters screen builds poster rows lazily', (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 812));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final posters = List.generate(
      80,
      (index) => BackendCardItem(
        id: 'poster-$index',
        title: 'Poster $index',
        subtitle: 'Place $index',
        imageUrl: 'https://cdn.test/poster-$index.jpg',
        raw: {
          'id': 'poster-$index',
          'title': 'Poster $index',
          'subtitle': 'Place $index',
          'price': '1000',
        },
      ),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          tokenWalletProvider.overrideWith(
            (ref) async => const TokenWalletData(balance: 0),
          ),
          postersQueryProvider.overrideWith(
            (ref, query) => Stream.value(
              BackendPage<BackendCardItem>(items: posters),
            ),
          ),
        ],
        child: MaterialApp(
          theme: DateasyTheme.theme,
          home: const PostersScreen(),
        ),
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(find.text('Poster 0'), findsWidgets);
    expect(find.text('Poster 79'), findsNothing);
  });

  testWidgets('posters search waits for debounce before querying backend',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 812));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final queries = <String>[];

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          tokenWalletProvider.overrideWith(
            (ref) async => const TokenWalletData(balance: 0),
          ),
          postersQueryProvider.overrideWith((ref, query) {
            final value = query.query;
            if (value != null && value.isNotEmpty) {
              queries.add(value);
            }
            return const Stream<BackendPage<BackendCardItem>>.empty();
          }),
        ],
        child: MaterialApp(
          theme: DateasyTheme.theme,
          home: const PostersScreen(),
        ),
      ),
    );
    await tester.pump();

    await tester.enterText(find.byType(TextField), 'джаз');
    await tester.pump();

    expect(queries, isEmpty);

    await tester.pump(const Duration(milliseconds: 300));
    await tester.pump();

    expect(queries, ['джаз']);
  });

  testWidgets('posters screen loads next page near bottom', (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 812));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final firstPagePosters = List.generate(
      20,
      (index) => _poster(index),
    );
    final repository = _PagedPostersRepository();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          tokenWalletProvider.overrideWith(
            (ref) async => const TokenWalletData(balance: 0),
          ),
          backendRepositoryProvider.overrideWithValue(repository),
          postersQueryProvider.overrideWith(
            (ref, query) => Stream.value(
              BackendPage<BackendCardItem>(
                items: firstPagePosters,
                nextCursor: 'page-2',
              ),
            ),
          ),
        ],
        child: MaterialApp(
          theme: DateasyTheme.theme,
          home: const PostersScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.fling(
      find.byType(CustomScrollView),
      const Offset(0, -2800),
      5000,
    );
    await tester.pumpAndSettle();

    expect(repository.cursors, ['page-2']);
  });

  testWidgets('poster detail opens new meeting with affiche id',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 812));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final router = GoRouter(
      initialLocation: '/posters/poster-1',
      routes: [
        GoRoute(
          path: '/posters/:posterId',
          builder: (_, state) => PosterDetailScreen(
            posterId: state.pathParameters['posterId'] ?? '',
          ),
        ),
        GoRoute(
          path: '/meetings/new',
          builder: (_, state) => Scaffold(
            body: Text(
              'new-meeting-${state.uri.queryParameters['afficheEventId']}',
            ),
          ),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          posterDetailProvider.overrideWith(
            (ref, id) async => BackendCardItem(
              id: id,
              title: 'Poster $id',
              subtitle: 'Place',
              raw: const {'venueName': 'Place'},
            ),
          ),
        ],
        child: MaterialApp.router(
          theme: DateasyTheme.theme,
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Собрать компанию'));
    await tester.pumpAndSettle();

    expect(find.text('new-meeting-poster-1'), findsOneWidget);
  });
}

BackendCardItem _poster(int index) {
  return BackendCardItem(
    id: 'poster-$index',
    title: 'Poster $index',
    subtitle: 'Place $index',
    imageUrl: 'https://cdn.test/poster-$index.jpg',
    raw: {
      'id': 'poster-$index',
      'title': 'Poster $index',
      'subtitle': 'Place $index',
      'price': '1000',
    },
  );
}

class _PagedPostersRepository extends BackendRepository {
  _PagedPostersRepository() : super(Dio());

  final List<String?> cursors = [];

  @override
  Future<BackendPage<BackendCardItem>> fetchAffiche({
    String? city,
    String? query,
    String? date,
    String? dateFrom,
    String? dateTo,
    String? priceMode,
    String? category,
    int limit = 20,
    String? cursor,
    CancelToken? cancelToken,
  }) async {
    cursors.add(cursor);
    return BackendPage(items: [_poster(20)]);
  }
}

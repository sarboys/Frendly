import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile2/features/routes/presentation/routes_screen.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';

void main() {
  test('routes prewarm uses only the first six route cover images', () {
    final routes = List.generate(
      8,
      (index) => BackendCardItem(
        id: 'route-$index',
        title: 'Route $index',
        imageUrl: 'https://cdn.test/route-$index.jpg',
      ),
    );

    expect(routePrewarmImageUrls(routes).toList(growable: false), [
      'https://cdn.test/route-0.jpg',
      'https://cdn.test/route-1.jpg',
      'https://cdn.test/route-2.jpg',
      'https://cdn.test/route-3.jpg',
      'https://cdn.test/route-4.jpg',
      'https://cdn.test/route-5.jpg',
    ]);
  });

  testWidgets('routes screen builds route cards lazily', (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 812));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final routes = List.generate(
      80,
      (index) => BackendCardItem(
        id: 'route-$index',
        title: 'Route $index',
        city: 'City',
        imageUrl: 'https://cdn.test/route-$index.jpg',
        raw: {
          'id': 'route-$index',
          'title': 'Route $index',
          'duration': '2 часа',
          'price': '1000',
          'stops': 3,
        },
      ),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          tokenWalletProvider.overrideWith(
            (ref) async => const TokenWalletData(balance: 0),
          ),
          routeTemplatesByQueryProvider.overrideWith(
            (ref, query) => Stream.value(
              BackendPage<BackendCardItem>(items: routes),
            ),
          ),
        ],
        child: MaterialApp(
          theme: DateasyTheme.theme,
          home: const DateasyRoutesScreen(),
        ),
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(find.text('Route 0'), findsOneWidget);
    expect(find.text('Route 79'), findsNothing);
  });
}

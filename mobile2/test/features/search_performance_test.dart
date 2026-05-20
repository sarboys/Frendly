import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile2/features/search/presentation/search_screen.dart';
import 'package:mobile2/shared/data/app_providers.dart';
import 'package:mobile2/shared/models/backend_models.dart';

void main() {
  test('search prewarm uses only the first ten result images', () {
    final results = List.generate(
      12,
      (index) => BackendCardItem(
        id: 'result-$index',
        title: 'Result $index',
        imageUrl: 'https://cdn.test/result-$index.jpg',
      ),
    );

    expect(searchPrewarmImageUrls(results).toList(growable: false), [
      'https://cdn.test/result-0.jpg',
      'https://cdn.test/result-1.jpg',
      'https://cdn.test/result-2.jpg',
      'https://cdn.test/result-3.jpg',
      'https://cdn.test/result-4.jpg',
      'https://cdn.test/result-5.jpg',
      'https://cdn.test/result-6.jpg',
      'https://cdn.test/result-7.jpg',
      'https://cdn.test/result-8.jpg',
      'https://cdn.test/result-9.jpg',
    ]);
  });

  testWidgets('search waits for debounce before requesting backend',
      (tester) async {
    final queries = <String>[];

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          searchResultsProvider.overrideWith((ref, query) async {
            queries.add(query);
            return const BackendPage<BackendCardItem>(items: []);
          }),
        ],
        child: const MaterialApp(home: SearchScreen()),
      ),
    );

    await tester.enterText(find.byType(TextField), 'mos');
    await tester.pump();

    expect(queries, isEmpty);

    await tester.pump(const Duration(milliseconds: 350));

    expect(queries, ['mos']);
  });

  testWidgets('search results build rows lazily', (tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 812));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final results = List.generate(
      80,
      (index) => BackendCardItem(
        id: 'result-$index',
        title: 'Result $index',
        subtitle: 'Subtitle $index',
        raw: {
          'id': 'result-$index',
          'title': 'Result $index',
          'subtitle': 'Subtitle $index',
          'type': 'event',
        },
      ),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          searchResultsProvider.overrideWith((ref, query) async {
            return BackendPage<BackendCardItem>(items: results);
          }),
        ],
        child: const MaterialApp(home: SearchScreen()),
      ),
    );

    await tester.enterText(find.byType(TextField), 'mos');
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pump();

    expect(find.text('Result 0'), findsOneWidget);
    expect(find.text('Result 79'), findsNothing);
  });
}

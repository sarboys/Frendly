import 'package:big_break_mobile/features/posters/presentation/posters_screen.dart';
import 'package:big_break_mobile/shared/data/app_providers.dart';
import 'package:big_break_mobile/shared/data/mock_data.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../test_overrides.dart';

Widget _wrap({
  required List<String> observedQueries,
}) {
  return ProviderScope(
    overrides: [
      ...buildTestOverrides(),
      posterFeedProvider.overrideWith((ref, query) async {
        observedQueries.add(query.query);
        return mockPosters;
      }),
      featuredPostersProvider.overrideWith((ref) async => mockPosters),
    ],
    child: const MaterialApp(
      home: PostersScreen(),
    ),
  );
}

void main() {
  testWidgets('poster search waits for debounce before requesting feed',
      (tester) async {
    final observedQueries = <String>[];

    await tester.pumpWidget(_wrap(observedQueries: observedQueries));
    await tester.pumpAndSettle();
    observedQueries.clear();

    await tester.enterText(find.byType(TextField), 'Кофе');
    await tester.pump(const Duration(milliseconds: 100));

    expect(observedQueries, isEmpty);

    await tester.pump(const Duration(milliseconds: 250));
    await tester.pumpAndSettle();

    expect(observedQueries, contains('Кофе'));
  });
}

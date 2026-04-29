import 'package:big_break_mobile/features/search/presentation/search_screen.dart';
import 'package:big_break_mobile/features/tonight/presentation/tonight_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../test_overrides.dart';

Widget _wrap(Widget child) {
  return ProviderScope(
    overrides: buildTestOverrides(),
    child: MaterialApp(home: child),
  );
}

Widget _wrapWithTopInset(Widget child) {
  return ProviderScope(
    overrides: buildTestOverrides(),
    child: MediaQuery(
      data: const MediaQueryData(
        padding: EdgeInsets.only(top: 24),
      ),
      child: MaterialApp(home: child),
    ),
  );
}

void main() {
  testWidgets('search opens discovery filter sheet', (tester) async {
    await tester.pumpWidget(_wrap(const SearchScreen()));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Фильтры'));
    await tester.pumpAndSettle();

    expect(find.text('Образ жизни'), findsOneWidget);
    expect(find.text('Стоимость'), findsOneWidget);
    expect(find.text('Состав'), findsOneWidget);
    expect(find.text('Тип доступа'), findsOneWidget);
  });

  testWidgets('tonight opens search instead of inline filter sheet', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(const TonightScreen()));
    await tester.pumpAndSettle();

    expect(find.text('Фильтры'), findsNothing);
    expect(find.byIcon(LucideIcons.search), findsOneWidget);
  });

  testWidgets('search filter sheet recalculates result count before apply', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(const SearchScreen()));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Фильтры'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Показать'), findsOneWidget);

    await tester.tap(find.text('ЗОЖ'));
    await tester.pumpAndSettle();

    expect(find.text('Показать 1'), findsOneWidget);

    await tester.tap(find.text('Сбросить'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Показать'), findsOneWidget);
  });

  testWidgets('filter sheet header keeps top inset', (tester) async {
    await tester.pumpWidget(_wrapWithTopInset(const SearchScreen()));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Фильтры'));
    await tester.pumpAndSettle();

    final resetTopLeft = tester.getTopLeft(find.text('Сбросить').last);
    final titleTopLeft = tester.getTopLeft(find.text('Фильтры').last);
    final closeTopLeft =
        tester.getTopLeft(find.byIcon(Icons.close_rounded).last);

    expect(resetTopLeft.dy, greaterThanOrEqualTo(48));
    expect(titleTopLeft.dy, greaterThanOrEqualTo(48));
    expect(closeTopLeft.dy, greaterThanOrEqualTo(48));
  });
}

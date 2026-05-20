import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile2/shared/theme/dateasy_theme.dart';
import 'package:mobile2/shared/widgets/dateasy_highlight_text.dart';

void main() {
  test('headline highlight uses middle aligned widget span', () {
    const baseStyle = TextStyle(fontSize: 34, height: 1.05);

    final span = dateasyHeadlineHighlightSpan(
      text: 'встреч',
      style: baseStyle,
    );

    expect(span.alignment, PlaceholderAlignment.middle);
    expect(span.child, isA<Padding>());
  });

  testWidgets('headline highlight keeps text centered in the pill',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: DateasyTheme.theme,
        home: Scaffold(
          body: Center(
            child: Text.rich(
              TextSpan(
                style: DateasyTheme.theme.textTheme.headlineLarge,
                children: [
                  const TextSpan(text: 'Список '),
                  dateasyHeadlineHighlightSpan(
                    text: 'встреч',
                    style: DateasyTheme.theme.textTheme.headlineLarge,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );

    final textBox = tester.getRect(find.text('встреч'));
    final decoratedBox = tester.widget<DecoratedBox>(find.byType(DecoratedBox));
    expect(decoratedBox.decoration, isA<BoxDecoration>());

    final pillBox = tester.getRect(find.byType(DecoratedBox));
    final verticalInsetTop = textBox.top - pillBox.top;
    final verticalInsetBottom = pillBox.bottom - textBox.bottom;

    expect((verticalInsetTop - verticalInsetBottom).abs(), lessThan(3));
  });
}

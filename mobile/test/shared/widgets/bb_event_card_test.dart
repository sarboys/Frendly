import 'package:big_break_mobile/app/theme/app_colors.dart';
import 'package:big_break_mobile/app/theme/app_theme.dart';
import 'package:big_break_mobile/shared/data/mock_data.dart';
import 'package:big_break_mobile/shared/widgets/bb_event_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('event card renders title and details CTA', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: BbEventCard(event: mockEvents.first),
        ),
      ),
    );

    expect(find.text('Винный вечер на крыше'), findsOneWidget);
    expect(find.text('Подробнее →'), findsOneWidget);
  });

  testWidgets('event card uses dark card surface in dark theme', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        darkTheme: AppTheme.dark,
        themeMode: ThemeMode.dark,
        home: Scaffold(
          body: BbEventCard(event: mockEvents.first),
        ),
      ),
    );

    final material = tester.widget<Material>(
      find
          .descendant(
            of: find.byType(BbEventCard),
            matching: find.byType(Material),
          )
          .first,
    );
    expect(material.color, AppColors.darkTheme.card);
  });
}

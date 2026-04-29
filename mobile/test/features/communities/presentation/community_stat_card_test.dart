import 'package:big_break_mobile/app/theme/app_theme.dart';
import 'package:big_break_mobile/features/communities/presentation/community_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('community stat card keeps icon and value in a compact row',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: const Scaffold(
          body: SizedBox(
            width: 120,
            child: CommunityStatCard(
              icon: LucideIcons.images,
              value: '68',
            ),
          ),
        ),
      ),
    );

    final card = find.byType(CommunityStatCard);
    final iconCenter = tester.getCenter(find.byIcon(LucideIcons.images));
    final valueCenter = tester.getCenter(find.text('68'));

    expect(tester.getSize(card).height, lessThanOrEqualTo(56));
    expect(valueCenter.dx, greaterThan(iconCenter.dx));
    expect((valueCenter.dy - iconCenter.dy).abs(), lessThanOrEqualTo(2));
  });
}

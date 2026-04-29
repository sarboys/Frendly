import 'package:big_break_mobile/app/app.dart';
import 'package:flutter_test/flutter_test.dart';
import 'test_overrides.dart';

void main() {
  testWidgets('generated smoke test uses BigBreak root', (tester) async {
    await tester.pumpWidget(BigBreakRoot(overrides: buildTestOverrides()));
    await tester.pumpAndSettle();

    expect(find.textContaining('Знакомства'), findsOneWidget);
    expect(find.textContaining('а не свайпы.'), findsOneWidget);
  });
}

import 'package:big_break_mobile/app/app.dart';
import 'package:flutter_test/flutter_test.dart';
import 'test_overrides.dart';

void main() {
  testWidgets('app bootstraps root widget', (tester) async {
    await tester.pumpWidget(BigBreakRoot(overrides: buildTestOverrides()));

    expect(find.byType(BigBreakRoot), findsOneWidget);
  });
}

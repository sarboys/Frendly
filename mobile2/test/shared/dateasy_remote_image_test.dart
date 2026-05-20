import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile2/shared/widgets/dateasy_remote_image.dart';

void main() {
  testWidgets('avatar image fallback shows a person icon', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: DateasyRemoteImage(
          imageUrl: null,
          usage: DateasyImageUsage.avatar,
        ),
      ),
    );

    expect(find.byIcon(Icons.person), findsOneWidget);
  });

  testWidgets('card image fallback shows a broken image icon', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: DateasyRemoteImage(
          imageUrl: '',
          usage: DateasyImageUsage.card,
        ),
      ),
    );

    expect(find.byIcon(Icons.broken_image_outlined), findsOneWidget);
  });
}

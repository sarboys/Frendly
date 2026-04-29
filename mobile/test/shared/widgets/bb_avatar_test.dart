import 'package:big_break_mobile/shared/widgets/bb_avatar.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('avatar renders initials for person name', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Center(
            child: BbAvatar(
              name: 'Аня К',
              size: BbAvatarSize.lg,
              online: true,
            ),
          ),
        ),
      ),
    );

    expect(find.text('АК'), findsOneWidget);
  });

  testWidgets('avatar constrains network image to the circle size', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Center(
            child: BbAvatar(
              name: 'Сергей',
              size: BbAvatarSize.lg,
              online: true,
              imageUrl: 'https://cdn.example.com/avatar.jpg',
            ),
          ),
        ),
      ),
    );

    final image = tester.widget<CachedNetworkImage>(
      find.byType(CachedNetworkImage),
    );
    expect(image.width, BbAvatarSize.lg.dimension);
    expect(image.height, BbAvatarSize.lg.dimension);
    expect(image.fit, BoxFit.cover);
  });
}
